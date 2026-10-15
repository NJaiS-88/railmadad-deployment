# backend/agents/verification_agent/tools/scoring_tool.py

LOCATION_THRESHOLD_KM = 5.0
W1 = 1.0  # Location mismatch weight signal
W2 = 1.0  # Coach OCR mismatch weight signal

def calculate_suspicion(location_available, location_match, coach_available, coach_match, distance_km=0.0):
    flag_location = 0
    flag_ocr = 0
    reasons = []
    
    # 1. Extract EXIF & Live Train Position Distance Check
    if location_available:
        if location_match:
            reasons.append(f"Photo location matches live train route (distance {distance_km} km is within {LOCATION_THRESHOLD_KM} km threshold).")
        else:
            flag_location = 1
            reasons.append(f"Photo location mismatch (distance {distance_km} km exceeds {LOCATION_THRESHOLD_KM} km threshold).")
    else:
        reasons.append("GPS metadata is unavailable for location verification.")
        
    # 2. OCR Coach Number Cross-Check (Levenshtein edit distance <= 1 threshold)
    if coach_available:
        if coach_match is not None:
            if coach_match:
                reasons.append("Coach number verified via OCR (Levenshtein distance <= 1).")
            else:
                flag_ocr = 1
                reasons.append("Coach number mismatch between OCR extracted text and passenger claim (Levenshtein distance > 1).")
        else:
            reasons.append("Coach number verification unavailable (OCR failed).")
    else:
        reasons.append("Coach OCR verification unavailable.")

    # 3. Calculate Suspicion Score: Score = w1 * Flag_location + w2 * Flag_ocr
    suspicion_score = (W1 * flag_location) + (W2 * flag_ocr)

    # 4. Map Suspicion Score to Risk Level (0 -> Green/Low, 1 -> Yellow/Medium, 2 -> Red/High)
    if suspicion_score >= 2:
        risk_level = "Red"
        verification_status = "FLAGGED"
        human_review_required = True
        reasons.append("High suspicion (Score 2): Both location and OCR signals fired. MUST review by human officer.")
    elif suspicion_score == 1:
        risk_level = "Yellow"
        verification_status = "SUSPICIOUS"
        human_review_required = True
        reasons.append("Medium suspicion (Score 1): One verification signal fired. Flagged for officer review.")
    else:
        risk_level = "Green"
        verification_status = "VERIFIED"
        human_review_required = False
        reasons.append("Low suspicion (Score 0): Evidence matches train claims successfully.")

    return {
        "suspicion_score": float(suspicion_score),
        "risk_level": risk_level,
        "verification_status": verification_status,
        "human_review_required": human_review_required,
        "reasons": reasons
    }

