from pydantic import BaseModel
from typing import List, Tuple, Dict, Optional, Any, Set
from datetime import datetime
from dataclasses import dataclass, field

# Add RouteConstraints class
class RouteConstraints(BaseModel):
    one_way_roads: List[Tuple[Tuple[float, float], Tuple[float, float]]] = []

# Core Models
class Location(BaseModel):
    id: str
    name: str
    coordinates: Tuple[float, float]
    wco_amount: float
    disposal_schedule: int
    distance_from_depot: float = 0.0

    def __hash__(self):
        return hash(self.id)

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

# Route and Stop Models
@dataclass
class Stop:
    location_id: str
    location_name: str
    amount_collected: float
    remaining_capacity: float
    coordinates: Tuple[float, float]
    cumulative_load: float
    trip_number: int = 1
    collection_day: int = 1
    distance_from_prev: float = 0.0
    total_distance: float = 0.0

    def __hash__(self):
        return hash(self.location_id)

@dataclass
class VehicleRoute:
    vehicle_id: int
    stops: List[Stop]
    total_distance: float = 0.0
    initial_capacity: float = 0.0
    total_collected: float = 0.0
    collection_day: int = 1

@dataclass
class StopInfo:
    """Information about a single stop in a route"""
    name: str
    location_id: str
    coordinates: Tuple[float, float]
    wco_amount: float
    trip_number: int
    cumulative_load: float
    remaining_capacity: float
    distance_from_depot: float
    distance_from_prev: float
    vehicle_capacity: float
    sequence_number: int
    collection_day: int

# Collection Models
@dataclass
class CollectionStop:
    location_id: str
    location_name: str
    coordinates: Tuple[float, float]
    amount_collected: float
    cumulative_load: float
    remaining_capacity: float
    distance_from_prev: float
    trip_number: int
    collection_day: int

@dataclass
class CollectionData:
    vehicle_id: str
    day: int
    trip_number: int
    visited_location_ids: Set[str]
    total_collected: float
    total_distance: float
    stops: List[CollectionStop]
    collection_timestamp: datetime

    def add_stop(self, location: Location, distance_from_prev: float) -> None:
        """Add a stop to the collection data"""
        # Calculate cumulative load
        current_load = sum(stop.amount_collected for stop in self.stops)
        
        # Create new stop
        new_stop = CollectionStop(
            location_id=location.id,
            location_name=location.name,
            coordinates=location.coordinates,
            amount_collected=location.wco_amount,
            cumulative_load=current_load + location.wco_amount,
            remaining_capacity=0.0,  # Will be set by vehicle if needed
            distance_from_prev=distance_from_prev,
            trip_number=self.trip_number,
            collection_day=self.day
        )
        
        # Update collection data
        self.stops.append(new_stop)
        self.visited_location_ids.add(location.id)
        self.total_collected += location.wco_amount
        self.total_distance += distance_from_prev

# Analysis Models
@dataclass
class RoutePathInfo:
    from_coords: Tuple[float, float]
    to_coords: Tuple[float, float]
    path: List[List[float]]
    trip_number: int = 0

@dataclass
class VehicleRouteInfo:
    vehicle_id: str
    capacity: float
    total_stops: int
    total_trips: int
    total_distance: float
    total_collected: float
    efficiency: float
    collection_day: int
    stops: List[StopInfo]
    road_paths: List[Dict[str, Any]] = field(default_factory=list)
    combined_path: List[RoutePathInfo] = field(default_factory=list)
    trip_paths: Dict[int, List[RoutePathInfo]] = field(default_factory=dict)

@dataclass
class RouteAnalysisResult:
    schedule_id: str
    schedule_name: str
    date_generated: datetime
    total_locations: int
    total_vehicles: int
    total_distance: float
    total_collected: float
    total_trips: int
    total_stops: int
    collection_day: int
    vehicle_routes: List[VehicleRouteInfo]

    def __post_init__(self):
        if self.total_trips == 0:
            self.total_trips = sum(route.total_trips for route in self.vehicle_routes)
        if self.total_stops == 0:
            self.total_stops = sum(route.total_stops for route in self.vehicle_routes)
