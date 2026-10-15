"""
twilio_whatsapp/server.py
════════════════════════════════════════════════════════════════════
RailMadad — Twilio WhatsApp Complaint Intake Agent
────────────────────────────────────────────────────────────────────
Flow:
  1. Passenger sends WhatsApp message to Twilio WhatsApp number → /whatsapp/incoming
  2. Greeting + AI conversational turn (meta-llama/llama-3.1-8b-instruct on OpenRouter AI)
  3. Guides conversation step-by-step:
     - Registered Mobile Number
     - Train Number or Name
     - Coach Number (e.g. B4, S3, A1)
     - PNR Number (10-digit)
     - Issue Description
     - Explicit "Anything else to add?" check
  4. When complete → POST to Express backend /api/complaints/internal
  5. Links passenger phone to MongoDB user account
  6. Triggers async LLM Triage analysis in background
  7. Sends WhatsApp confirmation with official Complaint ID (RMDA...)
════════════════════════════════════════════════════════════════════
"""

import os
import re
import json
import logging
import requests
import threading
from flask import Flask, request, Response, jsonify
from flask_cors import CORS
from twilio.rest import Client as TwilioClient
from twilio.twiml.messaging_response import MessagingResponse

# ── Load .env from parent directory ───────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    print("✅ .env loaded for WhatsApp agent")
except ImportError:
    print("⚠️ python-dotenv not installed — env vars must be set manually")

# ── Configuration ─────────────────────────────────────────────────
TWILIO_ACCOUNT_SID  = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN   = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_NUM = os.environ.get("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")
OPENROUTER_API_KEY  = os.environ.get("OPENROUTER_API_KEY", "")
BACKEND_API_URL     = os.environ.get("BACKEND_API_URL", "http://127.0.0.1:5000/api")
ML_SERVICE_URL      = os.environ.get("ML_SERVICE_URL", "http://127.0.0.1:8000")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) if (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN) else None

app = Flask(__name__)
CORS(app)

def transcribe_recording(recording_url: str) -> str:
    """Downloads audio file and transcribes via Whisper ML service."""
    try:
        audio_resp = requests.get(
            recording_url + ".mp3",
            auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
            timeout=10
        )
        audio_resp.raise_for_status()
        import base64
        audio_b64 = "data:audio/mp3;base64," + base64.b64encode(audio_resp.content).decode("utf-8")
        ml_resp = requests.post(f"{ML_SERVICE_URL}/transcribe-audio", json={"audio": audio_b64}, timeout=15)
        if ml_resp.ok:
            return ml_resp.json().get("text", "").strip()
        return ""
    except Exception:
        return ""


def caption_image_url(image_url: str) -> tuple[str, str]:
    """Downloads WhatsApp photo and analyzes via AI Vision /caption-image."""
    try:
        resp = requests.get(image_url, auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN), timeout=10)
        resp.raise_for_status()
        import base64
        data_uri = f"data:image/jpeg;base64,{base64.b64encode(resp.content).decode('utf-8')}"
        ml_resp = requests.post(f"{ML_SERVICE_URL}/caption-image", json={"image": data_uri}, timeout=15)
        caption = ml_resp.json().get("caption", "").strip() if ml_resp.ok else ""
        return data_uri, caption
    except Exception:
        return "", ""

SYSTEM_PROMPT = """You are RailMadad WhatsApp Voice & Text Assistant, a warm, polite, and empathetic Indian Railways helpline agent.
Your job is to collect a passenger's complaint over WhatsApp in a helpful, conversational manner.

Required Information to collect:
1. Registered Mobile Number (used on Rail Madad app/website)
2. Train Number or Name
3. Coach Number (e.g. B4, S3, A1)
4. PNR Number (10-digit)
5. Issue Description (what problem the passenger is facing)

Rules:
- Speak warmly, politely, and conversationally in 1-2 short, pleasant sentences.
- Always ask for the Registered Mobile Number first.
- Ask for only ONE missing detail per turn.
- If the passenger gives multiple details at once, extract all of them.
- After receiving the issue description, ALWAYS ask politely: "Thank you for sharing that. Is there anything else you would like to add or tell us about your complaint?"
- If the passenger provides extra details, add them to the description. If they say no/nothing else, proceed to finalize.
- Set "is_complete" to true ONLY after all 5 details are collected and the passenger has responded to the "anything else" check.
- Always maintain an empathetic, respectful, and courteous tone.

Return ONLY a valid JSON object in this EXACT format (no markdown, no preamble):
{
  "next_question": "Your warm, polite response and next question for the caller",
  "is_complete": false,
  "collected": {
    "registeredPhone": "extracted registered mobile number or empty string",
    "trainNumber": "extracted train number or empty string",
    "coach": "extracted coach number or empty string",
    "pnr": "extracted 10-digit PNR or empty string",
    "description": "extracted issue description or empty string"
  }
}"""


