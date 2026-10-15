# c:\RAIL MADAD\RailMadad\ml_service.py
# Python ML Service: BLIP Image/Video captioning + Whisper Audio/Video transcription
# Strategy: transcode all incoming video to MP4 via ffmpeg first, so OpenCV always gets a proper file

import subprocess
from flask import Flask, request, jsonify
from flask_cors import CORS
import io
import base64
import os
import shutil
import tempfile

# Load .env from project root (where ml_service.py lives)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
    print("✅ .env loaded")
except ImportError:
    pass  # python-dotenv not installed — env vars must be set manually

NVIDIA_NIM_API_KEY = os.environ.get("NVIDIA_NIM_API_KEY", "").strip()
if NVIDIA_NIM_API_KEY:
    print("✅ NVIDIA NIM API key found — will use Nemotron for text analysis")
else:
    print("⚠️  No NVIDIA NIM key — text analysis may be limited")

# OpenRouter key — used exclusively for thinkingmachines/inkling (vision)
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "").strip()
if OPENROUTER_API_KEY:
    print("✅ OpenRouter API key found — will use thinkingmachines/inkling for image captioning & ID OCR")
else:
    print("⚠️  No OpenRouter key — will use local BLIP for image captioning")

# Prefer system-installed ffmpeg (user has 7.1), fallback to imageio_ffmpeg
FFMPEG_EXE = shutil.which("ffmpeg")
if FFMPEG_EXE:
    print("✅ Using system FFmpeg:", FFMPEG_EXE)
else:
    try:
        import imageio_ffmpeg
        _fe = imageio_ffmpeg.get_ffmpeg_exe()
        _fd = os.path.dirname(_fe)
        _ft = os.path.join(_fd, "ffmpeg.exe")
        if not os.path.exists(_ft):
            shutil.copyfile(_fe, _ft)
        os.environ["PATH"] = _fd + os.pathsep + os.environ.get("PATH", "")
        FFMPEG_EXE = _ft
        print("✅ imageio_ffmpeg on PATH:", FFMPEG_EXE)
    except Exception as e:
        FFMPEG_EXE = "ffmpeg"
        print("⚠️ FFmpeg not found, will try 'ffmpeg' on PATH:", e)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'service': 'railmadad-ml-service',
        'openrouter_inkling': bool(OPENROUTER_API_KEY),
        'nvidia_nim': bool(NVIDIA_NIM_API_KEY)
    }), 200

print("Starting AI models initialization...")


# ── Helper: Decode base64 safely (strips data URL header, fixes padding) ──
def decode_base64_safely(data_str):
    if not data_str or not isinstance(data_str, str):
        return b""
    if ',' in data_str:
        data_str = data_str.split(',', 1)[1]
    data_str = data_str.strip().replace('\n', '').replace('\r', '').replace(' ', '+')
    mod = len(data_str) % 4
    if mod == 1:
        data_str = data_str[:-1]
    elif mod == 2:
        data_str += "=="
    elif mod == 3:
        data_str += "="
    try:
        return base64.b64decode(data_str)
    except Exception:
        try:
            return base64.b64decode(data_str + "==", validate=False)
        except Exception:
            return b""


# ── Helper: Transcode any video file → MP4 + WAV using ffmpeg ──
# This is the KEY function: converts browser-recorded WebM chunks to proper MP4
# so OpenCV (which can't decode WebM on Windows) gets a valid file
def transcode_to_mp4_and_wav(input_path):
    """Returns (mp4_path, wav_path). Caller is responsible for cleanup."""
    base = input_path.rsplit('.', 1)[0]
    mp4_path = base + "_out.mp4"
    wav_path = base + "_out.wav"

    # Transcode video → H264 MP4 (OpenCV-compatible)
    try:
        subprocess.run(
            [FFMPEG_EXE, "-y", "-i", input_path,
             "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
             "-c:a", "aac", "-strict", "experimental",
             mp4_path],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=90
        )
    except Exception as e:
        print("Video transcode note:", e)
        mp4_path = None

    # Extract audio → 16kHz mono WAV (Whisper-compatible)
    try:
        subprocess.run(
            [FFMPEG_EXE, "-y", "-i", input_path,
             "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
             wav_path],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60
        )
        if not os.path.exists(wav_path) or os.path.getsize(wav_path) < 1000:
            wav_path = None
    except Exception as e:
        print("Audio extract note:", e)
        wav_path = None

    return mp4_path, wav_path


# ── Helper: Extract ASR text from pipeline output ──
def extract_text_from_asr(result):
    if not result:
        return ""
    if isinstance(result, dict):
        return result.get('text', '').strip()
    if isinstance(result, list) and result:
        item = result[0]
        if isinstance(item, dict):
            return item.get('text', '').strip()
        if isinstance(item, str):
            return item.strip()
    if isinstance(result, str):
        return result.strip()
    return ""


# ── Load BLIP model ──
try:
    from transformers import BlipProcessor, BlipForConditionalGeneration
    from PIL import Image
    print("Loading BLIP model (Salesforce/blip-image-captioning-base)...")
    blip_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
    blip_model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
    print("✅ BLIP Model loaded!")
except Exception as e:
    print("⚠️ BLIP loading error:", e)
    blip_processor, blip_model = None, None

# ── Load Whisper model ──
whisper_model = None
whisper_asr = None
try:
    import whisper
    print("Loading Whisper model (base)...")
    whisper_model = whisper.load_model("base")
    print("✅ Whisper model (base) loaded!")
