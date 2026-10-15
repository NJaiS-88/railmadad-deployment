"""
staff_assignment/staff_assignment_agent.py
==========================================
Rail Madad - AI Staff Assignment Agent

Takes the OUTPUT of the Classification Agent as input:
  problem_type, category, department, sub_department,
  location, urgency, required_action, action_steps,
  confidence, reason, escalation_required

Uses OpenRouter AI (Llama-3.3 70B cascade) with OpenAI tool-calling
to dynamically select and assign the best-fit staff member.

Modes:
  CLI    : python staff_assignment_agent.py --input classification_output.json
  Server : python staff_assignment_agent.py --serve   (port 8002)
           POST http://localhost:8002/assign-staff
           GET  http://localhost:8002/health
"""

import argparse
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional

from openai import OpenAI

# ── Load .env - backend/.env is the single source of DB credentials ─────────
try:
    from dotenv import load_dotenv
    _here = os.path.dirname(os.path.abspath(__file__))
    _backend_env = os.path.join(_here, "..", "backend", ".env")
    _root_env = os.path.join(_here, "..", ".env")
    load_dotenv(_backend_env)
    load_dotenv(_root_env)
except ImportError:
    pass

API_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()

MODELS: List[str] = [
    "meta-llama/llama-3.3-70b-instruct",
    "meta-llama/llama-3.1-8b-instruct",
    "google/gemini-2.0-flash-001",
    "openai/gpt-4o-mini"
]


# ── Tool definition ──────────────────────────────────────────────────────────

ASSIGNMENT_TOOLS: List[Dict] = [
    {
        "type": "function",
        "function": {
            "name": "assign_staff",
            "description": (
                "Assign the most suitable free railway staff member to resolve a classified complaint. "
                "Call this ONCE when you have evaluated all staff candidates and chosen the best fit."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "staff_id": {
                        "type": "string",
                        "description": "The unique ID of the selected staff member from the staff database.",
                    },
                    "staff_name": {
                        "type": "string",
                        "description": "Full name of the assigned staff member.",
                    },
                    "role": {
                        "type": "string",
                        "description": "Job role/designation of the assigned staff member.",
                    },
                    "department": {
                        "type": "string",
                        "description": "Primary department of the assigned staff member. Must be one of the live staff departments.",
                    },
                    "departments": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "All departments that need to be routed for this complaint. Only use actual staff departments from the available staff list.",
                    },
                    "contact_phone": {
                        "type": "string",
                        "description": "Phone number of the assigned staff member.",
                    },
                    "station_area": {
                        "type": "string",
                        "description": "Work area / station zone of the assigned staff member.",
                    },
                    "assignment_reason": {
                        "type": "string",
                        "description": (
                            "Precise explanation citing why this staff member was selected "
                            "(department match, free status with 0 active tasks, experience, and rating)."
                        ),
                    },
                    "priority_action": {
                        "type": "string",
                        "description": "The exact first action this staff member should take upon receiving the complaint.",
                    },
                    "estimated_response_time": {
                        "type": "string",
                        "description": "Estimated time for staff to respond, based on urgency. E.g. '5 minutes', '15 minutes', '1 hour'.",
                    },
                    "confidence": {
                        "type": "number",
                        "description": "Confidence in this assignment from 0.0 to 1.0.",
                    },
                    "escalation_required": {
                        "type": "boolean",
                        "description": "True if this complaint also needs escalation to a senior officer.",
                    },
                    "backup_staff_id": {
                        "type": "string",
                        "description": "Optional: ID of a secondary staff member if the primary is unavailable.",
                    },
                    "backup_staff_name": {
                        "type": "string",
                        "description": "Optional: Name of the backup staff member.",
                    },
                    "department_assignments": {
                        "type": "array",
                        "items": {"type": "object"},
                        "description": "A list of assignments for each relevant department when a complaint needs multi-department dispatch.",
                    },
                },
                "required": [
                    "staff_id", "staff_name", "role", "department",
                    "station_area", "assignment_reason", "priority_action",
                    "estimated_response_time", "confidence", "escalation_required",
                ],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "no_staff_available",
            "description": "Call this ONLY when no staff member is available or qualified for this complaint type.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {
                        "type": "string",
                        "description": "Specific reason why no staff could be assigned.",
                    },
                    "recommended_action": {
                        "type": "string",
                        "description": "What should be done next to resolve this gap.",
                    },
                },
                "required": ["reason", "recommended_action"],
            },
        },
    },
]