def rule_based_fallback_turn(user_message: str, current_collected: dict) -> dict:
    """Instant 1ms rule-based extractor fallback."""
    collected = dict(current_collected)
    digits_only = "".join(re.findall(r'\d+', user_message))
    msg_lower = user_message.lower().strip()

    had_phone = bool(current_collected.get("registeredPhone"))
    had_pnr   = bool(current_collected.get("pnr"))
    had_train = bool(current_collected.get("trainNumber"))
    had_coach = bool(current_collected.get("coach"))

    # 1. Registered Phone
    if not collected.get("registeredPhone"):
        phone_match = re.search(r'\b\d{10}\b', digits_only)
        if phone_match:
            collected["registeredPhone"] = phone_match.group(0)

    # 2. PNR (10 digits)
    if not collected.get("pnr") and collected.get("registeredPhone"):
        pnr_match = re.search(r'\b\d{10}\b', digits_only)
        if pnr_match and pnr_match.group(0) != collected.get("registeredPhone"):
            collected["pnr"] = pnr_match.group(0)

    # 3. Coach (e.g. S3, B4, A1, H1, D4, SL)
    if not collected.get("coach"):
        coach_match = re.search(r'\b(A\d|B\d|S\d|H\d|C\d|D\d|SL|2A|3A|1A)\b', user_message, re.IGNORECASE)
        if coach_match:
            collected["coach"] = coach_match.group(0).upper()

    # 4. Train Number (3 to 5 digits)
    if not collected.get("trainNumber"):
        train_match = re.search(r'\b\d{3,5}\b', user_message)
        if train_match and train_match.group(0) != collected.get("registeredPhone") and train_match.group(0) != collected.get("pnr"):
            collected["trainNumber"] = train_match.group(0)

    # 5. Description — ONLY collect if PNR, Train, Coach were ALREADY present before this turn
    if had_phone and had_pnr and had_train and had_coach and not collected.get("description"):
        if len(user_message.strip()) > 3 and not any(kw in msg_lower for kw in ["no", "nothing", "that's all", "that is all"]):
            collected["description"] = user_message.strip()

    # Determine missing field and next question
    if not collected.get("registeredPhone"):
        next_q = "Hello! Welcome to Rail Madad WhatsApp helpline 🚂. Could you please share your registered 10-digit mobile number so I can link your account?"
    elif not collected.get("trainNumber"):
        next_q = "Thank you so much! May I please have your Train Number or Train Name?"
    elif not collected.get("coach"):
        next_q = "Got it! Could you also kindly share your Coach Number (for example B4, S3, or A1)?"
    elif not collected.get("pnr"):
        next_q = "Thank you! Could you please provide your 10-digit PNR Number?"
    elif not collected.get("description"):
        next_q = "I am sorry to hear you are experiencing trouble. Could you please describe the issue you are facing in detail?"
    elif "anything_else_asked" not in collected:
        collected["anything_else_asked"] = "true"
        next_q = "Thank you for explaining that. Is there anything else you would like to tell us or add about your issue?"
    else:
        if any(kw in msg_lower for kw in ["yes", "also", "and"]):
            collected["description"] = collected.get("description", "") + ". " + user_message.strip()
        next_q = "Thank you so much for providing all the details! Registering your complaint now."

    is_complete = all(bool(collected.get(k)) for k in ["registeredPhone", "trainNumber", "coach", "pnr", "description"]) and (collected.get("anything_else_asked") == "true")

    return {
        "next_question": next_q,
        "is_complete": is_complete,
        "collected": collected
    }


