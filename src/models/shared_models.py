from pydantic import BaseModel, Field
from typing import List, Tuple, Dict, Optional, Any
from datetime import datetime
import uuid

class Location(BaseModel):
    name: str
    coordinates: Tuple[float, float]
    wco_amount: float
    disposal_schedule: int
    distance_from_depot: float = 0.0
    trip_number: int = 1
    id: str = Field(default_factory=lambda: f"loc_{uuid.uuid4().hex[:8]}")

    def str(self):
        return f"{self.name} (ID: {self.id}, WCO: {self.wco_amount}L)"

    class Config:
        underscore_attrs_are_private = True

class Vehicle(BaseModel):
    id: str
    capacity: float
    depot_location: Tuple[float, float]

    def get_remaining_capacity(self, current_load: float) -> float:
        return self.capacity - current_load
        
    def needs_depot_return(self, current_load: float, next_collection_amount: float) -> bool:
        return next_collection_amount > self.get_remaining_capacity(current_load)

class ScheduleEntry(BaseModel):
    id: str
    name: str
    frequency: int
    file: str
    description: Optional[str] = None
    color: Optional[str] = None

    def __hash__(self):
        return hash(self.id)

    def __eq__(self, other):
        if not isinstance(other, ScheduleEntry):
            return NotImplemented
        return self.id == other.id

    class Config:
        frozen = True  # Make the model immutable and hashable

class StopInfo(BaseModel):
    name: str
    coordinates: Tuple[float, float]
    wco_amount: float
    trip_number: int
    cumulative_load: float
    remaining_capacity: float
    sequence_number: int
    location_id: Optional[str] = None
    location_name: Optional[str] = None
    amount_collected: Optional[float] = None
    distance_from_depot: Optional[float] = None
    vehicle_capacity: Optional[float] = None
    distance_from_prev: Optional[float] = None  # Distance from previous stop
    total_distance: Optional[float] = None      # Cumulative distance from start

class StopResponse(BaseModel):
    name: str
    coordinates: Tuple[float, float]
    wco_amount: float
    trip_number: int
    cumulative_load: float
    remaining_capacity: float
    distance_from_depot: float
    vehicle_capacity: float
    sequence_number: int

class VehicleRouteInfo(BaseModel):
    vehicle_id: str
    capacity: float
    total_stops: int
    total_trips: int
    total_distance: float
    total_collected: float
    efficiency: float
    stops: List[StopInfo]

class VehicleRouteResponse(BaseModel):
    vehicle_id: str
    capacity: float
    total_stops: int
    total_trips: int
    total_distance: float
    total_collected: float
    efficiency: float
    stops: List[StopResponse]
    road_paths: List[Dict[str, Any]] = []

class RouteResponse(BaseModel):
    schedule_id: str
    schedule_name: str
    date_generated: datetime
    total_locations: int
    total_vehicles: int
    total_distance: float
    total_collected: float
    vehicle_routes: List[VehicleRouteResponse]

class RouteConstraints(BaseModel):
    one_way_roads: List[Tuple[Tuple[float, float], Tuple[float, float]]] = []
