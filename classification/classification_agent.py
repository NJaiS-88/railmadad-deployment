import argparse
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional

from openai import OpenAI

# ── Load .env - backend/.env and root .env ──────────────────────────────────
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

# Use OPENROUTER_API_KEY
API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()

# OpenRouter model cascade
MODELS: List[str] = [
    "meta-llama/llama-3.3-70b-instruct",
    "meta-llama/llama-3.1-8b-instruct",
    "google/gemini-2.0-flash-001",
    "openai/gpt-4o-mini"
]

# ── Tool definitions for the agent loop ──────────────────────────────────────
CLASSIFICATION_TOOLS: List[Dict] = [
    {
        "type": "function",
        "function": {
            "name": "submit_classification",
            "description": (
                "Submit the final classification of the railway complaint. "
                "Call this ONCE when you are confident about the issue type, department, and routing."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "problem_type": {
                        "type": "string",
                        "description": (
                            "Precise snake_case issue type derived from the actual complaint. "
                            "Must reflect the specific real-world issue. "
                            "Examples: coach_toilet_not_flushing, platform_lighting_fault, "
                            "train_ac_not_working, pantry_food_quality_issue, escalator_breakdown, "
                            "ticketing_misconduct, passenger_medical_emergency, luggage_theft, "
                            "staff_misbehaviour, water_supply_failure, train_delay_signal_fault, "
                            "coach_window_broken, berth_latch_broken, coach_fan_not_working. "
                            "If no standard type fits, create a specific descriptive snake_case label."
                        ),
                    },
                    "category": {
                        "type": "string",
                        "description": "Human-readable category name derived from the actual complaint. E.g. 'Coach AC Failure', 'Platform Lighting Fault'.",
                    },
                    "department": {
                        "type": "string",
                        "description": "Primary department only. Must be one of the exact staff departments: Mechanical, Electrical, Commercial/Catering, Cleanliness/Housekeeping, Civil/Infrastructure, RPF/Security, Medical/Health, Operations/Train Control, Station Administration, Ticket Checking, IT/Systems.",
                    },
                    "departments": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "All relevant department(s) for this complaint. Use this when two or more departments are genuinely required. Every value must be one of the exact staff departments listed above.",
                    },
                    "sub_department": {
                        "type": "string",
                        "description": "Specific sub-team for precise routing, if applicable. E.g. 'AC Maintenance', 'Platform Lighting', 'Food Safety'.",
                    },
                    "location": {
                        "type": "string",
                        "description": "Exact location extracted from the complaint. E.g. 'Coach B3, Berth 42', 'Platform 3 staircase', 'Pantry Car'. Never return 'Not provided' unless truly absent.",
                    },
                    "urgency": {
                        "type": "string",
                        "enum": ["critical", "high", "medium", "low"],
                        "description": (
                            "Urgency calibrated from the complaint's actual impact — use the pre-assessed urgency field from the input as a guide but re-evaluate:\n"
                            "critical: life-threatening — fire, medical emergency, assault, derailment risk, gas leak.\n"
                            "high: serious but not critical — flooding washroom, AC failure in extreme heat, severe overcrowding, food poisoning.\n"
                            "medium: significant discomfort — dirty coach, minor leak, fan/light failure, food quality, train delay.\n"
                            "low: minor inconvenience — cosmetic damage, minor cleanliness feedback, suggestions."
                        ),
                    },
                    "required_action": {
                        "type": "string",
                        "description": "The single most important immediate action railway staff must take, derived from the complaint details.",
                    },
                    "action_steps": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Ordered list of 2–4 specific action steps to resolve this complaint. Use the pre-suggested steps from the input as a starting point.",
                    },
                    "confidence": {
                        "type": "number",
                        "description": "Classification confidence from 0.0 to 1.0.",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Concise explanation citing specific evidence from the complaint summary, keywords, and decision_reasoning that led to this classification.",
                    },
                    "escalation_required": {
                        "type": "boolean",
                        "description": "True if this complaint requires immediate escalation to a senior officer or zonal HQ.",
                    },
                    "manual_review_required": {
                        "type": "boolean",
                        "description": "True only when the case is ambiguous, conflicting, or requires human judgement. In all clear auto-verifiable cases this must be false.",
                    },
                },
                "required": [
                    "problem_type", "category", "department",
                    "location", "urgency", "required_action",
                    "action_steps", "confidence", "reason",
                    "manual_review_required",
                ],
            },
        },
    },
]