def whatsapp_conversation_turn(history: list, user_message: str, current_collected: dict) -> dict:
    """Send conversation turn to OpenRouter AI (Llama 3.1 8B model)."""
    try:
        from openai import OpenAI
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
            timeout=10.0,
            max_retries=1
        )

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for turn in history:
            messages.append({"role": turn["role"], "content": turn["content"]})

        context_note = f"\n\n[Already collected so far: {json.dumps(current_collected)}]"
        messages.append({"role": "user", "content": user_message + context_note})

        fast_models = [
            "meta-llama/llama-3.1-8b-instruct",
            "meta-llama/llama-3.3-70b-instruct",
            "google/gemini-2.0-flash-001"
        ]

        raw = None
        for model_name in fast_models:
            try:
                completion = client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    response_format={"type": "json_object"},
                    temperature=0.1,
                    max_tokens=200,
                    stream=False
                )
                raw = completion.choices[0].message.content.strip()
                if raw:
                    break
            except Exception:
                continue

        if not raw:
            raise RuntimeError("NIM timeout")

        json_match = re.search(r'\{[\s\S]*\}', raw)
        if json_match:
            raw = json_match.group(0)

        parsed = json.loads(raw)
        collected = parsed.get("collected", {})
        if isinstance(collected, dict):
            for k, v in collected.items():
                collected[k] = str(v) if v is not None else ""
            parsed["collected"] = collected

        return parsed

    except Exception:
        return rule_based_fallback_turn(user_message, current_collected)


def _run_async_llm_analysis(complaint_id: str, collected: dict, conversation_text: str, registered_phone: str):
    """Runs LLM Triage analysis in background thread and updates MongoDB."""
    try:
        logger.info("🧠 Running background LLM Triage for WhatsApp complaint %s...", complaint_id)
        ml_endpoints = [
            f"{ML_SERVICE_URL.rstrip('/')}/analyze-complaint",
            "http://127.0.0.1:8000/analyze-complaint",
            "http://localhost:8000/analyze-complaint"
        ]
        analysis_resp = None
        for ml_ep in ml_endpoints:
            try:
                analysis_resp = requests.post(
                    ml_ep,
                    json={
                        "text": collected.get("description", ""),
                        "trainNumber": collected.get("trainNumber", ""),
                        "coach": collected.get("coach", ""),
                        "pnr": collected.get("pnr", ""),
                        "audio": f"WhatsApp chat transcript:\n{conversation_text}",
                        "passengerPhone": registered_phone
                    },
                    timeout=25
                )
                if analysis_resp.ok:
                    break
            except Exception:
                continue

        if analysis_resp and analysis_resp.ok:
            llm_analysis = analysis_resp.json()
            logger.info("✅ WhatsApp LLM analysis completed for %s: Urgency=%s", complaint_id, llm_analysis.get("urgency"))
            
            patch_endpoints = [
                f"{BACKEND_API_URL.rstrip('/')}/complaints/internal/{complaint_id}/llm-analysis",
                f"http://127.0.0.1:5000/api/complaints/internal/{complaint_id}/llm-analysis",
                f"http://localhost:5000/api/complaints/internal/{complaint_id}/llm-analysis"
            ]
            for patch_ep in patch_endpoints:
                try:
                    patch_resp = requests.patch(
                        patch_ep,
                        json={"llmAnalysis": llm_analysis},
                        headers={"X-Internal-Key": os.environ.get("INTERNAL_API_KEY", "railmadad-internal-2025")},
                        timeout=10
                    )
                    if patch_resp.ok:
                        logger.info("🎉 WhatsApp complaint %s enriched in MongoDB with LLM Analysis!", complaint_id)
                        break
                except Exception:
                    continue
    except Exception as e:
        logger.warning("Background WhatsApp LLM analysis note: %s", e)


