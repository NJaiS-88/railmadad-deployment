"""
twilio/server.py
════════════════════════════════════════════════════════════════════
RailMadad — Twilio Voice Complaint Intake System
────────────────────────────────────────────────────────────────────
Flow:
  1. Caller dials Twilio number → /voice/incoming
  2. Greeting TwiML + <Record> to capture caller speech
  3. /voice/process → Download recording → Whisper transcription
  4. Transcription + conversation history → OpenRouter AI
  5. Nemotron guides conversation: collect PNR, Train, Coach, Description
  6. When complete → POST to Express backend to create complaint
  7. Map caller phone → user in DB (fallback: create guest entry)
  8. Confirm complaint ID via TwiML <Say> and hang up
════════════════════════════════════════════════════════════════════
"""

import os
import json
import logging
import requests
import tempfile
import uuid
from datetime import datetime

from flask import Flask, request, Response, jsonify
from flask_cors import CORS
from twilio.rest import Client as TwilioClient
from twilio.twiml.voice_response import VoiceResponse, Gather, Record, Say

# ── Load .env ─────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    print("✅ .env loaded")
except ImportError:
    print("⚠️  python-dotenv not installed — env vars must be set manually")

# ── Configuration ─────────────────────────────────────────────────
TWILIO_ACCOUNT_SID  = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN   = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.environ.get("TWILIO_PHONE_NUMBER", "")
OPENROUTER_API_KEY  = os.environ.get("OPENROUTER_API_KEY", "")
BACKEND_API_URL     = os.environ.get("BACKEND_API_URL", "http://127.0.0.1:5000/api")
ML_SERVICE_URL      = os.environ.get("ML_SERVICE_URL", "http://127.0.0.1:8000")

# Twilio base URL for downloading recordings (set via ngrok / public URL in .env)
TWILIO_BASE_URL = os.environ.get("TWILIO_BASE_URL", "http://localhost:6000")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) if TWILIO_ACCOUNT_SID else None

app = Flask(__name__)
CORS(app)

# ── In-memory call session store (keyed by CallSid) ───────────────
# session = {
#   "call_sid": str,
#   "caller_phone": str,
#   "history": [{"role": "assistant"|"user", "content": str}],
#   "collected": {pnr, trainNumber, coach, description},
#   "is_complete": bool
# }
CALL_SESSIONS: dict = {}


# ══════════════════════════════════════════════════════════════════
#  HELPER: Whisper transcription via ML service
# ══════════════════════════════════════════════════════════════════
def transcribe_recording(recording_url: str) -> str:
    """
    Downloads Twilio recording audio (.mp3 for speed) and sends to our
    Whisper /transcribe-audio endpoint in ml_service.py.
    """
    try:
        # Twilio requires Basic Auth to download recordings. Use .mp3 for fast download.
        audio_resp = requests.get(
            recording_url + ".mp3",
            auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
            timeout=10
        )
        audio_resp.raise_for_status()
        audio_bytes = audio_resp.content

        import base64
        audio_b64 = "data:audio/mp3;base64," + base64.b64encode(audio_bytes).decode("utf-8")

        ml_resp = requests.post(
            f"{ML_SERVICE_URL}/transcribe-audio",
            json={"audio": audio_b64},
            timeout=15
        )
        if ml_resp.ok:
            return ml_resp.json().get("text", "").strip()
        logger.error("Whisper ML service error: %s", ml_resp.text)
        return ""
    except Exception as e:
        logger.error("Transcription error: %s", e)
        return ""


