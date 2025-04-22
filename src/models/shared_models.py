from pydantic import BaseModel
from typing import List, Tuple, Dict, Optional, Any, Set
from datetime import datetime
from dataclasses import dataclass, field

# Traffic Constants
AVERAGE_SPEED_KPH = 30  # Average speed in Davao City

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
    collection_time_minutes: float = 15.0  # Default 15 minutes per stop

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
    speed_kph: float = AVERAGE_SPEED_KPH

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
    collection_time: int
    travel_time: int
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
    collection_time: int = 0  # Collection time in seconds
    travel_time: int = 0      # Travel time in seconds

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
    collection_time_minutes: float = 15.0  # Default 15 minutes per stop
    speed_kph: float = AVERAGE_SPEED_KPH # Average speed in Davao City

    def add_stop(self, location: Location, distance_from_prev: float) -> None:
        """Add a stop to the collection data"""
        # Calculate cumulative load
        current_load = sum(stop.amount_collected for stop in self.stops)
        
        # Use fixed collection time in seconds
        collection_time = int(self.collection_time_minutes * 60)  # Default to 15 minutes if no schedule specified
        travel_time = int((distance_from_prev / self.speed_kph) * 3600)
        
        # Create new stop
        new_stop = CollectionStop(
            location_id=location.id,
            location_name=location.name,
            coordinates=location.coordinates,
            amount_collected=location.wco_amount,
            cumulative_load=current_load + location.wco_amount,
            remaining_capacity=0.0,
            distance_from_prev=distance_from_prev,
            trip_number=self.trip_number,
            collection_day=self.day,
            collection_time=collection_time,
            travel_time=travel_time
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
    travel_time_minutes: float = 0.0  # Add travel time field

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
    total_collection_time: int = field(default=0)  # Total collection time in seconds
    total_travel_time: int = field(default=0)      # Total travel time in seconds
    trip_paths: Dict[int, List[RoutePathInfo]] = field(default_factory=dict)

@dataclass
class TripAnalysisResult:
    collection_day: int
    total_locations: int
    total_vehicles: int
    total_distance: float
    total_collected: float
    total_collection_time: int
    total_travel_time: int
    total_stops: int
    vehicle_routes: List[VehicleRouteInfo]

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
    trips: List[TripAnalysisResult]
    total_collection_time: int = 0  # Total collection time in seconds
    total_travel_time: int = 0      # Total travel time in seconds
    base_schedule_id: str = ""  # Add reference to original schedule
    base_schedule_day: int = 0  # Add reference to base frequency day

    @property
    def vehicle_routes(self) -> List[VehicleRouteInfo]:
        """Compatibility property that returns vehicle routes from the current trip."""
        if not self.trips:
            return []
        return [route for trip in self.trips for route in trip.vehicle_routes]

    def get_trip(self, trip_number: int) -> Optional[TripAnalysisResult]:
        """Get trip analysis result by trip number."""
        return next((trip for trip in self.trips if trip.collection_day == trip_number), None)

    def get_vehicle_routes(self, trip_number: int) -> List[VehicleRouteInfo]:
        """Get vehicle routes for a specific trip number."""
        trip = self.get_trip(trip_number)
        return trip.vehicle_routes if trip else []

    def __post_init__(self):
        if self.total_trips == 0:
            self.total_trips = sum(trip.total_trips for trip in self.trips)
        if self.total_stops == 0:
            self.total_stops = sum(trip.total_stops for trip in self.trips)
        if not self.base_schedule_id:
            self.base_schedule_id = self.schedule_id.split('_day')[0]
        # Sum up total times
        self.total_collection_time = sum(trip.total_collection_time for trip in self.trips)
        self.total_travel_time = sum(trip.total_travel_time for trip in self.trips)
