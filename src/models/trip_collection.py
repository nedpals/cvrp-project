from dataclasses import dataclass, field
from typing import Dict, List, Set, Tuple
from models.location import Location, Stop, VehicleRoute
from utils import calculate_distance

@dataclass
class TripCollection:
    """
    Tracks collections for specific vehicles on specific days and trips.
    This class maintains collection data separately from the Vehicle class.
    """
    # Key structure: (vehicle_id, day, trip_number) -> collection data
    vehicle_collections: Dict[Tuple[int, int, int], "CollectionData"] = field(default_factory=dict)
    total_trips: int = 0
    total_stops: int = 0
    
    def register_collection(self, 
                           vehicle_id: int,
                           day: int, 
                           trip_number: int,
                           location: Location,
                           depot_location: tuple[int, int] | None = None) -> bool:
        """
        Register a collection for a specific vehicle on a specific day and trip
        Returns True if successfully registered, False otherwise
        """
        key = (vehicle_id, day, trip_number)
        
        # Track new trips
        if key not in self.vehicle_collections:
            self.total_trips += 1
        
        # Get or create collection data for this key
        if key not in self.vehicle_collections:
            self.vehicle_collections[key] = CollectionData(
                vehicle_id=vehicle_id,
                day=day,
                trip_number=trip_number
            )
        
        # Check if location already visited on this day
        if location.id in self.vehicle_collections[key].visited_location_ids:
            print(f"Warning: Location {location.name} already visited on day {day} by vehicle {vehicle_id}. Ignoring duplicate.")
            return False
            
        # Calculate distance from previous stop or depot
        collection = self.vehicle_collections[key]
        if not collection.stops:
            if depot_location:
                distance = calculate_distance(depot_location, location.coordinates)
            else:
                distance = 0.0
        else:
            prev_stop = collection.stops[-1]
            distance = calculate_distance(prev_stop.coordinates, location.coordinates)
            
        # Register collection with distance
        collection.add_stop(location, distance)
        self.total_stops += 1
        print(f"Total trips: {self.total_trips}, Total stops: {self.total_stops}")
        return True
        
    def get_visited_locations(self, vehicle_id: int, day: int) -> Set[str]:
        """Get set of location IDs visited by a vehicle on a specific day"""
        visited = set()
        for key, collection in self.vehicle_collections.items():
            if key[0] == vehicle_id and key[1] == day:
                visited.update(collection.visited_location_ids)
        return visited
        
    def get_vehicle_route(self, vehicle_id: int, day: int) -> VehicleRoute:
        """Generate vehicle route for a specific day"""
        stops = []
        total_distance = 0.0
        
        # Collect all stops for this vehicle on this day
        for collection in self.vehicle_collections.values():
            if collection.vehicle_id != vehicle_id or collection.day != day:
                continue

            stops.extend(collection.stops)
            total_distance += collection.total_distance
        
        # Create route
        return VehicleRoute(
            vehicle_id=vehicle_id,
            stops=stops,
            total_distance=total_distance,
            initial_capacity=0.0,  # Will be set elsewhere
            total_collected=sum(stop.amount_collected for stop in stops)
        )

@dataclass
class CollectionData:
    """Data for a single vehicle's collections on a specific day and trip"""
    vehicle_id: int
    day: int
    trip_number: int
    stops: List[Stop] = field(default_factory=list)
    visited_location_ids: Set[str] = field(default_factory=set)
    total_collected: float = 0.0
    total_distance: float = 0.0
    
    def add_stop(self, location: Location, distance_from_previous: float) -> None:
        """Add a stop for this collection"""
        # Create stop
        stop = Stop(
            location_id=location.id,
            location_name=location.name,
            coordinates=location.coordinates,
            amount_collected=location.wco_amount,
            remaining_capacity=0.0,  # Will be calculated elsewhere
            cumulative_load=self.total_collected + location.wco_amount,
            trip_number=self.trip_number,
            distance_from_prev=distance_from_previous
        )
        
        # Add to stops list and update totals
        self.stops.append(stop)
        self.visited_location_ids.add(location.id)
        self.total_collected += location.wco_amount
        self.total_distance += distance_from_previous
