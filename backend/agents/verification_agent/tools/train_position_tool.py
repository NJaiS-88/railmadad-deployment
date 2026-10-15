import os
import json
import urllib.request
import ssl
from datetime import datetime, timedelta

def query_railradar_api(endpoint):
    api_key = os.environ.get("RAILRADAR_API_KEY", "").strip()
    url = f"https://api.railradar.in/v1/{endpoint}"
    req = urllib.request.Request(url)
    if api_key:
        req.add_header("Authorization", f"Bearer {api_key}")
        
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Error querying RailRadar API ({endpoint}): {e}")
        return None

def parse_iso_datetime(dt_str):
    if not dt_str:
        return None
    try:
        # Strip timezone offset if present (e.g. +05:30)
        clean_str = dt_str
        if '+' in clean_str:
            clean_str = clean_str.split('+')[0]
        return datetime.fromisoformat(clean_str)
    except Exception:
        return None

def parse_time_with_date(time_str, base_date, day_offset=1):
    if not time_str or time_str == "--":
        return None
    try:
        # time_str could be "HH:MM" or "HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS+05:30"
        if 'T' in time_str:
            return parse_iso_datetime(time_str)
            
        time_parts = time_str.split(':')
        hour = int(time_parts[0])
        minute = int(time_parts[1])
        second = int(time_parts[2]) if len(time_parts) > 2 else 0
        
        dt = datetime(base_date.year, base_date.month, base_date.day, hour, minute, second)
        dt += timedelta(days=(day_offset - 1))
        return dt
    except Exception:
        return None