# ── Department normalization & allowed routing map ───────────────────────
# Keep in sync with backend/config/departments.js (DEPARTMENTS list).
VALID_DEPARTMENTS = [
    "Mechanical",
    "Electrical",
    "Commercial/Catering",
    "Cleanliness/Housekeeping",
    "Civil/Infrastructure",
    "RPF/Security",
    "Medical/Health",
    "Operations/Train Control",
    "Station Administration",
    "Ticket Checking",
    "IT/Systems",
    "Safety",
]

DEPARTMENT_ALIASES = {
    "mechanical": "Mechanical",
    "electrical": "Electrical",
    "commercial": "Commercial/Catering",
    "catering": "Commercial/Catering",
    "food": "Commercial/Catering",
    "food and catering": "Commercial/Catering",
    "commercial and catering": "Commercial/Catering",
    "cleanliness": "Cleanliness/Housekeeping",
    "housekeeping": "Cleanliness/Housekeeping",
    "sanitation": "Cleanliness/Housekeeping",
    "civil": "Civil/Infrastructure",
    "infrastructure": "Civil/Infrastructure",
    "security": "RPF/Security",
    "rpf": "RPF/Security",
    "medical": "Medical/Health",
    "health": "Medical/Health",
    "operations": "Operations/Train Control",
    "train control": "Operations/Train Control",
    "station": "Station Administration",
    "station administration": "Station Administration",
    "ticket": "Ticket Checking",
    "ticketing": "Ticket Checking",
    "ticket checking": "Ticket Checking",
    "it": "IT/Systems",
    "systems": "IT/Systems",
    "safety": "Safety",
    "fire safety": "Safety",
}


def normalize_department_selection(departments: List[Any]) -> List[str]:
    """Map any AI department suggestion to the exact live department names used by staff."""
    normalized: List[str] = []
    seen = set()

    for raw in departments or []:
        if raw is None:
            continue
        text = str(raw).strip()
        if not text:
            continue
        key = re.sub(r"\s+", " ", text.lower().replace("_", " ").replace("-", " ")).strip()
        mapped = DEPARTMENT_ALIASES.get(key)
        if mapped:
            candidate = mapped
        else:
            candidate = next((dept for dept in VALID_DEPARTMENTS if dept.lower() == key.lower()), None)
            if candidate is None:
                candidate = next((dept for dept in VALID_DEPARTMENTS if key in dept.lower() or dept.lower() in key), None)
            if candidate is None:
                candidate = next((dept for dept in VALID_DEPARTMENTS if any(word in key for word in dept.lower().split() if word not in {"the", "and"})), None)
            if candidate is None:
                candidate = "Operations/Train Control"
        if candidate not in seen:
            normalized.append(candidate)
            seen.add(candidate)

    if not normalized:
        return ["Operations/Train Control"]

    return normalized


