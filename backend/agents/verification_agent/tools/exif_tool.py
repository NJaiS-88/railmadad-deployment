from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS

def get_decimal_from_dms(dms, ref):
    degrees = dms[0]
    minutes = dms[1]
    seconds = dms[2]
    
    if hasattr(degrees, 'numerator'):
        degrees = float(degrees.numerator) / float(degrees.denominator)
    if hasattr(minutes, 'numerator'):
        minutes = float(minutes.numerator) / float(minutes.denominator)
    if hasattr(seconds, 'numerator'):
        seconds = float(seconds.numerator) / float(seconds.denominator)
        
    decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
    if ref in ['S', 'W']:
        decimal = -decimal
    return decimal

def extract_exif(image_path):
    try:
        img = Image.open(image_path)
        exif_data = img._getexif()
        if not exif_data:
            return {"has_gps": False, "metadata_available": False, "reason": "No EXIF data found"}
            
        exif = {}
        for tag, value in exif_data.items():
            decoded = TAGS.get(tag, tag)
            exif[decoded] = value
            
        has_gps = False
        latitude = None
        longitude = None
        timestamp = exif.get("DateTimeOriginal") or exif.get("DateTime")
        
        if timestamp:
            parts = timestamp.split(' ', 1)
            if len(parts) == 2:
                date_part = parts[0].replace(':', '-')
                timestamp = f"{date_part}T{parts[1]}"

        gps_info = exif.get("GPSInfo")
        if gps_info:
            gps_data = {}
            for t in gps_info:
                sub_decoded = GPSTAGS.get(t, t)
                gps_data[sub_decoded] = gps_info[t]
                
            lat_dms = gps_data.get("GPSLatitude")
            lat_ref = gps_data.get("GPSLatitudeRef")
            lon_dms = gps_data.get("GPSLongitude")
            lon_ref = gps_data.get("GPSLongitudeRef")
            
            if lat_dms and lat_ref and lon_dms and lon_ref:
                try:
                    latitude = get_decimal_from_dms(lat_dms, lat_ref)
                    longitude = get_decimal_from_dms(lon_dms, lon_ref)
                    has_gps = True
                except Exception as e:
                    print("Error parsing GPS coordinates:", e)
                    
        return {
            "has_gps": has_gps,
            "latitude": latitude,
            "longitude": longitude,
            "timestamp": timestamp,
            "metadata_available": True
        }
    except Exception as e:
        return {"has_gps": False, "metadata_available": False, "reason": str(e)}
