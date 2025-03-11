from models.shared_models import (
    Location as SharedLocation,
    Vehicle as SharedVehicle,
    RouteConstraints as SharedRouteConstraints,
    StopInfo
)
from typing import List, Tuple
from dataclasses import dataclass

# For compatibility with existing code, create wrapper classes
class Location(SharedLocation):
    pass

class Vehicle(SharedVehicle):
    pass

class RouteConstraints(SharedRouteConstraints):
    pass

@dataclass
class VehicleRoute:
    vehicle_id: int
    stops: List[StopInfo]
    total_distance: float = 0.0
    initial_capacity: float = 0.0
    total_collected: float = 0.0

@dataclass
class Stop:
    location_id: str
    location_name: str
    amount_collected: float
    remaining_capacity: float
    coordinates: Tuple[float, float]
    cumulative_load: float
    trip_number: int = 1  # Add trip_number with default value of 1
    distance_from_prev: float = 0.0
    total_distance: float = 0.0

    def __hash__(self):
        """Make Stop hashable based on its coordinates"""
        return hash(self.location_id)
