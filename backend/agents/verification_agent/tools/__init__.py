import os
import sys

if __package__:
    from .exif_tool import extract_exif
    from .train_position_tool import get_train_position
    from .distance_tool import calculate_distance
    from .ocr_tool import extract_coach_number
    from .scoring_tool import calculate_suspicion
else:
    _dir = os.path.dirname(os.path.abspath(__file__))
    if _dir not in sys.path:
        sys.path.insert(0, _dir)
    from exif_tool import extract_exif
    from train_position_tool import get_train_position
    from distance_tool import calculate_distance
    from ocr_tool import extract_coach_number
    from scoring_tool import calculate_suspicion