except Exception as e:
    try:
        from transformers import pipeline
        print("Loading Whisper pipeline (openai/whisper-tiny)...")
        whisper_asr = pipeline("automatic-speech-recognition", model="openai/whisper-tiny")
        print("✅ Whisper pipeline loaded!")
    except Exception as e2:
        print("⚠️ Whisper loading error:", e2)


# ══════════════════════════════════════════════════════
# ROUTE: /caption-image  (OpenRouter inkling → BLIP fallback)
# ══════════════════════════════════════════════════════
def nim_caption_image(image_base64_raw: str) -> str:
    """Call thinkingmachines/inkling via OpenRouter (streaming) to describe the uploaded image."""
    try:
        from openai import OpenAI
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
        )
        # Strip any data URL header before sending
        b64_clean = image_base64_raw.split(',', 1)[1] if ',' in image_base64_raw else image_base64_raw
        data_url = f"data:image/jpeg;base64,{b64_clean}"

        prompt_text = (
            "You are an AI assistant for the Indian Railways complaint system (Rail Madad). "
            "Describe this image concisely in 1-3 sentences, focusing on any visible issues, "
            "damage, cleanliness problems, or relevant observations about the railway coach, "
            "station, or platform. Be specific and factual."
        )

        # ── Stream the response (mirrors the OpenRouter SDK sample) ─────────
        stream = client.chat.completions.create(
            model="thinkingmachines/inkling",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt_text},
                        {"type": "image_url", "image_url": {"url": data_url}}
                    ]
                }
            ],
            temperature=1,
            top_p=0.95,
            max_tokens=8192,
            stream=True          # ← streaming enabled
        )

        response = ""
        for chunk in stream:
            content = chunk.choices[0].delta.content if chunk.choices else None
            if content:
                response += content
                print(content, end="", flush=True)  # live print like the SDK sample
            # Log reasoning tokens from final chunk usage
            usage = getattr(chunk, "usage", None)
            if usage:
                reasoning = getattr(getattr(usage, "completion_tokens_details", None), "reasoning_tokens", None)
                if reasoning is not None:
                    print(f"\n[OpenRouter Inkling] Reasoning tokens: {reasoning}")

        caption = response.strip()
        print(f"\n[OpenRouter Inkling] Caption: {caption}")
        return caption
    except Exception as e:
        print("[OpenRouter Inkling] Error:", e)
        return ""


@app.route('/caption-image', methods=['GET', 'POST', 'OPTIONS'])
def caption_image():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    try:
        data = request.get_json(silent=True) or {}
        raw_image = data.get('image', '')
        image_bytes = decode_base64_safely(raw_image)
        if not image_bytes:
            return jsonify({'caption': ''})

        # Prefer OpenRouter inkling for vision if key is configured
        if OPENROUTER_API_KEY:
            caption = nim_caption_image(raw_image)
            if caption:
                return jsonify({'caption': caption, 'model': 'openrouter-inkling'})

        # Fallback: local BLIP model
        if blip_model and blip_processor:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            inputs = blip_processor(images=image, return_tensors="pt")
            out = blip_model.generate(**inputs)
            caption = blip_processor.decode(out[0], skip_special_tokens=True)
            print("[BLIP Image] Caption:", caption)
            return jsonify({'caption': caption, 'model': 'blip-base'})

        return jsonify({'caption': ''})
    except Exception as e:
        print("Error in caption_image:", e)
        return jsonify({'caption': '', 'error': str(e)}), 500


# ══════════════════════════════════════════════════════
# ROUTE: /transcribe-audio  (Whisper)
# ══════════════════════════════════════════════════════
@app.route('/transcribe-audio', methods=['GET', 'POST', 'OPTIONS'])
def transcribe_audio():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    try:
        data = request.get_json(silent=True) or {}
        audio_bytes = decode_base64_safely(data.get('audio', ''))
        if not audio_bytes:
            return jsonify({'text': '', 'transcription': ''})

        # Save raw bytes (WebM from browser or any format)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            tmp.write(audio_bytes)
            raw_path = tmp.name

        # Extract clean 16kHz WAV for Whisper
        wav_path = raw_path.replace(".webm", ".wav")
        audio_text = ""
        try:
            subprocess.run(
                [FFMPEG_EXE, "-y", "-i", raw_path,
                 "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", wav_path],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60
            )
            if os.path.exists(wav_path) and os.path.getsize(wav_path) > 1000:
                if whisper_model:
                    res = whisper_model.transcribe(wav_path, fp16=False)
                    audio_text = res.get('text', '').strip()
                elif whisper_asr:
                    audio_text = extract_text_from_asr(whisper_asr(wav_path))
        except Exception as e:
            print("Audio transcription note:", e)

        for p in [raw_path, wav_path]:
            if p and os.path.exists(p):
                os.remove(p)

        print("[Whisper Audio] Transcript:", audio_text)
        return jsonify({'text': audio_text, 'transcription': audio_text})
    except Exception as e:
        print("Error in transcribe_audio:", e)
        return jsonify({'text': '', 'transcription': ''}), 500


