from pydantic import BaseModel, Field
from typing import List, Optional

class PhotoMetadata(BaseModel):
    gps_available: bool
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timestamp: Optional[str] = None

class TrainPosition(BaseModel):
    latitude: float
    longitude: float
    source: str
    interpolated: bool
    delay_minutes: Optional[int] = 0
    confidence: Optional[float] = 1.0

class OCRResult(BaseModel):
    detected_coach: Optional[str] = None
    coach_match: Optional[bool] = None
    edit_distance: Optional[int] = None

class VerificationResponse(BaseModel):
    verification_status: str
    risk_level: str
    suspicion_score: float
    train_number: str
    entered_coach: str
    photo_metadata: PhotoMetadata
    train_position: Optional[TrainPosition] = None
    distance_km: Optional[float] = None
    location_match: Optional[bool] = None
    ocr: OCRResult
    human_review_required: bool
    reasons: List[str]