SYSTEM_PROMPT = """You are the Classification Agent in the Rail Madad AI pipeline for Indian Railways.

You receive the output of an AI analysis step that has already processed a passenger complaint from one or more modalities (text, audio transcript, image caption, video description). Your task is to classify the complaint into the precise issue type and assign the correct operational routing.

CRITICAL RULES:
1. Use ONLY the allowed staff categories in the project: Mechanical, Electrical, Commercial/Catering, Cleanliness/Housekeeping, Civil/Infrastructure, RPF/Security, Medical/Health, Operations/Train Control, Station Administration, Ticket Checking, IT/Systems.
2. If the complaint involves more than one real railway area, return multiple departments in a list. Do not collapse all issues into one department when two or more departments are clearly involved.
3. Auto-route only when the complaint is clear, coherent, and actionable. If the issue is ambiguous, contradictory, or requires human interpretation, set manual_review_required = true and do not pretend the case is auto-verifiable.
4. Do not invent departments or use generic labels that do not exist in the staff roster.
5. The AI must prefer the closest matching staff departments based on the reported issue details, not a broad category.
6. Specify the actual issue type as a specific snake_case problem_type such as coach_ac_failure, seat_latch_broken, pantry_food_quality_issue, platform_lighting_fault, passenger_harassment, ticketing_misconduct, water_supply_failure, train_delay_signal_fault, medical_emergency, toilet_cleanliness_issue, escalator_not_working, etc.
7. Re-evaluate urgency from actual complaint content, using the pre-assessed urgency as a guide only.
8. The final output must be a JSON object with keys: problem_type, category, departments, location, urgency, required_action, action_steps, confidence, reason, escalation_required, manual_review_required.
9. Do NOT return placeholder values. Use only evidence from the actual complaint.
10. If the issue is clearly valid and executable, `manual_review_required` must be false and the complaint can be auto-verified and auto-assigned.
11. If it is not auto-verify safe, `manual_review_required` must be true and officers handle classification and staff selection.

You will receive a JSON object with these fields from the analysis step:
- are_texts_related: coherence check across input modalities
- urgency: pre-assessed urgency level with explanation
- decision_reasoning: the AI's reasoning for its conclusions
- missing_info: any information still needed from the passenger
- keywords: key terms extracted from the complaint
- summary: structured breakdown of the complaint (may be a dict or string)
- action_steps: suggested resolution steps from the analysis
- has_issue: boolean confirming a genuine issue was detected

Also may include journey metadata: trainNumber, coach, pnr, passengerName, location.

Use the closest real department(s) available in the staff roster and always call submit_classification with the final answer."""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _str(v: Any) -> str:
    if v is None:
        return ""
    return str(v).strip()


def _flatten(v: Any, depth: int = 0) -> str:
    """Recursively flatten dict / list to readable plain text."""
    if depth > 5:
        return _str(v)
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, dict):
        return "\n".join(
            f"{k}: {_flatten(item, depth + 1)}"
            for k, item in v.items()
            if _flatten(item, depth + 1)
        )
    if isinstance(v, list):
        return "\n".join(
            f"- {_flatten(item, depth + 1)}"
            for item in v
            if _flatten(item, depth + 1)
        )
    return _str(v)


def build_agent_message(payload: Dict[str, Any]) -> str:
    """
    Convert the llmAnalysis output (or any complaint payload) into a
    structured prompt for the classification agent.

    The canonical input shape is the llmAnalysis object:
      are_texts_related, urgency, decision_reasoning, missing_info,
      keywords, summary (dict), action_steps (list), has_issue
    
    But we also handle wrappers where these fields sit inside a
    'llmAnalysis' key alongside trainNumber, coach, pnr, etc.
    """
    # Unwrap if the whole complaint object is passed with llmAnalysis nested
    llm = payload.get("llmAnalysis")
    if isinstance(llm, str):
        try:
            llm = json.loads(llm)
        except Exception:
            llm = {}
    # If the llmAnalysis sub-object exists, merge it with the outer payload for convenience
    if isinstance(llm, dict) and llm:
        merged = {**llm, **{k: v for k, v in payload.items() if k != "llmAnalysis"}}
    else:
        merged = payload

    lines = ["=== COMPLAINT ANALYSIS FOR CLASSIFICATION ===\n"]

    # Journey metadata
    meta = {}
    for key, label in [
        ("trainNumber", "Train Number"), ("train_number", "Train Number"),
        ("coach", "Coach"), ("pnr", "PNR"),
        ("passengerName", "Passenger Name"), ("passenger_name", "Passenger Name"),
        ("location", "Location"), ("station", "Station"),
    ]:
        val = _str(merged.get(key))
        if val and label not in meta:
            meta[label] = val
    if meta:
        lines.append("--- Journey Metadata ---")
        for label, val in meta.items():
            lines.append(f"{label}: {val}")
        lines.append("")

    # has_issue gate
    has_issue = merged.get("has_issue")
    if has_issue is not None:
        lines.append(f"Has Issue Confirmed: {has_issue}\n")

    # are_texts_related
    related = _str(merged.get("are_texts_related"))
    if related:
        lines.append(f"Input Coherence: {related}\n")

    # Urgency (pre-assessed)
    urgency = _str(merged.get("urgency"))
    if urgency:
        lines.append(f"Pre-Assessed Urgency: {urgency}\n")

    # decision_reasoning
    reasoning = _str(merged.get("decision_reasoning"))
    if reasoning:
        lines.append(f"AI Decision Reasoning:\n{reasoning}\n")

    # keywords
    kw = merged.get("keywords", [])
    if isinstance(kw, list) and kw:
        lines.append(f"Keywords: {', '.join(_str(k) for k in kw)}\n")
    elif isinstance(kw, str) and kw:
        lines.append(f"Keywords: {kw}\n")

    # summary
    summary = merged.get("summary")
    if summary:
        lines.append("--- Complaint Summary ---")
        lines.append(_flatten(summary))
        lines.append("")

    # action_steps
    steps = merged.get("action_steps", [])
    if steps:
        lines.append("--- Suggested Action Steps ---")
        lines.append(_flatten(steps))
        lines.append("")

    # missing_info
    missing = _str(merged.get("missing_info"))
    if missing and "none" not in missing.lower():
        lines.append(f"Missing Information: {missing}\n")

    # Raw description / text (if present alongside analysis)
    for key in ("description", "text"):
        val = _str(merged.get(key))
        if val:
            lines.append(f"--- Passenger Raw Description ---\n{val}\n")
            break

    # Media captions if present
    ai_conv = merged.get("aiConversions") or {}
    for media_key, label in [
        ("imageText", "Image Caption"),
        ("audioText", "Audio Transcript"),
        ("videoText", "Video Description"),
    ]:
        val = _str(ai_conv.get(media_key)) or _str(merged.get(media_key))
        if val:
            lines.append(f"--- {label} ---\n{val}\n")

    lines.append("=== END OF ANALYSIS ===")
    lines.append("")
    lines.append(
        "Based on the above analysis, call submit_classification with "
        "precise values derived entirely from the actual complaint content above. "
        "Do NOT use placeholder, example, or generic values."
    )
    return "\n".join(lines)


