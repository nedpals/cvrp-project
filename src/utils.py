from math import radians, sin, cos, sqrt, atan2
from typing import Tuple

def calculate_distance(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    """Calculate distance between coordinates using Haversine formula"""
    lat1, lon1 = map(radians, coord1)
    lat2, lon2 = map(radians, coord2)
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return 6371 * c  # Earth's radius in km

def estimate_collection_time(location, max_stop_time: float = 15.0) -> float:
    """Estimate collection time based on WCO amount, capped at max_stop_time"""
    base_time = 3 + (location.wco_amount / 100) * 4  # Base 3 mins + up to 4 more based on volume
    return min(max_stop_time, base_time)