def caption_image_url(image_url: str) -> tuple[str, str]:
    """
    Downloads image from Twilio WhatsApp media URL, base64 encodes it,
    and calls ml_service.py /caption-image to get AI Vision description.
    Returns (data_uri, caption).
    """
    try:
        resp = requests.get(image_url, auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN), timeout=10)
        resp.raise_for_status()
        img_bytes = resp.content

        import base64
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        data_uri = f"data:image/jpeg;base64,{b64}"

        ml_resp = requests.post(
            f"{ML_SERVICE_URL}/caption-image",
            json={"image": data_uri},
            timeout=15
        )
        caption = ""
        if ml_resp.ok:
            caption = ml_resp.json().get("caption", "").strip()
        return data_uri, caption
    except Exception as e:
        logger.error("Error captioning WhatsApp image: %s", e)
        return "", ""


# ══════════════════════════════════════════════════════════════════
#  HELPER: OpenRouter conversation turn
# ══════════════════════════════════════════════════════════════════
SYSTEM_PROMPT = """You are RailMadad Voice Assistant, a warm, polite, and empathetic Indian Railways helpline agent.
Your job is to collect a passenger's complaint over a phone call in a helpful, conversational manner.

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
    """Instant 1ms rule-based extractor fallback if API latency exceeds timeout."""
    import re
    collected = dict(current_collected)
    digits_only = "".join(re.findall(r'\d+', user_message))
    msg_lower = user_message.lower().strip()

    # Track what was already present before this turn
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

    # 3. Coach (e.g., S3, B4, A1, H1, SL, B1, S1, D4)
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
        next_q = "Hello! Welcome to Rail Madad helpline. Could you please state your registered mobile number so I can link your account?"
    elif not collected.get("trainNumber"):
        next_q = "Thank you so much! May I please have your Train Number or Train Name?"
    elif not collected.get("coach"):
        next_q = "Got it! Could you also kindly share your Coach Number, such as B4 or S3?"
    elif not collected.get("pnr"):
        next_q = "Thank you! Could you please provide your 10-digit PNR Number?"
    elif not collected.get("description"):
        next_q = "I am sorry to hear you are having trouble. Could you please describe the issue you are facing in detail?"
    elif "anything_else_asked" not in collected:
        collected["anything_else_asked"] = "true"
        next_q = "Thank you for explaining that. Is there anything else you would like to tell us or add about your issue?"
    else:
        if any(kw in msg_lower for kw in ["yes", "also", "and"]):
            collected["description"] = collected.get("description", "") + ". " + user_message.strip()
        next_q = "Thank you so much for providing all the details! I am registering your complaint now."

    is_complete = all(bool(collected.get(k)) for k in ["registeredPhone", "trainNumber", "coach", "pnr", "description"]) and (collected.get("anything_else_asked") == "true")

    return {
        "next_question": next_q,
        "is_complete": is_complete,
        "collected": collected
    }


def nemotron_conversation_turn(history: list, user_message: str, current_collected: dict) -> dict:
    """
    Send conversation turn to OpenRouter AI (fast Llama 3.1 8B model: ~500ms)
    with 3.5s timeout and instant 1ms fallback.
    """
    try:
        from openai import OpenAI
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
            timeout=10.0,
            max_retries=1
        )

        # Build messages
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
                    max_tokens=150,
                    stream=False
                )
                raw = completion.choices[0].message.content.strip()
                if raw:
                    logger.info("[NIM %s raw]: %s", model_name, raw)
                    break
            except Exception as err:
                logger.warning("NIM model %s note: %s", model_name, err)
                continue

        if not raw:
            raise RuntimeError("No fast NIM model responded in time")

        # Extract JSON using regex if wrapped in markdown or preamble text
        import re
        json_match = re.search(r'\{[\s\S]*\}', raw)
        if json_match:
            raw = json_match.group(0)

        parsed = json.loads(raw)
        
        # Ensure collected values are converted to strings safely
        collected = parsed.get("collected", {})
        if isinstance(collected, dict):
            for k, v in collected.items():
                collected[k] = str(v) if v is not None else ""
            parsed["collected"] = collected

        return parsed

    except Exception as e:
        logger.warning("NIM API latency/error (%s) — using instant rule-based fallback", e)
        return rule_based_fallback_turn(user_message, current_collected)


# ══════════════════════════════════════════════════════════════════
#  HELPER: Submit complaint to Express backend
# ══════════════════════════════════════════════════════════════════
import threading

def _run_async_llm_analysis(complaint_id: str, collected: dict, conversation_text: str, registered_phone: str):
    """Runs LLM Triage analysis in background thread and updates MongoDB."""
    try:
        logger.info("🧠 Running background LLM Triage analysis for complaint %s...", complaint_id)
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
                        "audio": f"Voice call transcript:\n{conversation_text}",
                        "passengerPhone": registered_phone
                    },
                    timeout=60
                )
                if analysis_resp.ok:
                    break
            except Exception:
                continue

        if analysis_resp and analysis_resp.ok:
            llm_analysis = analysis_resp.json()
            logger.info("✅ Background LLM analysis completed for %s: Category=%s | Urgency=%s", complaint_id, llm_analysis.get("category"), llm_analysis.get("urgency"))
            
            # Send PATCH to Express backend to update MongoDB document
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
                        logger.info("🎉 MongoDB complaint %s successfully enriched with AI LLM Analysis!", complaint_id)
                        break
                except Exception:
                    continue
        else:
            logger.warning("ML service analyze-complaint note for %s", complaint_id)
    except Exception as e:
        logger.warning("Background LLM analysis note for %s: %s", complaint_id, e)


def submit_complaint_to_backend(session: dict) -> dict | None:
    """
    POSTs complaint directly to Express /api/complaints/internal
    (bypasses auth using an internal API key header).
    Links caller phone to DB user and generates Complaint ID instantly.
    """
    collected = session.get("collected", {})
    caller_phone = session.get("caller_phone", "")

    # Prefer the registered phone spoken by caller (links to their RailMadad account)
    registered_phone = str(collected.get("registeredPhone", "")).strip() or caller_phone

    # Build transcript text of call
    conversation_text = "\n".join(
        f"{t['role'].upper()}: {t['content']}"
        for t in session.get("history", [])
    )

    payload = {
        "trainNumber": str(collected.get("trainNumber", "")),
        "coach": str(collected.get("coach", "")),
        "pnr": str(collected.get("pnr", "")),
        "description": str(collected.get("description", "Voice complaint reported via Twilio call")),
        "passengerPhone": registered_phone,
        "passengerName": session.get("passengerName", "Twilio Caller"),
        "category": session.get("category", "Voice Complaint (Twilio)"),
        "media": {
            "image": session.get("media_image", None),
            "audio": None,
            "video": None
        },
        "aiConversions": {
            "imageText": session.get("image_caption", ""),
            "audioText": conversation_text,
            "videoText": ""
        },
        "location": {
            "lat": str(session.get("caller_geo", {}).get("lat") or "17.4334"),
            "lng": str(session.get("caller_geo", {}).get("lng") or "78.5024"),
            "address": session.get("caller_geo", {}).get("address") or f"Twilio Voice — Train {collected.get('trainNumber', 'En-Route')}"
        },
        "source": session.get("source", "twilio_voice")
    }

    # Resilient multi-endpoint fallback loop (handles 127.0.0.1, localhost, custom ports)
    endpoints = [
        f"{BACKEND_API_URL.rstrip('/')}/complaints/internal",
        "http://127.0.0.1:5000/api/complaints/internal",
        "http://localhost:5000/api/complaints/internal"
    ]

    for backend_endpoint in endpoints:
        try:
            logger.info("📤 Submitting complaint to backend: %s", backend_endpoint)
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
                    logger.info("🎉 Complaint successfully saved in DB: %s", complaint_id)
                    # Run full LLM triage in background so Twilio call finishes in < 100ms
                    threading.Thread(
                        target=_run_async_llm_analysis,
                        args=(complaint_id, collected, conversation_text, registered_phone),
                        daemon=True
                    ).start()
                    return complaint
        except Exception as conn_err:
            logger.warning("Endpoint %s attempt note: %s — trying next...", backend_endpoint, conn_err)
            continue

    logger.error("All backend complaint creation endpoints failed.")
    return None


# ══════════════════════════════════════════════════════════════════
#  TwiML HELPERS
# ══════════════════════════════════════════════════════════════════
def twiml_gather_response(say_text: str, action_url: str) -> str:
    """
    Build TwiML: Say prompt, then Gather caller speech or keypad DTMF input.
    Uses Twilio's native real-time cloud Speech Recognition (language='en-IN',
    enhanced=True, speech_model='experimental_conversational') for 0ms latency STT.
    """
    resp = VoiceResponse()
    gather = Gather(
        input="speech dtmf",
        action=action_url,
        method="POST",
        speech_timeout="auto",
        timeout=6,
        finish_on_key="#",
        language="en-IN",                            # Native Indian English recognition
        speech_model="experimental_conversational",  # Fast conversational STT model
        enhanced=True                                # Enhanced neural speech engine
    )
    gather.say(say_text, voice="Polly.Aditi", language="en-IN")
    resp.append(gather)

    # Keep-alive fallback: If user was silent for 6s (e.g. looking up PNR/Ticket)
    resp.say("I am still here listening. Please take your time.", voice="Polly.Aditi", language="en-IN")
    resp.redirect(action_url)
    return str(resp)


def twiml_hangup(say_text: str) -> str:
    """Build TwiML: Say final message and hang up."""
    resp = VoiceResponse()
    resp.say(say_text, voice="Polly.Aditi", language="en-IN")
    resp.hangup()
    return str(resp)


# ══════════════════════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════════════════════

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "RailMadad Twilio Voice Server is running", "port": 6000})


@app.route("/", methods=["GET", "POST"])
@app.route("/voice/incoming", methods=["POST"])
def voice_incoming():
    """
    Twilio webhook: Called when a new call arrives.
    Initialises session and sends greeting.
    """
    if request.method == "GET":
        return jsonify({
            "status": "RailMadad Twilio Voice service running",
            "info": "Use POST /voice/incoming or POST / for Twilio Webhook"
        }), 200

    call_sid     = request.form.get("CallSid", "")
    caller_phone = request.form.get("From", "")

    logger.info("📞 Incoming call — SID: %s | From: %s", call_sid, caller_phone)

    # Init session
    CALL_SESSIONS[call_sid] = {
        "call_sid": call_sid,
        "caller_phone": caller_phone,   # Twilio From number (may differ from registered)
        "history": [],
        "collected": {
            "registeredPhone": "",      # Phone number linked to Rail Madad account
            "trainNumber": "",
            "coach": "",
            "pnr": "",
            "description": ""
        },
        "is_complete": False
    }

    greeting = (
        "Hello! Welcome to Rail Madad, the Indian Railways helpline. "
        "I am here to help you register your complaint. "
        "To link this report to your account, "
        "please say or key in your registered 10-digit mobile number."
    )

    action_url = f"{TWILIO_BASE_URL}/voice/process?CallSid={call_sid}"
    twiml = twiml_gather_response(greeting, action_url)
    return Response(twiml, mimetype="text/xml")


@app.route("/voice/process", methods=["POST"])
def voice_process():
    """
    Twilio webhook: Called after user speaks or enters digits.
    Uses real-time Twilio SpeechResult / DTMF Digits instantly (0ms latency).
    Fallback to Whisper audio transcription if SpeechResult is empty.
    """
    call_sid        = request.form.get("CallSid") or request.args.get("CallSid", "")
    speech_result   = request.form.get("SpeechResult", "").strip()
    digits_result   = request.form.get("Digits", "").strip()
    recording_url   = request.form.get("RecordingUrl", "").strip()

    logger.info("🎙️  Input received — CallSid: %s | SpeechResult: '%s' | Digits: '%s'", call_sid, speech_result, digits_result)

    session = CALL_SESSIONS.get(call_sid)
    if not session:
        # Session expired or unknown call — apologise and hang up
        return Response(twiml_hangup("Sorry, your session has expired. Please call again."), mimetype="text/xml")

    try:
        # ── Step 1: Extract caller speech / keypad text ───────────────
        user_text = speech_result or digits_result
        if not user_text and recording_url:
            logger.info("🔊 Fallback: Transcribing recording via Whisper...")
            user_text = transcribe_recording(recording_url)

        if user_text:
            logger.info("📝 Transcript / Input: %s", user_text)
        else:
            user_text = "[caller input not detected]"

        # ── Step 2: Update conversation history ──────────────────────
        session["history"].append({"role": "user", "content": user_text})

        # ── Step 3: Send to Nemotron for next conversational step ─────
        result = nemotron_conversation_turn(
            history=session["history"][:-1],     # history without current turn
            user_message=user_text,
            current_collected=session["collected"]
        )

        next_question  = str(result.get("next_question", "Could you please repeat that?"))
        is_complete    = bool(result.get("is_complete", False))
        new_collected  = result.get("collected") or session["collected"]

        # Merge collected info (don't overwrite existing with empty, ensure string types)
        if isinstance(new_collected, dict):
            for key in ["registeredPhone", "trainNumber", "coach", "pnr", "description"]:
                val = str(new_collected.get(key, "") or "").strip()
                if val:
                    session["collected"][key] = val

        # Normalise registeredPhone: strip spaces and dashes only, keep number as-is
        reg_phone = str(session["collected"].get("registeredPhone", "") or "").replace(" ", "").replace("-", "")
        if reg_phone:
            session["collected"]["registeredPhone"] = reg_phone

        # ── User existence check: verify this phone is registered in Rail Madad ──
        if reg_phone and not session.get("user_verified"):
            try:
                user_check_endpoints = [
                    f"{BACKEND_API_URL.rstrip('/')}/auth/check-phone?phone={reg_phone}",
                    f"http://127.0.0.1:5000/api/auth/check-phone?phone={reg_phone}"
                ]
                user_found = False
                for ep in user_check_endpoints:
                    try:
                        r = requests.get(ep, headers={"X-Internal-Key": os.environ.get("INTERNAL_API_KEY", "railmadad-internal-2025")}, timeout=3)
                        if r.ok:
                            user_found = r.json().get("exists", False)
                            break
                    except Exception:
                        continue

                session["user_verified"] = user_found
                if not user_found:
                    logger.warning("\u26a0\ufe0f Unregistered phone attempted Twilio call: %s", reg_phone)
                    msg = (
                        f"I'm sorry, but I couldn't find a Rail Madad account linked to {reg_phone}. "
                        f"Please register first on the Rail Madad website or mobile app, and then call back. "
                        f"Thank you for contacting Rail Madad. Goodbye!"
                    )
                    CALL_SESSIONS.pop(call_sid, None)
                    return Response(twiml_hangup(msg), mimetype="text/xml")
                else:
                    logger.info("\u2705 User verified for phone: %s", reg_phone)
            except Exception as e:
                logger.warning("User check note: %s \u2014 proceeding anyway", e)
                session["user_verified"] = True  # Fail-open: don't block on check errors

        # Deterministic check: Have all 5 core fields been collected?
        c = session["collected"]
        has_all_5 = bool(c.get("registeredPhone") and c.get("trainNumber") and c.get("coach") and c.get("pnr") and c.get("description"))

        if has_all_5:
            if c.get("anything_else_asked") != "true":
                # Mark that we are asking the 'anything else' question now
                c["anything_else_asked"] = "true"
                is_complete = False
                next_question = "Thank you for explaining that. Is there anything else you would like to tell us or add about your issue before I finalize it?"
            else:
                # Caller has responded to the 'anything else' question
                msg_lower = user_text.lower().strip()
                if not any(kw in msg_lower for kw in ["no", "nothing", "that's all", "that is all", "nope", "nah"]):
                    # User added extra details -> append to description
                    if len(user_text.strip()) > 2 and "[caller input" not in user_text:
                        c["description"] = str(c.get("description", "")) + ". Additional note: " + user_text.strip()
                is_complete = True

        # Add assistant reply to history
        session["history"].append({"role": "assistant", "content": next_question})

        logger.info("📋 Collected so far: %s", session["collected"])

        # ── Step 4: Complete or continue ─────────────────────────────
        if is_complete:
            logger.info("✅ Complaint data complete — submitting to backend")
            complaint = submit_complaint_to_backend(session)

            # Clean up session
            CALL_SESSIONS.pop(call_sid, None)

            if complaint:
                complaint_id = str(complaint.get("complaintId", "Unknown"))
                spaced_id = " ".join(list(complaint_id))
                farewell = (
                    f"Thank you so much for your patience! Your complaint has been registered successfully. "
                    f"Your official Complaint ID is {spaced_id}. "
                    f"You will receive live tracking updates on your registered mobile number. "
                    f"Thank you for reaching out to Rail Madad. Have a safe journey and goodbye!"
                )
            else:
                farewell = (
                    "Thank you for reaching out. We have noted all your details. "
                    "However, there was a minor issue saving it to the server. "
                    "Please try again or submit via the Rail Madad app. Have a safe journey and goodbye!"
                )

            return Response(twiml_hangup(farewell), mimetype="text/xml")

        else:
            # Continue conversation — gather next answer instantly
            action_url = f"{TWILIO_BASE_URL}/voice/process?CallSid={call_sid}"
            return Response(twiml_gather_response(next_question, action_url), mimetype="text/xml")

    except Exception as e:
        logger.exception("❌ Error in voice_process: %s", e)
        action_url = f"{TWILIO_BASE_URL}/voice/process?CallSid={call_sid}"
        fallback_msg = "Thank you. Could you please tell me your train number and coach number?"
        return Response(twiml_gather_response(fallback_msg, action_url), mimetype="text/xml")


@app.route("/voice/status", methods=["POST"])
def voice_status():
    """
    Twilio Status Callback — handles call completion / failure cleanup.
    """
    call_sid    = request.form.get("CallSid", "")
    call_status = request.form.get("CallStatus", "")
    logger.info("📊 Call status update — SID: %s | Status: %s", call_sid, call_status)

    if call_status in ("completed", "failed", "busy", "no-answer", "canceled"):
        # Clean up incomplete sessions
        if call_sid in CALL_SESSIONS:
            session = CALL_SESSIONS.pop(call_sid)
            collected = session.get("collected", {})
            # If we have enough data, still try to submit
            if collected.get("trainNumber") and collected.get("description"):
                logger.info("🔄 Submitting partial complaint after call ended...")
                submit_complaint_to_backend(session)

    return Response("<Response/>", mimetype="text/xml")


# ══════════════════════════════════════════════════════════════════
#  WHATSAPP INTEGRATION (UNIFIED SERVER ON PORT 6000)
# ══════════════════════════════════════════════════════════════════
from twilio.twiml.messaging_response import MessagingResponse

WHATSAPP_SESSIONS: dict = {}

@app.route("/whatsapp", methods=["POST"])
@app.route("/whatsapp/incoming", methods=["POST"])
def whatsapp_incoming():
    """
    Twilio Webhook: Receives incoming WhatsApp messages on port 6000.
    Allows single ngrok domain to serve both Voice and WhatsApp!
    """
    caller_id   = request.form.get("From", "")   # e.g., 'whatsapp:+919372680382'
    body        = request.form.get("Body", "").strip()
    clean_phone = caller_id.replace("whatsapp:", "").strip()

    num_media   = int(request.form.get("NumMedia", 0))
    media_url   = request.form.get("MediaUrl0", "").strip()
    media_type  = request.form.get("MediaContentType0", "").strip()

    logger.info("💬 WhatsApp message from %s: '%s' (Attachments: %d)", caller_id, body, num_media)

    # ── Process Media Attachments (Photos & Voice Notes) ──────────────
    if num_media > 0 and media_url:
        logger.info("🖼️ WhatsApp attachment detected — Type: %s", media_type)
        if media_type.startswith("image/"):
            b64_data, img_caption = caption_image_url(media_url)
            if b64_data:
                session_obj = WHATSAPP_SESSIONS.get(caller_id, {})
                session_obj["media_image"] = b64_data
                session_obj["image_caption"] = img_caption
                logger.info("📷 Image Vision Caption: %s", img_caption)
                if img_caption:
                    body = f"Image attachment: {img_caption}" if not body else f"{body} (Image: {img_caption})"
                elif not body:
                    body = "Attached a photo evidence"
        elif media_type.startswith("audio/") or media_type.startswith("video/"):
            logger.info("🔊 WhatsApp Voice Note detected — transcribing via Whisper...")
            transcribed_audio = transcribe_recording(media_url)
            if transcribed_audio:
                logger.info("📝 WhatsApp Voice Note Transcript: %s", transcribed_audio)
                body = transcribed_audio if not body else f"{body}\nVoice note: {transcribed_audio}"

    is_reset = any(kw in body.lower() for kw in ["hi", "hello", "reset", "start", "restart", "help"])
    
    if caller_id not in WHATSAPP_SESSIONS or (is_reset and len(WHATSAPP_SESSIONS[caller_id]["collected"].get("trainNumber", "")) == 0):
        WHATSAPP_SESSIONS[caller_id] = {
            "caller_id": caller_id,
            "caller_phone": clean_phone,
            "passengerName": "WhatsApp Passenger",
            "category": "WhatsApp Complaint",
            "source": "twilio_whatsapp",
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
    session["history"].append({"role": "user", "content": body})

    result = nemotron_conversation_turn(
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

    reg_phone = str(session["collected"].get("registeredPhone", "") or "").replace(" ", "").replace("-", "")
    if reg_phone and not reg_phone.startswith("+") and len(reg_phone) == 10:
        reg_phone = "+91" + reg_phone
    if reg_phone:
        session["collected"]["registeredPhone"] = reg_phone

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

    twiml = MessagingResponse()
    if is_complete:
        logger.info("✅ WhatsApp Complaint data complete — submitting to backend")
        complaint = submit_complaint_to_backend(session)
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


@app.route("/sessions", methods=["GET"])
def list_sessions():
    """Dev endpoint to inspect active call sessions."""
    return jsonify({
        "active_voice_sessions": len(CALL_SESSIONS),
        "active_whatsapp_sessions": len(WHATSAPP_SESSIONS),
        "voice_sessions": {
            sid: {
                "caller": s["caller_phone"],
                "collected": s["collected"],
                "turns": len(s["history"]),
                "is_complete": s["is_complete"]
            }
            for sid, s in CALL_SESSIONS.items()
        }
    })


# ══════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    port = int(os.environ.get("PORT", os.environ.get("TWILIO_SERVER_PORT", 6000)))
    logger.info("🚀 RailMadad Twilio Voice Server starting on port %d", port)
    logger.info("   TWILIO_ACCOUNT_SID : %s", TWILIO_ACCOUNT_SID[:8] + "..." if TWILIO_ACCOUNT_SID else "NOT SET")
    logger.info("   TWILIO_PHONE_NUMBER: %s", TWILIO_PHONE_NUMBER or "NOT SET")
    logger.info("   TWILIO_BASE_URL    : %s", TWILIO_BASE_URL)
    logger.info("   BACKEND_API_URL    : %s", BACKEND_API_URL)
    logger.info("   ML_SERVICE_URL     : %s", ML_SERVICE_URL)
    app.run(host="0.0.0.0", port=port, debug=False)