# ── System Prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are the Staff Assignment Agent in the Rail Madad AI pipeline for Indian Railways powered by OpenRouter AI.

You receive:
1. A CLASSIFIED COMPLAINT with:
   problem_type, category, department, sub_department, location, urgency (critical/high/medium/low),
   required_action, action_steps, confidence, reason.

2. A LIVE STAFF DATABASE with:
   id, name, department, role, experience_years, previous_rating, resolved_tasks, active_tasks, availability.

YOUR MATCHING CRITERIA (IN STRICT PRIORITY ORDER):
1. **AVAILABILITY & WORKLOAD**:
   - Always prioritize FREE staff who currently have 0 active tasks (active_tasks: 0, available: true).
   - Avoid assigning staff who are already busy with other active tasks unless no other staff exists in that department.
2. **DEPARTMENT & SPECIALISATION MATCH**:
   - Assign staff whose department matches or is most relevant to the complaint.
3. **EXPERIENCE & PREVIOUS RATINGS**:
   - When multiple staff in the department are free, choose the staff member with the higher experience years and higher previous passenger rating.
4. **URGENCY**:
   - For High / Critical urgency, pick the highest-rated and most experienced available free staff.

Always call `assign_staff` with your decision. State clearly in `assignment_reason` that they were chosen because they are currently free (or least loaded) and have strong experience/ratings."""



# ── Helpers ──────────────────────────────────────────────────────────────────

def _s(v: Any) -> str:
    return str(v or "").strip()


def _get_db_names() -> List[str]:
    """Candidate database names - from the MONGO_URI, else common defaults."""
    import pymongo
    uri = os.getenv("MONGO_URI", "").strip()
    names: List[str] = []
    if uri:
        parsed = pymongo.uri_parser.parse_uri(uri)
        if parsed.get("database"):
            names.append(parsed["database"])
    names += ["railmadad", "test"]
    seen: set[str] = set()
    unique: List[str] = []
    for n in names:
        if n and n not in seen:
            seen.add(n)
            unique.append(n)
    return unique


def _normalise_staff_docs(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Map MongoDB staff documents (mongoose schema) to the agent's staff shape.

    ONLY approved staff are considered - exactly like the backend auto-assignment.
    """
    staff_list: List[Dict[str, Any]] = []
    for d in docs or []:
        if not d:
            continue
        if d.get("approvalStatus") != "approved":
            continue
        staff_list.append({
            "id": _s(d.get("staffId")) or _s(d.get("_id")) or _s(d.get("id")),
            "name": _s(d.get("name")),
            "department": _s(d.get("department")),
            "specialisation": d.get("specialisation") or [],
            "role": _s(d.get("role")),
            "shift": _s(d.get("shift")) or "morning",
            "available": bool(d.get("available", True)),
            "station": _s(d.get("station")) or _s(d.get("depot")) or _s(d.get("zone")) or "Station HQ",
            "phone": _s(d.get("phone")),
            "experience_years": d.get("experience_years") or 1,
        })
    return staff_list


