import os

# Threshold settings
LOCATION_THRESHOLD_KM = float(os.environ.get("LOCATION_THRESHOLD_KM", 5.0))

# Decision Weights
LOCATION_WEIGHT = float(os.environ.get("LOCATION_WEIGHT", 0.6))
COACH_WEIGHT = float(os.environ.get("COACH_WEIGHT", 0.4))
