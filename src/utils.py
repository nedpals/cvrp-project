from math import radians, sin, cos, sqrt, atan2
from typing import Tuple

AVERAGE_SPEED_KPH = 30  # Average speed in Davao City
MAX_DAILY_TIME = 7 * 60  # Total working day in minutes (from CollectionScheduler)

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
    # base_time = 3 + (location.wco_amount / 100) * 4  # Base 3 mins + up to 4 more based on volume
    # return min(max_stop_time, base_time)
    return max_stop_time

def estimate_travel_time(distance: float, speed_kph: float) -> float:
    """Estimate travel time based on distance and speed in minutes"""
    return (distance / speed_kph) * 60  # Convert to minutes

def calculate_stop_times(location, 
                        depot_location: Tuple[float, float] | None = None,
                        prev_location: Tuple[float, float] | None = None,
                        collection_time_minutes: float = 15.0,
                        speed_kph: float = AVERAGE_SPEED_KPH,
                        distance_from_prev: float | None = None) -> Tuple[float, float, float]:
    """
    Calculate collection and travel times for a stop
    Args:
        location: Location to calculate times for
        depot_location: Coordinates of depot
        prev_location: Coordinates of previous stop
        collection_time_minutes: Time to spend at stop
        speed_kph: Travel speed
        distance_from_prev: Optional pre-calculated distance from previous location
    Returns: (collection_time, travel_time, depot_return_time) in minutes
    """
    # Collection time at stop
    collection_time = estimate_collection_time(location, collection_time_minutes)
    
    # Travel time from previous location or depot
    travel_time = 0.0
    if distance_from_prev is not None:
        travel_time = estimate_travel_time(distance_from_prev, speed_kph)
    elif prev_location:
        distance = calculate_distance(prev_location, location.coordinates)
        travel_time = estimate_travel_time(distance, speed_kph)
    elif depot_location:
        distance = calculate_distance(depot_location, location.coordinates)
        travel_time = estimate_travel_time(distance, speed_kph)
        
    # Time to return to depot
    depot_return_time = 0.0
    if depot_location:
        depot_distance = calculate_distance(location.coordinates, depot_location)
        depot_return_time = estimate_travel_time(depot_distance, speed_kph)
        
    return collection_time, travel_time, depot_return_time

def calculate_total_time(collection_time: float, 
                        travel_time: float,
                        depot_return_time: float) -> float:
    """Calculate total time for a stop including collection, travel and depot return"""
    return collection_time + travel_time + depot_return_time