def load_staff_db() -> List[Dict[str, Any]]:
    """Fetch approved staff records DIRECTLY from MongoDB, augmented with live active task counts and passenger ratings."""
    uri = os.getenv("MONGO_URI", "").strip()
    if not uri:
        print("[StaffAgent] [WARN] MONGO_URI not set - cannot load staff from the backend database.")
        return []

    try:
        import pymongo
        client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=4000)
        for db_name in _get_db_names():
            try:
                db = client[db_name]
                staff_docs = list(db["staffs"].find(
                    {"approvalStatus": "approved"},
                    {"_id": 0, "password": 0, "idProof": 0, "ocrResult": 0},
                ).limit(200))
                if not staff_docs:
                    staff_docs = list(db["staff"].find(
                        {"approvalStatus": "approved"},
                        {"_id": 0, "password": 0, "idProof": 0, "ocrResult": 0},
                    ).limit(200))
            except Exception:
                staff_docs = []

            staff_list = _normalise_staff_docs(staff_docs)
            if staff_list:
                # Compute live active tasks and feedback ratings for each staff member from complaints collection
                try:
                    all_complaints = list(db["complaints"].find({}, {"staffAssignment": 1, "passengerFeedback": 1, "status": 1}))
                    for s in staff_list:
                        s_id = str(s.get("id") or "").strip()
                        s_name = str(s.get("name") or "").strip().lower()
                        s_phone = str(s.get("phone") or "").strip()
                        
                        active_count = 0
                        resolved_count = 0
                        ratings = []
                        for c in all_complaints:
                            sa = c.get("staffAssignment")
                            if sa:
                                sa_id = str(sa.get("staff_id") or "").strip()
                                sa_name = str(sa.get("staff_name") or "").strip().lower()
                                sa_phone = str(sa.get("contact_phone") or "").strip()
                                sa_status = sa.get("status")

                                if sa_id == s_id or (s_name and sa_name == s_name) or (s_phone and sa_phone == s_phone):
                                    if sa_status in ["Assigned", "Accepted", "In Progress"]:
                                        active_count += 1
                                    elif sa_status == "Resolved" or c.get("status") == "Resolved":
                                        resolved_count += 1
                                        fb = c.get("passengerFeedback")
                                        if fb and isinstance(fb.get("rating"), (int, float)) and fb.get("rating") > 0:
                                            ratings.append(float(fb.get("rating")))
                        
                        s["active_tasks"] = active_count
                        s["resolved_tasks"] = resolved_count
                        s["rating"] = round(sum(ratings) / len(ratings), 1) if ratings else 5.0
                        s["is_free"] = (active_count == 0 and s.get("available", True))
                except Exception as comp_err:
                    for s in staff_list:
                        s.setdefault("active_tasks", 0)
                        s.setdefault("resolved_tasks", 0)
                        s.setdefault("rating", 5.0)
                        s.setdefault("is_free", True)

                print(f"[StaffAgent] [OK] Loaded {len(staff_list)} approved staff records from MongoDB ({db_name}) with live workload & ratings")
                return staff_list

        print("[StaffAgent] [WARN] No approved staff found in MongoDB - nothing will be assigned.")
        return []
    except Exception as mongo_err:
        print(f"[StaffAgent] [WARN] MongoDB query error: {mongo_err}")
        return []



def build_assignment_prompt(classification: Dict[str, Any], staff_list: List[Dict[str, Any]]) -> str:
    """Build the user message for the staff assignment agent."""
    lines = ["=== CLASSIFIED COMPLAINT ===\n"]

    # Classification fields
    for field, label in [
        ("problem_type",       "Problem Type"),
        ("category",           "Category"),
        ("department",         "Required Department"),
        ("departments",        "Relevant Department(s)"),
        ("sub_department",     "Sub-Department"),
        ("location",           "Complaint Location"),
        ("urgency",            "Urgency"),
        ("required_action",    "Required Action"),
        ("confidence",         "Classification Confidence"),
        ("reason",             "Classification Reason"),
        ("manual_review_required","Manual Review Required"),
        ("escalation_required","Escalation Required"),
    ]:
        val = classification.get(field)
        if val is not None and _s(val):
            lines.append(f"{label}: {val}")

    steps = classification.get("action_steps") or []
    if isinstance(steps, list) and steps:
        lines.append("Action Steps:")
        for step in steps:
            lines.append(f"  - {step}")

    # Journey context if present
    for field, label in [
        ("trainNumber", "Train Number"),
        ("coach",       "Coach"),
        ("pnr",         "PNR"),
        ("passengerName", "Passenger"),
    ]:
        val = _s(classification.get(field))
        if val:
            lines.append(f"{label}: {val}")

    lines.append("\n=== LIVE STAFF DATABASE (WORKLOAD & RATINGS) ===\n")
    if not staff_list:
        lines.append("(No staff records available)")
    else:
        # Sort so FREE staff (0 active tasks) appear at the top, followed by highest ratings & experience
        sorted_staff = sorted(
            staff_list,
            key=lambda s: (
                not s.get("is_free"),
                s.get("active_tasks", 0),
                -float(s.get("rating", 5.0)),
                -int(s.get("experience_years", 1))
            )
        )
        for staff in sorted_staff:
            free_tag = "🟢 FREE (0 active tasks)" if staff.get("is_free") else f"🟡 BUSY ({staff.get('active_tasks')} active tasks)"
            specs = ", ".join(staff.get("specialisation") or [])
            lines.append(
                f"[{staff.get('id','?')}] {staff.get('name','?')} | "
                f"Dept: {staff.get('department','?')} | Role: {staff.get('role','?')} | "
                f"Status: {free_tag} | "
                f"Exp: {staff.get('experience_years','?')} yr | "
                f"Rating: ⭐ {staff.get('rating', 5.0)}/5.0 ({staff.get('resolved_tasks', 0)} resolved) | "
                f"Area: {staff.get('station','?')}"
            )
            if specs:
                lines.append(f"   Specialisation: {specs}")

    lines.append("\n=== END ===\n")
    lines.append(
        "Analyse the classified complaint and staff database above. "
        "Select the best matching FREE staff member (0 active tasks) in the relevant department. "
        "If multiple staff are free, choose based on higher experience and passenger ratings. "
        "Call assign_staff with your decision. Do NOT return placeholder names."
    )
    return "\n".join(lines)


