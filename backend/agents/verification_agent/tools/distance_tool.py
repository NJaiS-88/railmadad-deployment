import math

def calculate_haversine_distance(lat1, lon1, lat2, lon2):
    # Earth radius in km
    R = 6371.0
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance = R * c
    return {"distance_km": round(distance, 3)}

def calculate_distance(photo_lat, photo_lon, train_lat, train_lon):
    return calculate_haversine_distance(photo_lat, photo_lon, train_lat, train_lon)