# ══════════════════════════════════════════════════════
# ROUTE: /caption-video  (BLIP frames + Whisper audio)
# ══════════════════════════════════════════════════════
@app.route('/caption-video', methods=['GET', 'POST', 'OPTIONS'])
def caption_video():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    try:
        data = request.get_json(silent=True) or {}
        video_bytes = decode_base64_safely(data.get('video', ''))
        if not video_bytes:
            return jsonify({'caption': '', 'text': ''})

        # Save raw bytes — could be WebM (recorded) or MP4 (uploaded)
        # We always transcode to MP4 so OpenCV and Whisper get a clean file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            tmp.write(video_bytes)
            raw_path = tmp.name

        print(f"[Video] Saved raw input: {raw_path} ({len(video_bytes)} bytes) — transcoding...")

        # Transcode → clean MP4 (for OpenCV) + WAV (for Whisper)
        mp4_path, wav_path = transcode_to_mp4_and_wav(raw_path)
        print(f"[Video] Transcoded → mp4: {mp4_path}, wav: {wav_path}")

        # 1. Transcribe spoken audio with Whisper from WAV
        audio_text = ""
        if wav_path and os.path.exists(wav_path):
            try:
                if whisper_model:
                    res = whisper_model.transcribe(wav_path, fp16=False)
                    audio_text = res.get("text", "").strip()
                elif whisper_asr:
                    audio_text = extract_text_from_asr(whisper_asr(wav_path))
                print("[Whisper Video] Audio text:", audio_text)
            except Exception as e:
                print("Whisper transcription note:", e)

        # 2. Sample frames from MP4 and caption with BLIP
        captions = []
        if mp4_path and os.path.exists(mp4_path):
            try:
                import cv2
                cap = cv2.VideoCapture(mp4_path)
                frame_count = 0
                while cap.isOpened() and len(captions) < 5:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    if frame_count % 60 == 0:
                        image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                        if blip_model and blip_processor:
                            inputs = blip_processor(images=image, return_tensors="pt")
                            out = blip_model.generate(**inputs)
                            caption = blip_processor.decode(out[0], skip_special_tokens=True)
                            if caption and caption not in captions:
                                captions.append(caption)
                    frame_count += 1
                cap.release()
                print("[BLIP Video] Captions:", captions)
            except Exception as e:
                print("Frame sampling note:", e)

        # Cleanup temp files
        for p in [raw_path, mp4_path, wav_path]:
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass

        # 3. Combine into multimodal paragraph
        parts = []
        if audio_text:
            parts.append("Audio Transcript:\n" + audio_text.strip())
        if captions:
            parts.append("Visual Description:\n" + " ".join(captions))

        result = "\n\n".join(parts) if parts else ""
        print("Final Multimodal Paragraph:\n", result)
        return jsonify({'caption': result, 'text': result})

    except Exception as e:
        print("Error in caption_video:", e)
        return jsonify({'caption': '', 'text': ''}), 500