def _extract_tool_call(msg) -> Optional[Dict]:
    tc_list = getattr(msg, "tool_calls", None) or []
    if not tc_list:
        return None
    tc = tc_list[0]
    try:
        args = json.loads(tc.function.arguments)
    except Exception:
        args = {}
    return {"id": tc.id, "name": tc.function.name, "args": args}


def _parse_json_text(text: str) -> Optional[Dict]:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text).strip()
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass
    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        try:
            obj = json.loads(m.group())
            if isinstance(obj, dict):
                return obj
        except Exception:
            pass
    return None


# ── Core Agent Function ──────────────────────────────────────────────────────

def _resolve_real_staff(
    result: Dict[str, Any],
    classification: Dict[str, Any],
    staff_list: List[Dict[str, Any]],
):
    """Map an LLM assignment onto a REAL staff record from the database, prioritizing free staff."""
    def norm(s: str) -> str:
        return re.sub(r"\s+", " ", str(s or "").lower().strip())

    want_id = _s(result.get("staff_id"))
    want_name = _s(result.get("staff_name"))

    for s in staff_list:
        if want_id and norm(s.get("id")) == norm(want_id):
            return s, True
    for s in staff_list:
        if want_name and norm(s.get("name")) == norm(want_name):
            return s, True

    dept = norm(classification.get("department"))
    
    # 1. Matching department & FREE
    free_dept_candidates = [
        s for s in staff_list
        if s.get("is_free") and dept and (norm(s.get("department")) == dept or dept in norm(s.get("department")))
    ]
    if free_dept_candidates:
        free_dept_candidates.sort(key=lambda s: (-float(s.get("rating", 5.0)), -int(s.get("experience_years", 1))))
        return free_dept_candidates[0], False

    # 2. Matching department & least active tasks
    dept_candidates = [
        s for s in staff_list
        if s.get("available") and dept and (norm(s.get("department")) == dept or dept in norm(s.get("department")))
    ]
    if dept_candidates:
        dept_candidates.sort(key=lambda s: (s.get("active_tasks", 0), -float(s.get("rating", 5.0)), -int(s.get("experience_years", 1))))
        return dept_candidates[0], False

    # 3. Any FREE staff
    free_any = [s for s in staff_list if s.get("is_free")]
    if free_any:
        free_any.sort(key=lambda s: (-float(s.get("rating", 5.0)), -int(s.get("experience_years", 1))))
        return free_any[0], False

    # 4. Any available staff
    avail = [s for s in staff_list if s.get("available")]
    if avail:
        avail.sort(key=lambda s: (s.get("active_tasks", 0), -float(s.get("rating", 5.0)), -int(s.get("experience_years", 1))))
        return avail[0], False

    return None, False



