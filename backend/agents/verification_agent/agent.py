import os
import argparse
import json
import sys
from datetime import datetime

# ── Allow running directly as a script AND as a package import ────────────────
# When run as `python agent.py`, relative imports fail because Python doesn't
# know the parent package. We detect this and fall back to absolute imports.
if __package__:
    # Imported as part of the verification_agent package (e.g., by ml_service.py)
    from .tools.exif_tool import extract_exif
    from .tools.train_position_tool import get_train_position
    from .tools.distance_tool import calculate_distance
    from .tools.ocr_tool import extract_coach_number
    from .tools.scoring_tool import calculate_suspicion
    from .schemas import VerificationResponse, PhotoMetadata, TrainPosition, OCRResult
    from .prompts import VERIFICATION_EXPLANATION_PROMPT
    from .config import LOCATION_THRESHOLD_KM
else:
    # Run directly: `python agent.py`
    _dir = os.path.dirname(os.path.abspath(__file__))
    if _dir not in sys.path:
        sys.path.insert(0, _dir)
    from tools.exif_tool import extract_exif
    from tools.train_position_tool import get_train_position
    from tools.distance_tool import calculate_distance
    from tools.ocr_tool import extract_coach_number
    from tools.scoring_tool import calculate_suspicion
    from schemas import VerificationResponse, PhotoMetadata, TrainPosition, OCRResult
    from prompts import VERIFICATION_EXPLANATION_PROMPT
    from config import LOCATION_THRESHOLD_KM

# ── Load .env (root and verification_agent's own .env) ───────────────────────
try:
    from dotenv import load_dotenv
    _here = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(_here, ".env"))
    load_dotenv(os.path.join(_here, "..", "..", "..", ".env"))  # root .env
except ImportError:
    pass

def generate_explanation(train_number, entered_coach, location_match, distance_km, coach_match, detected_coach, suspicion_score, risk_level, reasons):
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        return f"Verification check completed with risk level {risk_level}. " + " ".join(reasons)
        
    try:
        from openai import OpenAI
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
            timeout=25.0,
            max_retries=1
        )
        
        prompt = VERIFICATION_EXPLANATION_PROMPT.format(
            train_number=train_number,
            entered_coach=entered_coach,
            location_match="MATCH" if location_match else "MISMATCH",
            distance_km=distance_km,
            coach_match="MATCH" if coach_match else "MISMATCH",
            detected_coach=detected_coach,
            suspicion_score=suspicion_score,
            risk_level=risk_level,
            reasons=", ".join(reasons)
        )
        
        models = [
            "meta-llama/llama-3.3-70b-instruct",
            "meta-llama/llama-3.1-8b-instruct",
            "google/gemini-2.0-flash-001",
            "openai/gpt-4o-mini"
        ]
        
        for m in models:
            try:
                completion = client.chat.completions.create(
                    model=m,
                    messages=[
                        {"role": "system", "content": "You are a professional railway safety verification officer. Write concise explanations."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.3,
                    max_tokens=256
                )
                if completion and completion.choices and completion.choices[0].message.content:
                    return completion.choices[0].message.content.strip()
            except Exception as merr:
                print(f"Warning: Model {m} failed for verification explanation:", merr)
                continue
                
        return f"Verification check completed with risk level {risk_level}. " + " ".join(reasons)
    except Exception as e:
        print("Warning: Failed to generate OpenRouter LLM explanation:", e)
        return f"Verification check completed with risk level {risk_level}. " + " ".join(reasons)

def verify_complaint_evidence(image_path, train_number, coach, query_timestamp=None):
    # Step 1: Extract EXIF metadata (if image is present)
    exif_res = extract_exif(image_path) if image_path else {"has_gps": False}
    photo_timestamp = exif_res.get("timestamp")
    if not photo_timestamp:
        photo_timestamp = query_timestamp or datetime.now().isoformat()
        
    # Step 2: Get train location at photo timestamp
    train_pos_res = get_train_position(train_number, photo_timestamp)
    
    # Step 3 & 4: Calculate distance and verify location
    location_match = None
    distance_km = None
    train_position = None
    
    gps_available = exif_res.get("has_gps", False)
    location_available = False
    
    if gps_available and "error" not in train_pos_res:
        photo_lat = exif_res.get("latitude")
        photo_lon = exif_res.get("longitude")
        train_lat = train_pos_res.get("latitude")
        train_lon = train_pos_res.get("longitude")
        
        dist_res = calculate_distance(photo_lat, photo_lon, train_lat, train_lon)
        distance_km = dist_res.get("distance_km")
        
        # Soft threshold
        location_match = (distance_km <= LOCATION_THRESHOLD_KM)
        location_available = True
        train_position = TrainPosition(
            latitude=train_lat,
            longitude=train_lon,
            source=train_pos_res.get("source", "mock"),
            interpolated=train_pos_res.get("interpolated", False)
        )
        
    # Step 5: OCR coach verification (if image is present)
    ocr_res = extract_coach_number(image_path, coach) if image_path else {"ocr_available": False}
    ocr_available = ocr_res.get("ocr_available", False)
    
    # Step 6 & 7: Scoring and Risk Levels
    scoring_res = calculate_suspicion(
        location_available=location_available,
        location_match=location_match,
        coach_available=ocr_available,
        coach_match=ocr_res.get("coach_match") if ocr_available else None,
        distance_km=distance_km or 0.0
    )
    
    # Step 8: Generate explanation and compile response
    reasons = scoring_res.get("reasons", [])
    explanation = generate_explanation(
        train_number=train_number,
        entered_coach=coach,
        location_match=location_match,
        distance_km=distance_km or 0.0,
        coach_match=ocr_res.get("coach_match"),
        detected_coach=ocr_res.get("ocr_text"),
        suspicion_score=scoring_res.get("suspicion_score"),
        risk_level=scoring_res.get("risk_level"),
        reasons=reasons
    )
    
    # Add explanation as the final reason or prefix
    reasons.insert(0, explanation)
    
    photo_metadata = PhotoMetadata(
        gps_available=gps_available,
        latitude=exif_res.get("latitude"),
        longitude=exif_res.get("longitude"),
        timestamp=exif_res.get("timestamp")
    )
    
    ocr_result = OCRResult(
        detected_coach=ocr_res.get("ocr_text"),
        coach_match=ocr_res.get("coach_match"),
        edit_distance=ocr_res.get("edit_distance")
    )
    
    response = VerificationResponse(
        verification_status=scoring_res.get("verification_status"),
        risk_level=scoring_res.get("risk_level"),
        suspicion_score=scoring_res.get("suspicion_score"),
        train_number=str(train_number),
        entered_coach=coach,
        photo_metadata=photo_metadata,
        train_position=train_position,
        distance_km=distance_km,
        location_match=location_match,
        ocr=ocr_result,
        human_review_required=scoring_res.get("human_review_required"),
        reasons=reasons
    )
    
    return response

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Railway Evidence Verification Agent")
    parser.add_argument("--image", required=True, help="Path to evidence image")
    parser.add_argument("--train_number", required=True, help="Passenger claimed train number")
    parser.add_argument("--coach", required=True, help="Passenger claimed coach number")
    parser.add_argument("--timestamp", help="Optional timestamp to override EXIF/current time")
    
    args = parser.parse_args()
    
    result = verify_complaint_evidence(
        image_path=args.image,
        train_number=args.train_number,
        coach=args.coach,
        query_timestamp=args.timestamp
    )
    
    print(json.dumps(result.model_dump(), indent=2))