def submit_whatsapp_complaint(session: dict) -> dict | None:
    """POSTs WhatsApp complaint directly to Express /api/complaints/internal."""
    collected = session.get("collected", {})
    caller_phone = session.get("caller_phone", "")

    # Clean phone number
    raw_reg = str(collected.get("registeredPhone", "")).strip()
    if raw_reg and not raw_reg.startswith("+") and len(raw_reg) == 10:
        raw_reg = "+91" + raw_reg
    registered_phone = raw_reg or caller_phone

    conversation_text = "\n".join(
        f"{t['role'].upper()}: {t['content']}"
        for t in session.get("history", [])
    )

    payload = {
        "trainNumber": str(collected.get("trainNumber", "")),
        "coach": str(collected.get("coach", "")),
        "pnr": str(collected.get("pnr", "")),
        "description": str(collected.get("description", "WhatsApp complaint reported via RailMadad bot")),
        "passengerPhone": registered_phone,
        "passengerName": "WhatsApp Passenger",
        "category": "WhatsApp Complaint",
        "aiConversions": {
            "imageText": "",
            "audioText": conversation_text,
            "videoText": ""
        },
        "location": {
            "lat": "17.4334",
            "lng": "78.5024",
            "address": f"WhatsApp Report — Train {collected.get('trainNumber', 'En-Route')} (Secunderabad / SCR Network)"
        },
        "source": "twilio_whatsapp"
    }

    endpoints = [
        f"{BACKEND_API_URL.rstrip('/')}/complaints/internal",
        "http://127.0.0.1:5000/api/complaints/internal",
        "http://localhost:5000/api/complaints/internal"
    ]

    for backend_endpoint in endpoints:
        try:
            logger.info("📤 Submitting WhatsApp complaint to backend: %s", backend_endpoint)
            resp = requests.post(
                backend_endpoint,
                json=payload,
                headers={"X-Internal-Key": os.environ.get("INTERNAL_API_KEY", "railmadad-internal-2025")},
                timeout=5
            )

            if resp.ok:
                complaint = resp.json().get("complaint")
                if complaint:
                    complaint_id = complaint.get("complaintId", "")
                    logger.info("🎉 WhatsApp complaint created in DB: %s", complaint_id)
                    threading.Thread(
                        target=_run_async_llm_analysis,
                        args=(complaint_id, collected, conversation_text, registered_phone),
                        daemon=True
                    ).start()
                    return complaint
        except Exception as conn_err:
            logger.warning("Endpoint %s note: %s — trying next...", backend_endpoint, conn_err)
            continue

    return None


# ══════════════════════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════════════════════

@app.route("/health", methods=["GET"])
@app.route("/", methods=["GET"])
def health():
    return jsonify({
        "status": "RailMadad Twilio WhatsApp Agent is running",
        "port": 6001,
        "webhook": "/whatsapp/incoming"
    }), 200