def assign_staff(
    classification: Dict[str, Any]
) -> Dict[str, Any]:
    """
    AI-powered staff assignment.

    Input:
        classification : output dict from classification_agent.classify_complaint()
                         Must contain problem_type, department, urgency, etc.

    Returns:
        dict with: status, staff_id, staff_name, role, department, contact_phone,
                   station_area, assignment_reason, priority_action,
                   estimated_response_time, confidence, escalation_required,
                   backup_staff_id, backup_staff_name
    """
    staff_list = load_staff_db()

    if not staff_list:
        return {
            "status": "unassigned",
            "reason": "No approved staff found in the MongoDB backend database.",
            "recommended_action": "Register staff through the staff portal and approve them from the officer dashboard.",
            "classification_input": {
                "problem_type": classification.get("problem_type"),
                "department": classification.get("department"),
                "urgency": classification.get("urgency"),
            },
        }

    if not API_KEY:
        raise ValueError("OPENROUTER_API_KEY environment variable is required to run the Staff Assignment Agent.")

    # ── LLM agentic loop ─────────────────────────────────────────────────────
    client = OpenAI(base_url=API_BASE_URL, api_key=API_KEY, timeout=30.0, max_retries=0)
    user_message = build_assignment_prompt(classification, staff_list)
    base_messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": user_message},
    ]

    assignment_result: Optional[Dict] = None
    no_staff_result:   Optional[Dict] = None
    last_error: Optional[str] = None

    for model in MODELS:
        if assignment_result or no_staff_result:
            break
        try:
            print(f"[StaffAgent] Trying model: {model}")
            messages = list(base_messages)

            for turn in range(4):
                try:
                    resp = client.chat.completions.create(
                        model=model,
                        messages=messages,
                        tools=ASSIGNMENT_TOOLS,
                        tool_choice={"type": "function", "function": {"name": "assign_staff"}},
                        temperature=0.2,
                        top_p=0.9,
                        max_tokens=1024,
                        stream=False,
                    )
                except Exception:
                    try:
                        resp = client.chat.completions.create(
                            model=model,
                            messages=messages,
                            tools=ASSIGNMENT_TOOLS,
                            tool_choice="auto",
                            temperature=0.2,
                            top_p=0.9,
                            max_tokens=1024,
                            stream=False,
                        )
                    except Exception:
                        resp = client.chat.completions.create(
                            model=model,
                            messages=messages,
                            temperature=0.2,
                            top_p=0.9,
                            max_tokens=1024,
                            stream=False,
                        )

                if not resp.choices:
                    break

                msg = resp.choices[0].message
                tool_call = _extract_tool_call(msg)

                if tool_call and tool_call["name"] == "assign_staff":
                    assignment_result = tool_call["args"]
                    print(f"[StaffAgent] [OK] Tool-call assignment on turn {turn + 1}")
                    break

                if tool_call and tool_call["name"] == "no_staff_available":
                    no_staff_result = tool_call["args"]
                    print(f"[StaffAgent] [WARN]  No-staff tool called on turn {turn + 1}")
                    break

                if tool_call:
                    # Agent is mid-reasoning - append and continue
                    messages.append({
                        "role": "assistant",
                        "content": msg.content or "",
                        "tool_calls": [{
                            "id": tool_call["id"],
                            "type": "function",
                            "function": {
                                "name": tool_call["name"],
                                "arguments": json.dumps(tool_call["args"]),
                            },
                        }],
                    })
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call["id"],
                        "content": json.dumps({"status": "ok"}),
                    })
                    continue

                # Plain-text JSON fallback
                raw = _s(msg.content)
                if raw:
                    parsed = _parse_json_text(raw)
                    if parsed and ("staff_id" in parsed or "staff_name" in parsed):
                        assignment_result = parsed
                        print(f"[StaffAgent] [OK] Plain-JSON assignment on turn {turn + 1}")
                        break
                break

        except Exception as err:
            last_error = str(err)
            print(f"[StaffAgent] Model {model} error: {err}")
            continue

    # ── Handle no-staff result ───────────────────────────────────────────────
    if no_staff_result and not assignment_result:
        return {
            "status": "unassigned",
            "reason": no_staff_result.get("reason", "No suitable staff available"),
            "recommended_action": no_staff_result.get("recommended_action", "Escalate to duty officer"),
            "classification_input": {
                "problem_type": classification.get("problem_type"),
                "department": classification.get("department"),
                "urgency": classification.get("urgency"),
            },
        }

    # ── Handle failure when all AI models fail ──────────────────────────────
    if not assignment_result:
        return {
            "status": "unassigned",
            "reason": f"All AI models failed to process staff assignment. Error: {last_error}",
            "recommended_action": "Check OpenRouter API status or network connectivity.",
        }

    # ── Enrich and normalise ─────────────────────────────────────────────────
    result = dict(assignment_result)
    result.setdefault("status", "assigned")
    result["status"] = "assigned"

    # ── Validate against the REAL database staff ─────────────────────────────
    # The LLM output is only a suggestion - the assigned staff member MUST
    # exist in MongoDB. If the LLM picked a non-existent/hallucinated person,
    # fall back to the best real available staff.
    real_staff, llm_matched = _resolve_real_staff(result, classification, staff_list)
    if not real_staff:
        return {
            "status": "unassigned",
            "reason": "No available approved staff in the database matched this complaint.",
            "recommended_action": "Escalate to the duty officer or wait for staff to become available.",
            "classification_input": {
                "problem_type": classification.get("problem_type"),
                "department": classification.get("department"),
                "urgency": classification.get("urgency"),
            },
        }

    result["staff_id"] = real_staff["id"]
    result["staff_name"] = real_staff["name"]
    result["role"] = real_staff["role"]
    result["department"] = real_staff["department"]
    result["contact_phone"] = real_staff["phone"]
    result["station_area"] = real_staff["station"]

    if not llm_matched:
        result["assignment_reason"] = (
            f"{result.get('assignment_reason', '')} [Assigned {real_staff['name']} "
            f"({real_staff['department']}) — verified against MongoDB staff records]"
        ).strip()
        result["escalation_required"] = True

    # Ensure escalation follows urgency
    urg = _s(classification.get("urgency")).lower()
    if urg == "critical":
        result["escalation_required"] = True

    # Ensure confidence is float
    try:
        result["confidence"] = float(result.get("confidence", 0.5))
    except (TypeError, ValueError):
        result["confidence"] = 0.5

    # Downgrade confidence when the LLM suggestion had to be corrected
    if not llm_matched:
        result["confidence"] = min(result["confidence"], 0.7)

    # Attach context for downstream consumers
    result["classification_summary"] = {
        "problem_type":   classification.get("problem_type"),
        "category":       classification.get("category"),
        "department":     classification.get("department"),
        "urgency":        classification.get("urgency"),
        "location":       classification.get("location"),
        "required_action": classification.get("required_action"),
    }

    print(f"[StaffAgent] Final assignment: {json.dumps(result, indent=2, ensure_ascii=False)}")
    return result