def get_train_position(train_number, timestamp_query):
    query_dt = parse_iso_datetime(timestamp_query)
    if not query_dt:
        query_dt = datetime.now()
        
    # 1. Fetch Train Details (always needed for station coordinates)
    details = query_railradar_api(f"trains/{train_number}")
    if not details or not details.get("success") or "data" not in details:
        return {"error": f"Failed to retrieve train details for {train_number}"}
        
    data_details = details["data"]
    train_info = data_details.get("train", {})
    route_details = data_details.get("route", [])
    
    # Map station codes to coordinates and schedules
    stations_map = {}
    for stop in route_details:
        station = stop.get("station", {})
        code = station.get("code")
        if code:
            stations_map[code] = {
                "name": station.get("name"),
                "lat": float(station.get("lat")) if station.get("lat") else None,
                "lng": float(station.get("lng")) if station.get("lng") else None,
                "isHalt": stop.get("isHalt", False),
                "arrival": stop.get("arrival"),
                "departure": stop.get("departure"),
                "arrivalDay": stop.get("arrivalDay", 1),
                "departureDay": stop.get("departureDay", 1),
                "sequence": stop.get("sequence")
            }
            
    # 2. Fetch Live Train Status
    live = query_railradar_api(f"trains/{train_number}/live")
    
    # Try live real-time position if available
    if live and live.get("success") and "data" in live:
        live_data = live["data"]
        is_live = live_data.get("isLive", False)
        tracking_mode = live_data.get("trackingMode", "")
        
        if is_live:
            curr_loc = live_data.get("currentLocation", {})
            status = curr_loc.get("status", "").lower()
            station_code = curr_loc.get("stationCode")
            progress = curr_loc.get("segmentProgress")
            
            # If stopped at a station
            if status in ["arrived", "halted"] and station_code in stations_map:
                st = stations_map[station_code]
                if st["lat"] is not None and st["lng"] is not None:
                    return {
                        "train_number": str(train_number),
                        "train_name": train_info.get("name", "Unknown Train"),
                        "timestamp": timestamp_query,
                        "latitude": st["lat"],
                        "longitude": st["lng"],
                        "source": "actual",
                        "interpolated": False,
                        "delay_minutes": live_data.get("delayMinutes", 0),
                        "confidence": 1.0
                    }
                    
            # If in transit, interpolate between previous and next halt
            prev_halt = live_data.get("previousHalt", {})
            next_halt = live_data.get("nextHalt", {})
            prev_code = prev_halt.get("stationCode")
            next_code = next_halt.get("stationCode")
            
            if prev_code in stations_map and next_code in stations_map:
                st_prev = stations_map[prev_code]
                st_next = stations_map[next_code]
                
                if (st_prev["lat"] is not None and st_prev["lng"] is not None and 
                    st_next["lat"] is not None and st_next["lng"] is not None):
                    
                    prog_val = float(progress) if progress is not None else 0.5
                    prog_val = max(0.0, min(1.0, prog_val))
                    
                    lat = st_prev["lat"] + prog_val * (st_next["lat"] - st_prev["lat"])
                    lon = st_prev["lng"] + prog_val * (st_next["lng"] - st_prev["lng"])
                    
                    return {
                        "train_number": str(train_number),
                        "train_name": train_info.get("name", "Unknown Train"),
                        "timestamp": timestamp_query,
                        "latitude": lat,
                        "longitude": lon,
                        "source": "estimated",
                        "interpolated": True,
                        "delay_minutes": live_data.get("delayMinutes", 0),
                        "confidence": 0.9
                    }
                    
    # 3. Fallback to Scheduled Estimate based on timetable
    # Calculate base date of the train start (default to query date)
    base_date = query_dt.date()
    
    # Sort route by sequence to build intervals
    sorted_stops = sorted(route_details, key=lambda s: s.get("sequence", 0))
    
    schedule_times = []
    for stop in sorted_stops:
        station = stop.get("station", {})
        code = station.get("code")
        st_info = stations_map.get(code)
        if not st_info or st_info["lat"] is None or st_info["lng"] is None:
            continue
            
        arr_dt = parse_time_with_date(stop.get("arrival"), base_date, stop.get("arrivalDay", 1))
        dep_dt = parse_time_with_date(stop.get("departure"), base_date, stop.get("departureDay", 1))
        
        # For first station, arrival is same as departure
        if not arr_dt:
            arr_dt = dep_dt
        # For last station, departure is same as arrival
        if not dep_dt:
            dep_dt = arr_dt
            
        schedule_times.append({
            "code": code,
            "lat": st_info["lat"],
            "lng": st_info["lng"],
            "arr": arr_dt,
            "dep": dep_dt
        })
        
    # Check if query time is within any schedule station bounds
    for i in range(len(schedule_times)):
        curr = schedule_times[i]
        
        # If train is halted at station
        if curr["arr"] and curr["dep"] and curr["arr"] <= query_dt <= curr["dep"]:
            return {
                "train_number": str(train_number),
                "train_name": train_info.get("name", "Unknown Train"),
                "timestamp": timestamp_query,
                "latitude": curr["lat"],
                "longitude": curr["lng"],
                "source": "scheduled_estimate",
                "interpolated": False,
                "confidence": 0.7
            }
            
        # If train is in transit between station i and i+1
        if i < len(schedule_times) - 1:
            nxt = schedule_times[i+1]
            if curr["dep"] and nxt["arr"] and curr["dep"] <= query_dt <= nxt["arr"]:
                duration = (nxt["arr"] - curr["dep"]).total_seconds()
                elapsed = (query_dt - curr["dep"]).total_seconds()
                
                prog_val = elapsed / duration if duration > 0 else 0.5
                prog_val = max(0.0, min(1.0, prog_val))
                
                lat = curr["lat"] + prog_val * (nxt["lat"] - curr["lat"])
                lon = curr["lng"] + prog_val * (nxt["lng"] - curr["lng"])
                
                return {
                    "train_number": str(train_number),
                    "train_name": train_info.get("name", "Unknown Train"),
                    "timestamp": timestamp_query,
                    "latitude": lat,
                    "longitude": lon,
                    "source": "scheduled_estimate",
                    "interpolated": True,
                    "confidence": 0.6
                }
                
    # If the query time is before the start or after the end of the scheduled run
    if schedule_times:
        first = schedule_times[0]
        last = schedule_times[-1]
        if first["dep"] and query_dt < first["dep"]:
            return {
                "train_number": str(train_number),
                "train_name": train_info.get("name", "Unknown Train"),
                "timestamp": timestamp_query,
                "latitude": first["lat"],
                "longitude": first["lng"],
                "source": "scheduled_estimate",
                "interpolated": False,
                "note": "Train has not started yet. Using source station coordinates.",
                "confidence": 0.5
            }
        elif last["arr"] and query_dt > last["arr"]:
            return {
                "train_number": str(train_number),
                "train_name": train_info.get("name", "Unknown Train"),
                "timestamp": timestamp_query,
                "latitude": last["lat"],
                "longitude": last["lng"],
                "source": "scheduled_estimate",
                "interpolated": False,
                "note": "Train already completed run. Using destination station coordinates.",
                "confidence": 0.5
            }
            
    return {"error": "Could not determine train position"}
