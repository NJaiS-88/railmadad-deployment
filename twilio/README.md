# RailMadad Twilio Voice Complaint Intake

A voice-driven complaint registration system that lets passengers call a phone number, speak their issue, and have it automatically filed as a complaint in the RailMadad system.

---

## Architecture

```
Caller dials Twilio number
        │
        ▼
Twilio → /voice/incoming   ← Flask (port 6000)
        │  (greeting TwiML + Record)
        ▼
Twilio sends recording URL → /voice/process
        │
        ├── Recording audio ──► Whisper (ml_service.py /transcribe-audio)
        │                        └── Transcript text
        │
        ├── Transcript ──────► NVIDIA Nemotron Super 49B
        │                        └── {next_question, is_complete, collected}
        │
        ├── If NOT complete → TwiML: Say next_question + Record again
        │
        └── If COMPLETE →
               ├── /analyze-complaint (ml_service.py) → LLM structured analysis
               ├── POST /api/internal/complaints (Express, port 5000)
               │     └── Maps caller phone → existing User in MongoDB
               │     └── Creates Complaint document identical to app submissions
               └── TwiML: Say "Complaint ID: RMDAXXXXXXXX" + Hangup
```

---

## Setup

### 1. Install Python dependencies

```bash
cd twilio
pip install -r requirements.txt
```

### 2. Fill in your `.env` (root level)

Open `c:\RAIL MADAD\RailMadad\.env` and fill in:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
TWILIO_BASE_URL=https://your-ngrok-url.ngrok-free.app
```

Get these from: https://console.twilio.com

### 3. Expose port 6000 publicly (required for Twilio webhooks)

Twilio needs a public HTTPS URL to call your server. Use **ngrok**:

```bash
# Install ngrok: https://ngrok.com/download7418520963
ngrok http 6000
```

Copy the `https://xxxx.ngrok-free.app` URL and set it as `TWILIO_BASE_URL` in `.env`.

### 4. Configure Twilio Phone Number webhooks

1. Go to [Twilio Console → Phone Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Click your purchased number
3. Under **Voice & Fax → A Call Comes In**:
   - Set to: `Webhook`
   - URL: `https://your-ngrok-url.ngrok-free.app/voice/incoming`
   - Method: `HTTP POST`
4. Under **Call Status Changes**:
   - URL: `https://your-ngrok-url.ngrok-free.app/voice/status`
   - Method: `HTTP POST`

### 5. Start the server

Make sure ml_service.py and the Express backend are running first, then:

```bash
cd c:\RAIL MADAD\RailMadad
python twilio/server.py
```

Server starts on port **6000**.

---

## Call Flow (Sample Conversation)

```
🤖 "Welcome to Rail Madad... Please tell me your train number, coach, PNR and issue after the beep."
👤 "My train is 12019 Secunderabad Express, I'm in coach A1, PNR 1234567890, dirty washroom."
🤖 "Thank you! I have your details. Your complaint has been registered. Complaint ID is R M D A 1 2 3 4 5 6 7 8. Goodbye!"
```

If incomplete:
```
👤 "The fan is broken."
🤖 "Got it. Could you please tell me your train number?"
👤 "12301 Howrah Rajdhani."
🤖 "Thank you. What is your coach number?"
...
```

---

## Key Files

| File | Purpose |
|------|---------|
| `twilio/server.py` | Main Flask server — Twilio webhooks, Whisper, Nemotron conversation |
| `twilio/requirements.txt` | Python dependencies |
| `backend/routes/complaintRoutes.js` | Added `/internal` POST route for Twilio complaint submission |
| `.env` | Add your Twilio credentials here |

---

## Session Management

Active call sessions are stored in-memory (keyed by Twilio `CallSid`). Each session tracks:
- **Caller phone** (used to link to existing RailMadad user account)
- **Conversation history** (all turns sent to Nemotron for context)
- **Collected data**: `trainNumber`, `coach`, `pnr`, `description`

If a call drops mid-conversation and at least Train Number + Description are collected, the system still attempts to submit the partial complaint.

---

## Dev Endpoints

- `GET /health` — Server health check
- `GET /sessions` — View all active call sessions (dev only)