def save_assignment_to_db(complaint: Dict[str, Any], assignment_result: Dict[str, Any]) -> bool:
    """Save staff assignment directly back to the complaint in MongoDB so staff dashboard updates."""
    uri = os.getenv("MONGO_URI", "").strip()
    c_id = complaint.get("complaintId") or complaint.get("_id")
    if not uri or not c_id:
        return False
    try:
        import pymongo
        from datetime import datetime
        client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=4000)
        for db_name in _get_db_names():
            try:
                db = client[db_name]
                if "complaints" not in db.list_collection_names():
                    continue

                filter_q = {"complaintId": c_id} if complaint.get("complaintId") else {"_id": c_id}
                now_str = datetime.now().strftime("%d %b %Y, %H:%M")
                
                doc = db["complaints"].find_one(filter_q)
                if not doc:
                    continue

                timeline = doc.get("timeline", [])
                routed_found = False
                for step in timeline:
                    if step.get("status") == "Routed to Department":
                        step["completed"] = True
                        step["time"] = now_str
                        routed_found = True
                        break
                if not routed_found:
                    timeline.append({
                        "status": "Routed to Department",
                        "time": now_str,
                        "completed": True
                    })

                staff_assignment_doc = {
                    "status": "Assigned",
                    "staff_id": str(assignment_result.get("staff_id") or ""),
                    "staff_name": str(assignment_result.get("staff_name") or ""),
                    "role": str(assignment_result.get("role") or ""),
                    "department": str(assignment_result.get("department") or ""),
                    "departments": assignment_result.get("departments") or [assignment_result.get("department")],
                    "contact_phone": str(assignment_result.get("contact_phone") or ""),
                    "station_area": str(assignment_result.get("station_area") or "Station HQ"),
                    "assignment_reason": str(assignment_result.get("assignment_reason") or ""),
                    "priority_action": str(assignment_result.get("priority_action") or ""),
                    "estimated_response_time": str(assignment_result.get("estimated_response_time") or "15 minutes"),
                    "confidence": float(assignment_result.get("confidence") or 0.8),
                    "escalation_required": bool(assignment_result.get("escalation_required")),
                    "backup_staff_id": assignment_result.get("backup_staff_id"),
                    "backup_staff_name": assignment_result.get("backup_staff_name"),
                    "assigned_at": datetime.utcnow(),
                    "assignment_by": "AI Staff Assignment Agent"
                }

                update_data = {
                    "staffAssignment": staff_assignment_doc,
                    "status": "Routed to Department",
                    "timeline": timeline
                }

                res = db["complaints"].update_one(filter_q, {"$set": update_data})
                if res.matched_count > 0:
                    print(f"[StaffAgent] [OK] Successfully assigned & saved complaint {c_id} to staff {staff_assignment_doc['staff_name']} in MongoDB ({db_name})")
                    return True
            except Exception as e:
                print(f"[StaffAgent] Error updating db {db_name}: {e}")
                continue
        return False
    except Exception as err:
        print(f"[StaffAgent] [WARN] Could not update complaint in DB: {err}")
        return False