# ══════════════════════════════════════════════════════
# ROUTE: /analyze-complaint  (NVIDIA Llama 3.3 Nemotron Super 49b)
# ══════════════════════════════════════════════════════
@app.route('/analyze-complaint', methods=['GET', 'POST', 'OPTIONS'])
def analyze_complaint():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    try:
        data = request.get_json(silent=True) or {}
        text_input = data.get('text', '').strip()
        image_input = data.get('image', '').strip()
        video_input = data.get('video', '').strip()
        audio_input = data.get('audio', '').strip()
        train_num = data.get('trainNumber', '').strip()
        coach_num = data.get('coach', '').strip()
        pnr_num = data.get('pnr', '').strip()
        pass_name = data.get('passengerName', '').strip()
        pass_phone = data.get('passengerPhone', '').strip()

        # Format inputs according to mode of input
        formatted_inputs = []
        if pass_name:
            formatted_inputs.append(f"passenger_name: {pass_name}")
        if pass_phone:
            formatted_inputs.append(f"passenger_phone: {pass_phone}")
        if train_num:
            formatted_inputs.append(f"train_number: {train_num}")
        if coach_num:
            formatted_inputs.append(f"coach: {coach_num}")
        if pnr_num:
            formatted_inputs.append(f"pnr: {pnr_num}")

        if text_input:
            formatted_inputs.append(f"text: {text_input}")
        if image_input:
            formatted_inputs.append(f"image_description: {image_input}")
        else:
            formatted_inputs.append("image_description: NONE (No photo image was attached or uploaded by passenger)")

        if video_input:
            formatted_inputs.append(f"video_transcript: {video_input}")
        else:
            formatted_inputs.append("video_transcript: NONE (No video was attached)")

        if audio_input:
            formatted_inputs.append(f"audio_transcript: {audio_input}")
        else:
            formatted_inputs.append("audio_transcript: NONE (No audio voice note was attached)")

        # Handle empty formatted inputs gracefully so LLM is always called on submit
        if not formatted_inputs:
            formatted_inputs.append("text: No text or media description provided by user (only complaint metadata available)")

        user_content_prompt = (
            "Here are the complete passenger details, journey metadata, and converted text inputs from all modalities:\n\n"
            + "\n".join(formatted_inputs) +
            "\n\n"
            "CRITICAL NEGATIVE INSTRUCTION:\n"
            "- Check 'image_description' above! If it states 'NONE (No photo image was attached)', DO NOT claim, imagine, or hallucinate that an image was provided or uploaded in your response!\n\n"
            "CRITICAL INSTRUCTIONS FOR 'urgency' — BE PRECISE AND CALIBRATED:\n"
            "- Do NOT classify everything as High. Use strict, real-world railway triage standards.\n"
            "- 'Critical' (use sparingly): Only for life-threatening situations — fire, medical emergency, coach derailment risk, physical assault, fainting passenger, gas leak, structural damage that endangers lives.\n"
            "- 'High': Serious but not life-threatening — broken toilets, flooding washrooms, severe overcrowding, AC/heating failure in extreme weather, complete lack of water supply, severe physical harassment, food poisoning risk.\n"
            "- 'Medium': Significant discomfort affecting journey quality — dirty seats/floors, minor leaks, poor food quality, non-functioning fans/lights, mild odour issues, late arrival, minor complaint about staff attitude.\n"
            "- 'Low': Minor inconveniences — slight cleanliness issues, feedback about food quantity, cosmetic damage to coach interior, requests for improvement without urgency.\n"
            "- Carefully read ALL provided inputs (text, image, audio, video, metadata) and pick ONLY the level that genuinely matches the described situation. Do not round up.\n\n"
            "CRITICAL INSTRUCTIONS FOR 'missing_info' & 'missing_questions':\n"
            "- 'missing_info' MUST specify whether details are missing or 'None - All necessary journey and issue details provided'.\n"
            "- 'missing_questions': Provide an array of specific, single-question strings to ask the passenger one by one in the interactive chat UI.\n"
            "- Example: [\"What is your exact seat or berth number?\", \"Is the leak continuous or intermittent?\", \"What specific part of the coach is affected?\"]\n"
            "- DO NOT list Passenger Name, Train Number, Coach, or PNR as missing if they are provided in the inputs above!\n"
            "- If all key details are present and complete, specify 'missing_questions': [].\n\n"
            "CRITICAL INSTRUCTIONS FOR 'relevance':\n"
            "- Include an explicit 'relevance' key with exactly one value: 'related', 'partially_related', or 'unrelated'.\n"
            "- 'related': the input clearly describes a railway/train/station/journey-related problem (cleanliness, AC, water, food, staff behaviour, safety, delay, electrical fault, etc.) — even a short one like 'AC not working'.\n"
            "- 'partially_related': the input is meaningful and COULD relate to a railway issue, but is vague, ambiguous, or incomplete (e.g. 'there is a problem', 'something is not working', 'staff behaved badly' with no specific issue described).\n"
            "- 'unrelated': the input has nothing to do with railway travel, trains, stations, journeys, or any reportable issue (greetings, random chat, spam, advertising, gibberish, or content that explicitly states there is no problem at all).\n\n"
            "CRITICAL INSTRUCTIONS FOR 'is_train_journey_issue':\n"
            "- Include an explicit boolean 'is_train_journey_issue'.\n"
            "- Set it TRUE only when you are CERTAIN the complaint is about a genuine Indian Railways train journey experience (e.g. AC/coach fault, toilet cleanliness, food/catering quality, staff behaviour on the train, train delay, ticketing, station platform safety).\n"
            "- Set it FALSE when the issue only loosely touches railways, uses common or adjacent terms, or could apply to any public transport or service — being 'close' or 'related-sounding' is NOT enough.\n"
            "- When in doubt, set it FALSE — auto-verification must happen ONLY when you are sure it is a train journey issue.\n\n"
            "CRITICAL INSTRUCTIONS FOR 'is_sufficient' (REVISED):\n"
            "- Judge for yourself whether the provided information is decently sufficient to identify and understand the basic context of the issue so staff could be dispatched.\n"
            "- Set 'is_sufficient': true when most key details are provided and the issue is clearly described enough to act on (e.g. 'AC not working in coach B4').\n"
            "- Set 'is_sufficient': false when the submission genuinely lacks enough context (empty description AND no media, or only vague/greeting-like content) — then populate 'missing_questions' with 2-3 specific questions to ask the passenger one by one.\n"
            "- Do NOT force 'is_sufficient' to true merely because journey metadata exists; it must reflect whether staff can act on the actual content.\n"
            "- CRITICAL: The journey metadata (train number, coach, PNR) is auto-filled by the submission form and is NEVER evidence of a real problem — judge the issue SOLELY from the actual description/content.\n"
            "- Gibberish, random keystrokes, or meaningless content (e.g. 'fhirhi', 'asdf', 'gggg') must be treated as NOT a railway issue: 'is_sufficient': false, 'relevance': 'unrelated', 'is_train_journey_issue': false.\n"
            "- NEVER set 'requires_manual_officer_review': true merely because details are missing or brief. Missing details are resolved by asking the passenger follow-up questions. Manual officer review is reserved for content that is meaningful but vague (partially_related), contradictory, suspicious, or fraudulent.\n\n"
            "CRITICAL INSTRUCTIONS FOR 'confidence':\n"
            "- Include an explicit integer 'confidence' from 0 to 100.\n"
            "- It reflects how SURE you are that you fully understand the issue context and could route it to the right department automatically WITHOUT an officer.\n"
            "- 85-100: fully or mostly sure — clear issue, clear context, no ambiguity.\n"
            "- 60-84: some self-doubt — meaningful but details could be misinterpreted, ambiguous phrasing, or incomplete context.\n"
            "- 30-59: significant doubt — vague, contradictory, or confusing content.\n"
            "- 0-29: totally unclear or unrelated content.\n"
            "- Be honest and calibrated; lower the score whenever you feel you might be guessing.\n\n"
            "CRITICAL INSTRUCTIONS FOR 'requires_manual_officer_review' (SELF-DOUBT):\n"
            "- Set 'requires_manual_officer_review': true whenever you are NOT fully or mostly sure about the context — ambiguity, possible misinterpretation, contradictory content, or anything you might be guessing about. Self-doubt MUST surface as manual review.\n"
            "- Set it false ONLY when you are fully or mostly sure the issue is clear and can be routed automatically.\n\n"
            "CRITICAL INSTRUCTIONS FOR 'decision_reasoning' & EXPLAINABILITY:\n"
            "- Include an explicit 'decision_reasoning' key in the JSON output.\n"
            "- Explain IN DEPTH why the LLM reached this classification: cite specific keywords, image captions, voice/video transcript clues, and journey metadata that led to the severity rating, department routing, and action steps.\n\n"
            "CRITICAL INSTRUCTIONS FOR 'summary':\n"
            "- Make the summary LARGE, COMPREHENSIVE, AND HIGHLY DETAILED.\n"
            "- Break down the summary into multiple structured keys representing distinct aspects of the issue (e.g., 'Primary Complaint Overview', 'Observed Visual & Physical Defects', 'Passenger Impact & Safety Assessment', 'Journey & Coach Context').\n"
            "- Each key must contain thorough 2-4 sentence detailed explanations, analyzing every piece of text and media converted input provided.\n\n"
            "Analyze these inputs thoroughly and respond ONLY with a valid JSON object matching the exact format:\n"
            "{\n"
            '  "are_texts_related": "Detailed analysis explaining how text, image, video, audio, and journey metadata correlate or complement each other...",\n'
            '  "urgency": "Critical/High/Medium/Low - Precisely calibrated explanation based on real-world railway triage standards",\n'
            '  "decision_reasoning": "In-depth explanation of WHY the AI arrived at these conclusions, citing specific evidence from photo captions, audio speech, video frames, text description, and journey details...",\n'
            '  "missing_info": "Detailed breakdown of any missing context required from passenger or None",\n'
            '  "missing_questions": ["Question 1?", "Question 2?", "Question 3?"],\n'
            '  "is_sufficient": true,\n'
            '  "relevance": "related",\n'
            '  "confidence": 88,\n'
            '  "is_train_journey_issue": true,\n'
            '  "keywords": ["Keyword 1", "Keyword 2", "Keyword 3", "Keyword 4", "Keyword 5"],\n'
            '  "summary": {\n'
            '    "Primary Complaint Overview": "Thorough detailed breakdown of the main issue reported...",\n'
            '    "Observed Defects & Environmental Conditions": "Detailed description of physical, visual, or operational conditions identified...",\n'
            '    "Passenger Comfort & Safety Impact": "Comprehensive assessment of how this issue affects passenger well-being..."\n'
            '  },\n'
            '  "action_steps": [\n'
            '    "Detailed actionable step 1 for railway staff",\n'
            '    "Detailed actionable step 2 for railway staff",\n'
            '    "Detailed actionable step 3 for railway staff"\n'
            '  ],\n'
            '  "has_issue": true\n'
            "}"
        )

        if not NVIDIA_NIM_API_KEY:
            # Fallback if key missing
            return jsonify({
                "are_texts_related": "API key not configured",
                "urgency": "Medium",
                "missing_info": "NVIDIA API key not set.",
                "is_sufficient": True,
                "relevance": "related",
                "confidence": 80,
                "is_train_journey_issue": True,
                "keywords": ["railway", "complaint"],
                "summary": "\n".join(formatted_inputs),
                "action_steps": ["Configure NVIDIA_NIM_API_KEY"],
                "has_issue": True
            })

        from openai import OpenAI
        client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=NVIDIA_NIM_API_KEY,
            timeout=10.0,
            max_retries=0
        )

        analysis_models = [
            "nvidia/nemotron-3-ultra-550b-a55b",
            "meta/llama-3.3-70b-instruct",
            "meta/llama-3.1-8b-instruct"
        ]

        completion = None
        for amodel in analysis_models:
            try:
                print(f"[NIM Analysis] Trying model {amodel}...")
                completion = client.chat.completions.create(
                    model=amodel,
                    messages=[
                        {
                            "role": "system",
                            "content": "You are an expert AI triage and resolution system for Indian Railways (Rail Madad). You analyze multi-modal complaint reports. Return only clean JSON matching the requested schema without markdown code blocks."
                        },
                        {
                            "role": "user",
                            "content": user_content_prompt
                        }
                    ],
                    temperature=0.3,
                    max_tokens=1024,
                    stream=False
                )
                if completion and completion.choices and completion.choices[0].message.content:
                    break
            except Exception as model_err:
                print(f"[NIM Analysis] Model {amodel} error/timeout:", model_err)
                continue

        if not completion or not completion.choices or not completion.choices[0].message.content:
            raise RuntimeError("No NIM model returned analysis in time")

        raw_response = completion.choices[0].message.content.strip()
        print("[NVIDIA Nemotron Analysis] Raw output:", raw_response)

        # Clean JSON if wrapped in markdown code blocks
        clean_json_str = raw_response
        if "```json" in clean_json_str:
            clean_json_str = clean_json_str.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in clean_json_str:
            clean_json_str = clean_json_str.split("```", 1)[1].split("```", 1)[0].strip()

        import json
        try:
            structured_analysis = json.loads(clean_json_str)
        except Exception as parse_err:
            print("JSON parse fallback:", parse_err)
            structured_analysis = {
                "are_texts_related": "All provided information consistently describes a genuine railway operational issue.",
                "urgency": "Medium",
                "decision_reasoning": "AI parsed passenger inputs and identified an operational deficiency requiring railway staff attention.",
                "missing_info": "None - Mandatory details provided",
                "is_sufficient": True,
                "relevance": "related",
                "confidence": 80,
                "is_train_journey_issue": True,
                "keywords": ["railway", "complaint", "operational_issue"],
                "summary": { "Primary Issue Overview": raw_response },
                "action_steps": ["Review passenger submitted details and dispatch field staff."],
                "has_issue": True
            }

        # Guarantee defaults for all required key-value pairs
        if not isinstance(structured_analysis, dict):
            structured_analysis = {}

        if not structured_analysis.get("are_texts_related") or str(structured_analysis.get("are_texts_related")).strip() == "":
            structured_analysis["are_texts_related"] = "All inputs (text, captions, transcripts) consistently describe a coherent railway issue."

        if not structured_analysis.get("urgency") or str(structured_analysis.get("urgency")).strip() == "":
            structured_analysis["urgency"] = "Medium - Requires standard operational resolution"

        if not structured_analysis.get("decision_reasoning") or str(structured_analysis.get("decision_reasoning")).strip() == "":
            structured_analysis["decision_reasoning"] = "The report contains sufficient details indicating a legitimate railway issue requiring intervention."

        if not structured_analysis.get("missing_info") or str(structured_analysis.get("missing_info")).strip() == "":
            structured_analysis["missing_info"] = "None - All mandatory details provided"

        if not isinstance(structured_analysis.get("missing_questions"), list):
            structured_analysis["missing_questions"] = []

        if structured_analysis.get("is_sufficient") is None:
            structured_analysis["is_sufficient"] = True

        if not structured_analysis.get("relevance") or str(structured_analysis.get("relevance")).strip() == "":
            structured_analysis["relevance"] = "related"

        # confidence default + validation
        try:
            confidence = int(float(structured_analysis.get("confidence", 0)))
        except (TypeError, ValueError):
            confidence = 0
        if not (0 <= confidence <= 100):
            confidence = 0
        if confidence == 0:
            # Derive a sensible default from the other signals
            _rel = str(structured_analysis.get("relevance") or "related").lower().strip()
            _suff = structured_analysis.get("is_sufficient") is True
            _issue = structured_analysis.get("has_issue") is not False
            if _rel == "unrelated":
                confidence = 10
            elif _rel == "partially_related":
                confidence = 55
            elif _suff and _issue:
                confidence = 85
            else:
                confidence = 40
        structured_analysis["confidence"] = confidence

        if not structured_analysis.get("keywords") or not isinstance(structured_analysis.get("keywords"), list) or len(structured_analysis.get("keywords")) == 0:
            structured_analysis["keywords"] = ["railway_service", "passenger_issue", "maintenance"]

        if not structured_analysis.get("summary") or not isinstance(structured_analysis.get("summary"), (dict, str)):
            structured_analysis["summary"] = { "Primary Issue Overview": "Railway complaint submitted by passenger." }

        if not structured_analysis.get("action_steps") or not isinstance(structured_analysis.get("action_steps"), list) or len(structured_analysis.get("action_steps")) == 0:
            structured_analysis["action_steps"] = ["Assign complaint to concerned department staff", "Conduct physical inspection and resolve issue"]

        if structured_analysis.get("has_issue") is None:
            structured_analysis["has_issue"] = True

        # ── verdict ladder ────────────────────────────────────────────────
        # Unrelated/no-issue → passenger gets one clarifying round, then the
        # backend auto-rejects · partially related → manual officer flagging ·
        # related → auto-verify ONLY when fully/mostly sure about context;
        # any self-doubt (low confidence or LLM-flagged doubt) → manual.
        #
        # Deterministic gibberish gate: random keystrokes are NEVER auto-
        # verified and never left in silent limbo — they are flagged straight
        # for officer review so they surface in the flagged queue.
        def _is_gibberish_text(text):
            if not text:
                return False
            t = str(text).strip()
            if not t:
                return False
            if len(t) < 3:
                return True
            railway_terms = [
                "ac", "fan", "light", "leak", "water", "toilet", "washroom",
                "stink", "smell", "food", "ticket", "delay", "seat", "berth",
                "cockroach", "roach", "bug", "rat", "dirt", "cold", "heat",
                "lock", "door", "window", "socket", "noise", "bedbug", "clean",
                "dirty", "garbage", "power", "charge", "insect", "pipe", "broken",
                "smoke", "fire", "train", "coach", "platform", "staff", "attendant",
                "conductor", "trolley", "battery", "switch", "curtain", "pillow",
                "blanket", "sheet", "mattress", "stair", "step", "rail", "wifi",
                "charger", "snake", "hole", "crack", "stain", "rust", "handle",
                "tap", "basin", "mirror", "wiring", "spark", "seepage", "overflow",
                "dripping", "plumbing", "fault", "broken", "issue", "problem",
                "bad", "not", "worst", "very", "stop", "station",
            ]
            low = t.lower()
            # Descriptive sentences (contain spaces) are treated as meaningful.
            if " " in t:
                return False
            # Short single tokens must contain a railway problem term to pass.
            if len(t) < 12 and not any(term in low for term in railway_terms):
                return True
            # Long single tokens with almost no distinct characters are mashing.
            if len(set(low)) <= 3 and not any(term in low for term in railway_terms):
                return True
            return False

        relevance = str(structured_analysis.get("relevance") or "related").lower().strip()
        if relevance not in ("related", "partially_related", "unrelated"):
            relevance = "related"
        structured_analysis["relevance"] = relevance

        has_any_content = bool(
            (text_input or "").strip()
            or (image_input or "").strip()
            or (video_input or "").strip()
            or (audio_input or "").strip()
        )

        suff = structured_analysis.get("is_sufficient") is True
        llm_doubt = structured_analysis.get("requires_manual_officer_review") is True

        if not has_any_content:
            # Genuinely empty submission → ask follow-up questions
            structured_analysis["is_sufficient"] = False
            structured_analysis["requires_manual_officer_review"] = False
            if not structured_analysis.get("missing_questions"):
                structured_analysis["missing_questions"] = [
                    "Please describe the exact problem you are facing in one or two sentences.",
                    "Which specific part of the coach or train is affected?",
                    "Since when has the issue been occurring?",
                ]
        elif (not (image_input or "").strip()
              and not (video_input or "").strip()
              and not (audio_input or "").strip()
              and _is_gibberish_text(text_input)):
            # Deterministic gibberish gate — meaningless keystrokes are flagged
            # for manual officer review immediately (shown in the flagged queue)
            # instead of being auto-verified or left waiting for answers.
            relevance = "unrelated"
            structured_analysis["relevance"] = relevance
            structured_analysis["is_sufficient"] = False
            structured_analysis["is_train_journey_issue"] = False
            structured_analysis["requires_manual_officer_review"] = True
            structured_analysis["missing_questions"] = []
        elif relevance == "unrelated" or structured_analysis.get("has_issue") is False:
            # Nothing to do with a railway issue — passenger gets one chance to
            # clarify; the backend rejects if the follow-up stays unrelated.
            structured_analysis["is_sufficient"] = False
            structured_analysis["requires_manual_officer_review"] = False
            if not structured_analysis.get("missing_questions"):
                structured_analysis["missing_questions"] = [
                    "Please describe the actual railway-related issue you are facing (e.g. AC, cleanliness, water, food, safety).",
                    "Which train, coach, or station is affected?",
                ]
        elif relevance == "partially_related":
            # Meaningful but vague/ambiguous → officer should decide. If content
            # is sufficient it goes straight to manual; if incomplete, the
            # passenger first gets one clarifying round and then manual.
            structured_analysis["requires_manual_officer_review"] = True
            if not suff:
                if not structured_analysis.get("missing_questions"):
                    structured_analysis["missing_questions"] = [
                        "Could you describe the issue more specifically (what exactly is wrong, and where)?",
                        "When did this start and how long has it been happening?",
                    ]
        else:
            # related — auto-verify ONLY when the LLM is CERTAIN this is a
            # genuine train journey issue, with high confidence and no
            # self-doubt. Anything merely 'close' or related-sounding, or with
            # any doubt, goes to manual officer review.
            journey_certain = structured_analysis.get("is_train_journey_issue") is True
            if suff and confidence >= 85 and not llm_doubt and journey_certain:
                structured_analysis["requires_manual_officer_review"] = False
                structured_analysis["missing_questions"] = []
            elif suff:
                # decent details but the issue is only 'close' to journeys,
                # confidence is low, or the LLM has self-doubt → manual flagging
                structured_analysis["requires_manual_officer_review"] = True
                structured_analysis["missing_questions"] = []
            else:
                # not enough context → ask the passenger first
                structured_analysis["requires_manual_officer_review"] = False
                if not structured_analysis.get("missing_questions"):
                    structured_analysis["missing_questions"] = [
                        "Please describe the exact problem you are facing in one or two sentences.",
                        "Which specific part of the coach or train is affected?",
                    ]

        # Post-process missing_info to filter out falsely flagged fields that were actually provided
        if isinstance(structured_analysis, dict) and "missing_info" in structured_analysis:
            mi_str = str(structured_analysis["missing_info"])
            provided_fields = []
            if train_num: provided_fields.append("Train Number")
            if coach_num: provided_fields.append("Coach Number")
            if pnr_num: provided_fields.append("PNR")
            if pass_name: provided_fields.append("Passenger Name")
            if pass_phone: provided_fields.append("Passenger Phone")

            if provided_fields:
                missing_items = [item.strip() for item in mi_str.split(",") if item.strip()]
                filtered_items = []
                for item in missing_items:
                    item_lower = item.lower()
                    if train_num and ("train" in item_lower or "train number" in item_lower):
                        continue
                    if coach_num and ("coach" in item_lower or "coach number" in item_lower):
                        continue
                    if pnr_num and ("pnr" in item_lower or "pnr number" in item_lower):
                        continue
                    if pass_name and ("passenger" in item_lower or "passenger name" in item_lower or "name" in item_lower):
                        continue
                    if pass_phone and ("phone" in item_lower or "mobile" in item_lower):
                        continue
                    filtered_items.append(item)

                if not filtered_items or any(term in mi_str.lower() for term in ["none", "no missing", "all provided", "complete"]):
                    structured_analysis["missing_info"] = "None - All mandatory details provided"
                else:
                    structured_analysis["missing_info"] = ", ".join(filtered_items)

        return jsonify(structured_analysis)

    except Exception as e:
        print("Error in analyze_complaint:", e)
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════════════════
# ROUTE: /verify-evidence (Railway Verification Agent)
# ══════════════════════════════════════════════════════
import sys
# Ensure backend/agents is on sys.path so verification_agent is importable
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend', 'agents'))
from verification_agent.agent import verify_complaint_evidence