@app.route("/", methods=["POST"])
@app.route("/whatsapp/incoming", methods=["POST"])
def whatsapp_incoming():
    """
    Twilio Webhook: Receives incoming WhatsApp messages.
    """
    num_media   = int(request.form.get("NumMedia", 0))
    media_url   = request.form.get("MediaUrl0", "").strip()
    media_type  = request.form.get("MediaContentType0", "").strip()

    logger.info("💬 Incoming WhatsApp from: %s | Message: '%s' (Media: %d)", caller_id, body, num_media)

    if num_media > 0 and media_url:
        logger.info("🖼️ WhatsApp attachment detected — Type: %s", media_type)
        if media_type.startswith("image/"):
            b64_data, img_caption = caption_image_url(media_url)
            if b64_data:
                session_obj = WHATSAPP_SESSIONS.get(caller_id, {})
                session_obj["media_image"] = b64_data
                session_obj["image_caption"] = img_caption
                logger.info("📷 Image Vision Caption: %s", img_caption)
                body = f"Attached photo: {img_caption}" if not body else f"{body} (Photo: {img_caption})"
        elif media_type.startswith("audio/") or media_type.startswith("video/"):
            logger.info("🔊 WhatsApp Voice Note detected — transcribing via Whisper...")
            transcribed_audio = transcribe_recording(media_url)
            if transcribed_audio:
                logger.info("📝 WhatsApp Voice Note Transcript: %s", transcribed_audio)
                body = transcribed_audio if not body else f"{body}\nVoice note: {transcribed_audio}"

    is_reset_keyword = any(kw in body.lower() for kw in ["hi", "hello", "reset", "start", "restart", "help"])
    
    if caller_id not in WHATSAPP_SESSIONS or (is_reset_keyword and len(WHATSAPP_SESSIONS[caller_id]["collected"].get("trainNumber", "")) == 0):
        WHATSAPP_SESSIONS[caller_id] = {
            "caller_id": caller_id,
            "caller_phone": clean_phone,
            "history": [],
            "collected": {
                "registeredPhone": "",
                "trainNumber": "",
                "coach": "",
                "pnr": "",
                "description": ""
            },
            "is_complete": False
        }

        greeting = (
            "Hello! Welcome to Rail Madad WhatsApp Helpline 🚂.\n\n"
            "I am your automated AI assistant to help you register grievances quickly.\n\n"
            "To link this complaint to your Rail Madad account, please reply with your registered 10-digit mobile number."
        )
        WHATSAPP_SESSIONS[caller_id]["history"].append({"role": "assistant", "content": greeting})

        twiml = MessagingResponse()
        twiml.message(greeting)
        return Response(str(twiml), mimetype="text/xml")

    session = WHATSAPP_SESSIONS[caller_id]

    # Append user message to history
    session["history"].append({"role": "user", "content": body})

    # Run AI conversation turn
    result = whatsapp_conversation_turn(
        history=session["history"][:-1],
        user_message=body,
        current_collected=session["collected"]
    )

    next_question = str(result.get("next_question", "Could you please clarify that?"))
    new_collected = result.get("collected") or session["collected"]

    if isinstance(new_collected, dict):
        for key in ["registeredPhone", "trainNumber", "coach", "pnr", "description"]:
            val = str(new_collected.get(key, "") or "").strip()
            if val:
                session["collected"][key] = val

    # Enforce phone formatting
    reg_phone = str(session["collected"].get("registeredPhone", "") or "").replace(" ", "").replace("-", "")
    if reg_phone and not reg_phone.startswith("+") and len(reg_phone) == 10:
        reg_phone = "+91" + reg_phone
    if reg_phone:
        session["collected"]["registeredPhone"] = reg_phone

    # Hard-enforced "Anything else to add?" state check
    c = session["collected"]
    has_all_5 = bool(c.get("registeredPhone") and c.get("trainNumber") and c.get("coach") and c.get("pnr") and c.get("description"))

    is_complete = False
    if has_all_5:
        if c.get("anything_else_asked") != "true":
            c["anything_else_asked"] = "true"
            is_complete = False
            next_question = "Thank you for explaining that! Is there anything else you would like to tell us or add about your issue before I finalize it?"
        else:
            msg_lower = body.lower().strip()
            if not any(kw in msg_lower for kw in ["no", "nothing", "that's all", "that is all", "nope", "nah"]):
                if len(body.strip()) > 2:
                    c["description"] = str(c.get("description", "")) + ". Additional note: " + body.strip()
            is_complete = True

    session["history"].append({"role": "assistant", "content": next_question})
    logger.info("📋 WhatsApp Collected so far: %s", session["collected"])

    twiml = MessagingResponse()

    if is_complete:
        logger.info("✅ WhatsApp Complaint data complete — submitting to backend")
        complaint = submit_whatsapp_complaint(session)
        WHATSAPP_SESSIONS.pop(caller_id, None)

        if complaint:
            cid = complaint.get("complaintId", "Registered")
            farewell = (
                f"🎉 *Complaint Registered Successfully!*\n\n"
                f"📌 *Complaint ID:* `{cid}`\n"
                f"🚆 *Train:* {c.get('trainNumber')}\n"
                f"💺 *Coach:* {c.get('coach')} | *PNR:* {c.get('pnr')}\n"
                f"📱 *Linked Account Phone:* {c.get('registeredPhone')}\n\n"
                f"We have dispatched your grievance to the railway resolution team. You will receive live status updates on your registered mobile number.\n\n"
                f"Thank you for contacting Rail Madad. Have a safe journey! 🚂"
            )
        else:
            farewell = (
                "Thank you for reaching out. We have recorded your details.\n"
                "Your grievance has been logged into the Rail Madad system.\n"
                "Thank you for contacting Rail Madad. Have a safe journey! 🚂"
            )
        twiml.message(farewell)
    else:
        twiml.message(next_question)

    return Response(str(twiml), mimetype="text/xml")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", os.environ.get("TWILIO_WHATSAPP_PORT", 6001)))
    logger.info("🚀 RailMadad Twilio WhatsApp Agent starting on port %d", port)
    logger.info("   TWILIO_ACCOUNT_SID: %s", TWILIO_ACCOUNT_SID[:8] + "..." if TWILIO_ACCOUNT_SID else "NOT SET")
    logger.info("   BACKEND_API_URL   : %s", BACKEND_API_URL)
    logger.info("   ML_SERVICE_URL    : %s", ML_SERVICE_URL)
    app.run(host="0.0.0.0", port=port, debug=False)