# ── Flask server ─────────────────────────────────────────────────────────────

def create_app():
    try:
        from flask import Flask, request, jsonify
        from flask_cors import CORS
    except ImportError:
        print("[StaffAgent] Flask not installed. Run: pip install flask flask-cors")
        return None

    flask_app = Flask(__name__)
    CORS(flask_app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

    @flask_app.route("/assign-staff", methods=["GET", "POST", "OPTIONS"])
    def assign_staff_endpoint():
        if request.method == "OPTIONS":
            return jsonify({"status": "ok"}), 200
        try:
            payload = request.get_json(silent=True) or {}
            classification = payload.get("classification") or payload
            complaint_id = payload.get("complaintId") or classification.get("complaintId")

            result = assign_staff(classification)

            # If complaint context or ID is provided, persist assignment immediately to MongoDB
            if complaint_id and result.get("status") == "assigned":
                complaint_obj = {"complaintId": complaint_id}
                save_assignment_to_db(complaint_obj, result)

            return jsonify(result)
        except Exception as exc:
            print(f"[StaffAgent] /assign-staff error: {exc}")
            return jsonify({"error": str(exc)}), 500

    @flask_app.route("/health", methods=["GET"])
    def health():
        staff_count = len(load_staff_db())
        return jsonify({
            "status": "ok",
            "service": "staff-assignment-agent",
            "port": 8002,
            "api_key_configured": bool(API_KEY),
            "staff_count": staff_count,
            "models": MODELS,
        })

    return flask_app


# ── Continuous Real-Time Worker ──────────────────────────────────────────────

def process_unassigned_complaints() -> int:
    """Check MongoDB for any unassigned complaints, assign them with AI, and save back to DB."""
    complaints = load_pending_complaints(limit=10)
    if not complaints:
        return 0

    assigned_count = 0
    for complaint in complaints:
        try:
            classification = complaint_to_classification(complaint)
            result = assign_staff(classification)
            if result.get("status") == "assigned":
                saved = save_assignment_to_db(complaint, result)
                if saved:
                    assigned_count += 1
        except Exception as e:
            print(f"[StaffAgent] Worker error assigning complaint {complaint.get('complaintId')}: {e}")
    return assigned_count


def start_background_watcher():
    """Start a background daemon thread that continuously monitors for new complaints to assign."""
    import threading
    import time

    def _watcher_loop():
        print("[StaffAgent] [INFO] Live background watcher active — monitoring MongoDB for unassigned complaints...")
        # Process existing pending complaints immediately on startup
        try:
            initial = process_unassigned_complaints()
            if initial > 0:
                print(f"[StaffAgent] [OK] Processed and assigned {initial} initial complaints on startup.")
        except Exception as e:
            print(f"[StaffAgent] Initial batch assignment error: {e}")

        while True:
            time.sleep(4)
            try:
                process_unassigned_complaints()
            except Exception:
                pass

    t = threading.Thread(target=_watcher_loop, daemon=True)
    t.start()


# ── CLI entry point ──────────────────────────────────────────────────────────

def load_json_file(path: str) -> Dict[str, Any]:
    if not os.path.isabs(path):
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), path)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("Input file must be a JSON object.")
    return data