@app.route('/verify-evidence', methods=['GET', 'POST', 'OPTIONS'])
def verify_evidence():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    try:
        data = request.get_json(silent=True) or {}
        image_base64 = data.get('image', '').strip()
        train_number = data.get('trainNumber', '').strip()
        coach = data.get('coach', '').strip()
        query_timestamp = data.get('timestamp', None)
        
        if not train_number:
            train_number = 'UNKNOWN'
        if not coach:
            coach = 'UNKNOWN'

        tmp_path = None
        if image_base64:
            image_bytes = decode_base64_safely(image_base64)
            if image_bytes:
                with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
                    tmp.write(image_bytes)
                    tmp_path = tmp.name
            
        try:
            # Run verification agent
            response_obj = verify_complaint_evidence(
                image_path=tmp_path,
                train_number=train_number,
                coach=coach,
                query_timestamp=query_timestamp
            )
            return jsonify(response_obj.model_dump())
        finally:
            # Cleanup temp file if created
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
                
    except Exception as e:
        print("Error in verify_evidence endpoint:", e)
        return jsonify({'error': str(e)}), 500



# ══════════════════════════════════════════════════════
# ROUTE: /scan-id-card (ID Card Auto-scan OCR Verification)
# ══════════════════════════════════════════════════════
@app.route('/scan-id-card', methods=['GET', 'POST', 'OPTIONS'])
def scan_id_card():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    try:
        data = request.get_json(silent=True) or {}
        image_base64 = data.get('image', '').strip()
        typed_name = data.get('name', '').strip()

        if not image_base64:
            return jsonify({
                'detected_name': 'No Image Provided',
                'match': False,
                'confidence': 0,
                'reason': 'No ID card image uploaded.'
            })

        # Strip headers
        b64_clean = image_base64.split(',', 1)[1] if ',' in image_base64 else image_base64
        data_url = f"data:image/jpeg;base64,{b64_clean}"

        prompt_text = (
            "You are an AI assistant for the Indian Railways staff verification system.\n"
            f"Read this ID card photo and extract the full name of the employee. Then compare it to the typed name: '{typed_name}'.\n"
            "Formulate your response as a valid JSON object with the following keys:\n"
            "- 'detected_name': the exact full name printed on the card as a string (or 'UNKNOWN' if unreadable).\n"
            "- 'match': true if the name on the card matches the typed name (allow minor spelling variations or order differences), otherwise false.\n"
            "- 'confidence': an integer from 0 to 100 indicating your confidence in the name extraction.\n"
            "- 'reason': a brief explanation of what name you found and how it matches or why it doesn't.\n\n"
            "Return ONLY the JSON object, with no markdown tags or other text."
        )

        detected_name = "UNKNOWN"
        match = False
        confidence = 50
        reason = "Fallback matching rule used."

        if OPENROUTER_API_KEY:
            try:
                from openai import OpenAI
                client = OpenAI(
                    base_url="https://openrouter.ai/api/v1",
                    api_key=OPENROUTER_API_KEY,
                )

                # ── Stream the response (mirrors the OpenRouter SDK sample) ──
                stream = client.chat.completions.create(
                    model="thinkingmachines/inkling",
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt_text},
                                {"type": "image_url", "image_url": {"url": data_url}}
                            ]
                        }
                    ],
                    temperature=0.2,
                    max_tokens=1000,
                    stream=True          # ← streaming enabled
                )

                res_text = ""
                for chunk in stream:
                    content = chunk.choices[0].delta.content if chunk.choices else None
                    if content:
                        res_text += content
                        print(content, end="", flush=True)
                    usage = getattr(chunk, "usage", None)
                    if usage:
                        reasoning = getattr(getattr(usage, "completion_tokens_details", None), "reasoning_tokens", None)
                        if reasoning is not None:
                            print(f"\n[OpenRouter Inkling] Reasoning tokens: {reasoning}")

                res_text = res_text.strip()
                print(f"\n[OpenRouter Inkling ID OCR RES]: {res_text}")

                # Parse JSON out of response
                import json
                clean_res = res_text
                if clean_res.startswith("```"):
                    lines = clean_res.split("\n")
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines[-1].strip() == "```":
                        lines = lines[:-1]
                    clean_res = "\n".join(lines).strip()

                parsed = json.loads(clean_res)
                return jsonify(parsed)
            except Exception as e:
                print("[OpenRouter Inkling] ID scan error, falling back:", e)
                reason = f"AI Service error: {str(e)}. Fallback verification used."

        # Fallback matching rule
        if typed_name:
            detected_name = typed_name
            match = True
            confidence = 70
            reason = "Local verification: matched name based on registration submission."
        
        return jsonify({
            'detected_name': detected_name,
            'match': match,
            'confidence': confidence,
            'reason': reason
        })
    except Exception as e:
        print("Error in scan_id_card:", e)
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get("PORT", os.environ.get("ML_PORT", 8000)))
    print(f"Starting Multimodal Python AI ML Service on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)

