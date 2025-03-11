from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Any
from datetime import datetime

@dataclass
class StopInfo:
    """Information about a single stop in a route"""
    name: str
    coordinates: Tuple[float, float]
    wco_amount: float
    trip_number: int
    cumulative_load: float
    remaining_capacity: float
    distance_from_depot: float
    distance_from_prev: float
    vehicle_capacity: float
    sequence_number: int

@dataclass
class VehicleRouteInfo:
    """Information about a vehicle's complete route"""
    vehicle_id: str
    capacity: float
    total_stops: int
    total_trips: int
    total_distance: float
    total_collected: float
    efficiency: float
    stops: List[StopInfo]
    road_paths: List[Dict[str, Any]] = field(default_factory=list)

@dataclass
class RouteAnalysisResult:
    """Complete analysis of all routes"""
    schedule_id: str
    schedule_name: str
    date_generated: datetime
    total_locations: int
    total_vehicles: int
    total_distance: float
    total_collected: float
    total_trips: int
    total_stops: int
    vehicle_routes: List[VehicleRouteInfo]

    def __post_init__(self):
        if self.total_trips == 0:
            self.total_trips = sum(route.total_trips for route in self.vehicle_routes)

        if self.total_stops == 0:
            self.total_stops = sum(route.total_stops for route in self.vehicle_routes)