def _extract_tool_call(msg) -> Optional[Dict]:
    """Pull the first tool call from an LLM response message."""
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
    """Try to extract a JSON object from raw LLM text (fallback for models without tool_choice)."""
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


# ── Core Agent Function ───────────────────────────────────────────────────────

def classify_complaint(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Agentic classification of a railway complaint.

    Input (payload) — the LLM analysis output from /analyze-complaint:
        are_texts_related: str
        urgency: str
        decision_reasoning: str
        missing_info: str
        keywords: list[str]
        summary: dict or str
        action_steps: list[str]
        has_issue: bool

    Plus optional journey metadata (trainNumber, coach, pnr, location, etc.)
    and optional aiConversions (imageText, audioText, videoText).

    Returns a classification dict:
        problem_type, category, department, sub_department, location,
        urgency, required_action, action_steps, confidence, reason,
        escalation_required
    """
    # Guard: if has_issue is explicitly False, return no-op classification
    if payload.get("has_issue") is False:
        return {
            "problem_type": "no_issue_detected",
            "category": "No Issue Detected",
            "department": "Operations/Train Control",
            "departments": ["Operations/Train Control"],
            "sub_department": "",
            "location": _str(payload.get("location") or payload.get("coach") or "Not specified"),
            "urgency": "low",
            "required_action": "No action required — no issue detected in this submission.",
            "action_steps": [],
            "confidence": 0.95,
            "reason": "The AI analysis determined no genuine railway issue is present.",
            "escalation_required": False,
            "manual_review_required": False,
        }

    if not API_KEY:
        return {
            "problem_type": "classification_unavailable",
            "category": "Classification Unavailable",
            "department": "Operations/Train Control",
            "departments": ["Operations/Train Control"],
            "sub_department": "",
            "location": _str(payload.get("location") or "Not specified"),
            "urgency": "medium",
            "required_action": "Configure OPENROUTER_API_KEY in environment to enable AI classification.",
            "action_steps": ["Set OPENROUTER_API_KEY environment variable."],
            "confidence": 0.0,
            "reason": "OpenRouter API key not configured.",
            "escalation_required": False,
            "manual_review_required": True,
            "error": "OPENROUTER_API_KEY not set",
        }

    client = OpenAI(base_url=API_BASE_URL, api_key=API_KEY, timeout=30.0, max_retries=0)
    user_message = build_agent_message(payload)
    base_messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]

    classification_result: Optional[Dict] = None
    last_error: Optional[str] = None

    for model in MODELS:
        if classification_result:
            break
        try:
            print(f"[ClassificationAgent] Trying model: {model}")
            messages = list(base_messages)

            for turn in range(4):  # up to 4 turns per model
                try:
                    resp = client.chat.completions.create(
                        model=model,
                        messages=messages,
                        tools=CLASSIFICATION_TOOLS,
                        tool_choice={"type": "function", "function": {"name": "submit_classification"}},
                        temperature=0.2,
                        top_p=0.9,
                        max_tokens=1024,
                        stream=False,
                    )
                except Exception:
                    # Fallback if model doesn't support tool_choice forcing
                    try:
                        resp = client.chat.completions.create(
                            model=model,
                            messages=messages,
                            tools=CLASSIFICATION_TOOLS,
                            tool_choice="auto",
                            temperature=0.2,
                            top_p=0.9,
                            max_tokens=1024,
                            stream=False,
                        )
                    except Exception:
                        # Last resort: plain JSON output
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

                # ── Tool-call path ────────────────────────────────────────
                if tool_call and tool_call["name"] == "submit_classification":
                    classification_result = tool_call["args"]
                    print(f"[ClassificationAgent] ✅ Got tool-call result on turn {turn + 1}")
                    break

                if tool_call:
                    # Agent called a different tool or is reasoning — append and continue
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

                # ── Plain-text JSON fallback ───────────────────────────────
                raw = _str(msg.content)
                if raw:
                    parsed = _parse_json_text(raw)
                    if parsed and "problem_type" in parsed:
                        classification_result = parsed
                        print(f"[ClassificationAgent] ✅ Parsed plain-JSON on turn {turn + 1}")
                        break

                # No usable output this turn — stop for this model
                break

        except Exception as err:
            last_error = str(err)
            print(f"[ClassificationAgent] Model {model} error: {err}")
            continue

    # ── Fallback: build result from the payload itself if all models fail ─────
    if not classification_result:
        llm = payload.get("llmAnalysis") or payload
        if isinstance(llm, str):
            try:
                llm = json.loads(llm)
            except Exception:
                llm = payload

        urgency_raw = _str(llm.get("urgency") or payload.get("urgency") or "medium").lower()
        urgency = "medium"
        for lvl in ("critical", "high", "medium", "low"):
            if lvl in urgency_raw:
                urgency = lvl
                break

        steps = llm.get("action_steps") or []
        classification_result = {
            "problem_type": "railway_complaint_pending_classification",
            "category": _str(payload.get("category")) or "Railway Complaint",
            "department": "Operations/Train Control",
            "departments": ["Operations/Train Control"],
            "sub_department": "",
            "location": _str(payload.get("location") or payload.get("coach") or payload.get("station") or "Not specified"),
            "urgency": urgency,
            "required_action": "Review complaint and dispatch appropriate team",
            "action_steps": steps if isinstance(steps, list) else [steps],
            "confidence": 0.3,
            "reason": f"Fallback: all LLM models unavailable. Last error: {last_error or 'unknown'}",
            "escalation_required": urgency in ("critical", "high"),
            "manual_review_required": True,
        }

    # ── Normalise output ──────────────────────────────────────────────────────
    result = dict(classification_result)

    # Fill any missing required fields with safe defaults
    result.setdefault("problem_type", "railway_complaint")
    result.setdefault("category", "Railway Complaint")
    result.setdefault("department", "Operations/Train Control")
    result.setdefault("departments", ["Operations/Train Control"])
    result.setdefault("sub_department", "")
    result.setdefault("location", "Not specified")
    result.setdefault("urgency", "medium")
    result.setdefault("required_action", "Review and assign to appropriate team")
    result.setdefault("action_steps", [])
    result.setdefault("confidence", 0.5)
    result.setdefault("reason", "Classified by AI agent")
    result.setdefault("escalation_required", False)
    result.setdefault("manual_review_required", False)

    # Normalise urgency to lowercase enum
    result["urgency"] = _str(result["urgency"]).lower()
    if result["urgency"] not in ("critical", "high", "medium", "low"):
        for lvl in ("critical", "high", "medium", "low"):
            if lvl in result["urgency"]:
                result["urgency"] = lvl
                break
        else:
            result["urgency"] = "medium"

    if "departments" not in result or not isinstance(result["departments"], list):
        primary = _str(result.get("department") or "Operations/Train Control")
        result["departments"] = normalize_department_selection([primary])
    else:
        result["departments"] = normalize_department_selection(result["departments"])

    result["department"] = result["departments"][0] if result["departments"] else "Operations/Train Control"
    result["manual_review_required"] = bool(result.get("manual_review_required"))

    # Normalise problem_type to valid snake_case
    pt = re.sub(r"[^a-z0-9]+", "_", _str(result["problem_type"]).lower()).strip("_")
    result["problem_type"] = pt or "railway_complaint"

    # Escalation should be True for critical urgency
    result["escalation_required"] = bool(
        result.get("escalation_required") or result["urgency"] == "critical"
    )

    # Ensure action_steps is always a list
    if not isinstance(result["action_steps"], list):
        result["action_steps"] = [_str(result["action_steps"])] if result["action_steps"] else []

    print(f"[ClassificationAgent] Result: {json.dumps(result, indent=2, ensure_ascii=False)}")
    return result


# ── MongoDB & Dynamic Data Loading ─────────────────────────────────────────────

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
    seen: set = set()
    unique: List[str] = []
    for n in names:
        if n and n not in seen:
            seen.add(n)
            unique.append(n)
    return unique


def load_pending_complaints(limit: int = 20) -> List[Dict[str, Any]]:
    """Load real complaints directly from MongoDB (backend database)."""
    uri = os.getenv("MONGO_URI", "").strip()
    if not uri:
        print("[ClassificationAgent] [WARN] MONGO_URI not configured in .env")
        return []
    try:
        import pymongo
        client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=4000)
        for db_name in _get_db_names():
            try:
                db = client[db_name]
                if "complaints" not in db.list_collection_names():
                    continue
                # 1. First priority: complaints missing classification
                docs = list(db["complaints"].find(
                    {"$or": [
                        {"classification": None},
                        {"classification": {"$exists": False}},
                        {"classification.problem_type": {"$exists": False}},
                        {"classification.problem_type": "railway_complaint_pending_classification"},
                    ]},
                ).sort("createdAt", -1).limit(limit))
                if docs:
                    print(f"[ClassificationAgent] [OK] Loaded {len(docs)} unclassified complaints from MongoDB ({db_name})")
                    return docs
            except Exception:
                continue

        # 2. If all complaints already have classification, load recent complaints
        for db_name in _get_db_names():
            try:
                db = client[db_name]
                if "complaints" in db.list_collection_names():
                    docs = list(db["complaints"].find().sort("createdAt", -1).limit(limit))
                    if docs:
                        print(f"[ClassificationAgent] [OK] Loaded {len(docs)} recent complaints from MongoDB ({db_name})")
                        return docs
            except Exception:
                continue

        print("[ClassificationAgent] [INFO] No complaints found in MongoDB database.")
        return []
    except Exception as mongo_err:
        print(f"[ClassificationAgent] [WARN] MongoDB query error: {mongo_err}")
        return []


def complaint_to_payload(complaint: Dict[str, Any]) -> Dict[str, Any]:
    """Build classification input payload from a MongoDB complaint document."""
    llm = complaint.get("llmAnalysis") or {}
    if isinstance(llm, str):
        try:
            llm = json.loads(llm)
        except Exception:
            llm = {}
    payload = dict(llm) if isinstance(llm, dict) else {}
    payload["trainNumber"] = complaint.get("trainNumber", "")
    payload["coach"] = complaint.get("coach", "")
    payload["pnr"] = complaint.get("pnr", "")
    payload["passengerName"] = complaint.get("passengerName", "Passenger")
    payload["passengerPhone"] = complaint.get("passengerPhone", "")
    payload["description"] = complaint.get("description", "")
    payload["category"] = complaint.get("category", "")
    payload["complaintId"] = complaint.get("complaintId", "")
    if complaint.get("location"):
        payload["location"] = complaint.get("location")
    if complaint.get("aiConversions"):
        payload["aiConversions"] = complaint.get("aiConversions")
    if not payload.get("summary") and complaint.get("description"):
        payload["summary"] = complaint.get("description")
    return payload


def save_classification_to_db(complaint: Dict[str, Any], classification: Dict[str, Any]) -> bool:
    """Save classification result directly back to the complaint in MongoDB."""
    uri = os.getenv("MONGO_URI", "").strip()
    c_id = complaint.get("complaintId") or complaint.get("_id")
    if not uri or not c_id:
        return False
    try:
        import pymongo
        client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=4000)
        for db_name in _get_db_names():
            try:
                db = client[db_name]
                if "complaints" in db.list_collection_names():
                    filter_q = {"complaintId": c_id} if complaint.get("complaintId") else {"_id": c_id}
                    update_fields = {
                        "classification": {
                            **classification,
                            "departments": classification.get("departments", [classification.get("department", "Operations/Train Control")]),
                            "manual_review_required": bool(classification.get("manual_review_required")),
                        },
                        "category": classification.get("category") or complaint.get("category", "General Complaint"),
                        "manual_review_required": bool(classification.get("manual_review_required")),
                    }
                    urg = (classification.get("urgency") or "").lower()
                    if "critical" in urg or "high" in urg:
                        update_fields["severity"] = "High"
                    elif "low" in urg:
                        update_fields["severity"] = "Low"

                    res = db["complaints"].update_one(filter_q, {"$set": update_fields})
                    if res.matched_count > 0:
                        print(f"[ClassificationAgent] [OK] Successfully updated complaint {c_id} in MongoDB ({db_name})")
                        # Instantly notify Staff Assignment Agent to process assignment
                        notify_staff_assignment_agent(str(c_id), classification)
                        return True
            except Exception:
                continue
        return False
    except Exception as err:
        print(f"[ClassificationAgent] [WARN] Could not update complaint in DB: {err}")
        return False


def notify_staff_assignment_agent(complaint_id: str, classification: Dict[str, Any]):
    """Immediately alert the Staff Assignment Agent (port 8002) after classification."""
    if not complaint_id:
        return
    try:
        import urllib.request
        req_data = json.dumps({
            "complaintId": complaint_id,
            "classification": classification
        }).encode("utf-8")
        staff_url = os.environ.get("STAFF_ASSIGNMENT_URL", "http://localhost:8002/assign-staff")
        req = urllib.request.Request(
            staff_url,
            data=req_data,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                print(f"[ClassificationAgent] 🚀 Instantly triggered Staff Assignment Agent for complaint {complaint_id}")
    except Exception:
        # Background worker in staff_assignment_agent will also pick it up automatically
        pass



# ── CLI & File helper ─────────────────────────────────────────────────────────

def load_input(path: str) -> Dict[str, Any]:
    if not os.path.isabs(path):
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), path)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("Input file must contain a JSON object.")
    return data


# ── Flask server (default when run as: python classification_agent.py) ─────────

def create_app():
    try:
        from flask import Flask, request, jsonify
        from flask_cors import CORS
    except ImportError:
        print("[ClassificationAgent] Flask not installed. Run: pip install flask flask-cors")
        return None

    flask_app = Flask(__name__)
    CORS(flask_app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

    @flask_app.route("/classify-complaint", methods=["GET", "POST", "OPTIONS"])
    def classify_endpoint():
        from flask import request, jsonify
        if request.method == "OPTIONS":
            return jsonify({"status": "ok"}), 200
        try:
            payload = request.get_json(silent=True) or {}
            c_train = payload.get("trainNumber") or "N/A"
            c_coach = payload.get("coach") or "N/A"
            c_pnr = payload.get("pnr") or "N/A"
            c_name = payload.get("passengerName") or "Passenger"
            print("\n" + "=" * 60)
            print(f"🔍 [ClassificationAgent] 📥 Incoming Real Complaint from Website Flow:")
            print(f"   Train: {c_train} | Coach: {c_coach} | PNR: {c_pnr} | Passenger: {c_name}")
            print(f"   Pre-Assessed Urgency: {payload.get('urgency', 'N/A')}")
            print("=" * 60)

            result = classify_complaint(payload)

            print("\n" + "=" * 60)
            print(f"✅ [ClassificationAgent] 📤 Classification Complete:")
            print(f"   Problem Type: {result.get('problem_type')}")
            print(f"   Category:     {result.get('category')}")
            print(f"   Department:   {result.get('department')} (Departments: {result.get('departments')})")
            print(f"   Urgency:      {result.get('urgency')}")
            print(f"   Action:       {result.get('required_action')}")
            print(f"   Manual Review:{result.get('manual_review_required')}")
            print("=" * 60 + "\n")
            return jsonify(result)
        except Exception as exc:
            print(f"[ClassificationAgent] /classify-complaint error: {exc}")
            return jsonify({"error": str(exc)}), 500

    @flask_app.route("/health", methods=["GET"])
    def health():
        from flask import jsonify
        return jsonify({
            "status": "ok",
            "service": "classification-agent",
            "port": 8001,
            "api_key_configured": bool(API_KEY),
            "models": MODELS,
        })

    return flask_app


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Railway Complaint Classification Agent — OpenRouter AI"
    )
    parser.add_argument(
        "--input",
        default=None,
        help="Optional path to JSON file for single-file testing.",
    )
    parser.add_argument(
        "--batch",
        action="store_true",
        help="Run batch processing directly on unclassified complaints in MongoDB instead of starting the live server.",
    )
    default_port = int(os.environ.get("PORT", os.environ.get("CLASSIFICATION_PORT", 8001)))
    parser.add_argument(
        "--port",
        type=int,
        default=default_port,
        help=f"Port for the live service (default: {default_port}).",
    )
    args = parser.parse_args()

    # File testing mode
    if args.input:
        if not os.path.exists(args.input) and not os.path.isabs(args.input):
            candidate = os.path.join(os.path.dirname(os.path.abspath(__file__)), args.input)
            if os.path.exists(candidate):
                args.input = candidate
        if os.path.exists(args.input):
            payload = load_input(args.input)
            result = classify_complaint(payload)
            print(json.dumps(result, indent=2, ensure_ascii=False))
            return
        else:
            print(f"[ClassificationAgent] [ERROR] Specified input file '{args.input}' not found.")
            sys.exit(1)

    # Database batch mode (only if explicitly requested with --batch)
    if args.batch:
        print("[ClassificationAgent] Batch mode: Connecting to MongoDB database for unclassified complaints...")
        complaints = load_pending_complaints()
        if not complaints:
            print("[ClassificationAgent] No pending complaints found in database.")
            return

        for comp in complaints:
            c_id = comp.get("complaintId") or comp.get("_id") or "Unknown"
            print(f"\n[ClassificationAgent] ───────────────────────────────────────────")
            print(f"[ClassificationAgent] Processing complaint: {c_id}")
            payload = complaint_to_payload(comp)
            result = classify_complaint(payload)
            save_classification_to_db(comp, result)
            summary = {
                "complaintId": c_id,
                "problem_type": result.get("problem_type"),
                "category": result.get("category"),
                "department": result.get("department"),
                "departments": result.get("departments"),
                "urgency": result.get("urgency"),
                "location": result.get("location"),
                "required_action": result.get("required_action"),
                "confidence": result.get("confidence"),
            }
            print(f"[ClassificationAgent] Output for {c_id}:")
            print(json.dumps(summary, indent=2, ensure_ascii=False))
        return

    # Default mode: Start live microservice on port 8001 connected to the website pipeline
    flask_app = create_app()
    if flask_app is None:
        sys.exit(1)
    print("\n" + "=" * 65)
    print(f"🚀 [ClassificationAgent] Running Live Service on Port {args.port}")
    print(f"   Ready to receive real-time complaints from RailMadad website flow.")
    print(f"   Endpoint: POST http://localhost:{args.port}/classify-complaint")
    print(f"   Health:   GET  http://localhost:{args.port}/health")
    print("=" * 65 + "\n")
    flask_app.run(host="0.0.0.0", port=args.port, debug=False)


if __name__ == "__main__":
    main()