def load_pending_complaints(limit: int = 20) -> List[Dict[str, Any]]:
    """Load real unassigned complaints directly from MongoDB (backend database)."""
    uri = os.getenv("MONGO_URI", "").strip()
    if not uri:
        return []
    try:
        import pymongo
        client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=4000)
        for db_name in _get_db_names():
            try:
                db = client[db_name]
                if "complaints" not in db.list_collection_names():
                    continue
                docs = list(db["complaints"].find(
                    {"$or": [
                        {"staffAssignment": None},
                        {"staffAssignment": {"$exists": False}},
                        {"staffAssignment.staff_id": None},
                        {"staffAssignment.staff_id": ""},
                        {"status": "Verified"},
                        {"status": "Submitted"}
                    ],
                    "staffAssignment.status": {"$nin": ["Assigned", "Accepted", "In Progress", "Resolved"]}
                    },
                ).sort("createdAt", -1).limit(limit))
                if docs:
                    return docs
            except Exception:
                continue
        return []
    except Exception as mongo_err:
        return []


def complaint_to_classification(complaint: Dict[str, Any]) -> Dict[str, Any]:
    """Build a classification dict from a real complaint document."""
    cls = complaint.get("classification") or {}
    llm = complaint.get("llmAnalysis") or {}
    return {
        "problem_type": cls.get("problem_type") or complaint.get("category") or "Railway Issue",
        "category": complaint.get("category") or cls.get("category") or "Railway Complaint",
        "department": cls.get("department") or complaint.get("category") or "General",
        "departments": cls.get("departments") or [],
        "sub_department": cls.get("sub_department") or "",
        "location": complaint.get("location") or "",
        "urgency": cls.get("urgency") or llm.get("urgency") or "medium",
        "required_action": cls.get("required_action") or "",
        "action_steps": cls.get("action_steps") or llm.get("action_steps") or [],
        "confidence": cls.get("confidence"),
        "reason": cls.get("reason") or "",
        "trainNumber": complaint.get("trainNumber") or "",
        "coach": complaint.get("coach") or "",
        "pnr": complaint.get("pnr") or "",
        "passengerName": complaint.get("passengerName") or "Passenger",
        "complaintId": complaint.get("complaintId") or "",
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Rail Madad Staff Assignment Agent - OpenRouter AI"
    )
    parser.add_argument(
        "--input",
        default=None,
        help="Path to a classification agent output JSON. If omitted, real unassigned complaints are loaded from MongoDB.",
    )
    default_port = int(os.environ.get("PORT", os.environ.get("STAFF_ASSIGNMENT_PORT", 8002)))
    parser.add_argument(
        "--port",
        type=int,
        default=default_port,
        help=f"Port for Flask server (default: {default_port}).",
    )
    args = parser.parse_args()

    if args.input and os.path.exists(args.input):
        classification = load_json_file(args.input)
        result = assign_staff(classification)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    # Start the continuous live watcher in background
    start_background_watcher()

    # Start HTTP server on port 8002 so other services and frontend can trigger on demand
    flask_app = create_app()
    if flask_app is None:
        sys.exit(1)
    print(f"[StaffAgent] Starting live AI Staff Assignment service on port {args.port}...")
    print(f"[StaffAgent] POST http://localhost:{args.port}/assign-staff")
    print(f"[StaffAgent] GET  http://localhost:{args.port}/health")
    flask_app.run(host="0.0.0.0", port=args.port, debug=False)


if __name__ == "__main__":
    main()

