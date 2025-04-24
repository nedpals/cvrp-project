from models.shared_models import CollectionData, VehicleRoute, Location
from dataclasses import dataclass, field
from typing import Dict, Tuple, Set
from datetime import datetime
from utils import calculate_distance, MAX_DAILY_TIME, AVERAGE_SPEED_KPH, calculate_stop_times, calculate_total_time

@dataclass
class TripCollection:
    """Tracks collections for specific vehicles on specific days and trips"""
    vehicle_collections: Dict[Tuple[int, int, int], CollectionData] = field(default_factory=dict)
    total_times: Dict[int, float] = field(default_factory=dict)
    _exceeds_daily_time: Dict[int, bool] = field(default_factory=dict)
    total_trips: int = 0
    total_stops: int = 0
    speed_kph: float = AVERAGE_SPEED_KPH
    max_daily_time: int = MAX_DAILY_TIME

    def exceeds_daily_time(self, day: int) -> bool:
        """
        Check if the total time for a given day exceeds the maximum daily time
        """
        if day in self._exceeds_daily_time:
            return self._exceeds_daily_time[day]
        
        # If not calculated, assume it does not exceed
        return False
    
    def clear_total_time(self, day: int) -> None:
        """
        Clear the total time for a specific day
        """
        if day in self.total_times:
            self.total_times[day] = 0.0

        if day in self._exceeds_daily_time:
            self._exceeds_daily_time[day] = False
    
    def register_collection(self, 
                           vehicle_id: int,
                           day: int, 
                           trip_number: int,
                           location: Location,
                           depot_location: tuple[int, int] | None = None,
                           collection_time_minutes: float = 15.0) -> bool:
        """
        Register a collection for a specific vehicle on a specific day and trip
        Returns True if successfully registered, False otherwise
        """
        key = (vehicle_id, day, trip_number)
        time_key = day

        if self.exceeds_daily_time(day):
            print(f"Warning: Daily time limit exceeded for day {day}. Cannot register new collection.")
            return False
        
        # Track new trips
        if key not in self.vehicle_collections:
            self.total_trips += 1
        
        # Get or create collection data for this key
        if key not in self.vehicle_collections:
            self.vehicle_collections[key] = CollectionData(
                vehicle_id=vehicle_id,
                day=day,
                trip_number=trip_number,
                visited_location_ids=set(),
                total_collected=0.0,
                total_distance=0.0,
                stops=[],
                collection_timestamp=datetime.now(),
                collection_time_minutes=collection_time_minutes,
                speed_kph=self.speed_kph
            )

        if time_key not in self.total_times:
            self.total_times[time_key] = 0.0
        
        # Check if location already visited on this day
        if location.id in self.vehicle_collections[key].visited_location_ids:
            print(f"Warning: Location {location.name} already visited on day {day} by vehicle {vehicle_id}. Ignoring duplicate.")
            return False
        
        is_depot_location = location.coordinates[0] == depot_location[0] and location.coordinates[1] == depot_location[1] if depot_location else False
            
        # Calculate distance from previous stop or depot
        collection = self.vehicle_collections[key]
        if not collection.stops:
            if depot_location and not is_depot_location:
                distance = calculate_distance(depot_location, location.coordinates)
            else:
                distance = 0.0
        else:
            prev_stop = collection.stops[-1]
            distance = calculate_distance(prev_stop.coordinates, location.coordinates)

        prev_location = collection.stops[-1].coordinates if collection.stops else None
        collection_time, travel_time, depot_return_time = calculate_stop_times(
            location=location,
            depot_location=depot_location,
            prev_location=prev_location,
            collection_time_minutes=collection_time_minutes,
            speed_kph=self.speed_kph
        )

        prev_total_time = self.total_times.get(time_key, 0.0)
        total_time = prev_total_time + calculate_total_time(collection_time, travel_time, depot_return_time)

        if total_time > self.max_daily_time:
            print(f"Warning: Adding {location.name} exceeds daily time limit for day {day}")
            self._exceeds_daily_time[day] = False
            # return False
        else:
            print(f"[trip_collection] total_time: {total_time}, max_daily_time: {self.max_daily_time}")

        # Register collection with distance
        collection.add_stop(location, distance)
        self.total_stops += 1
        # self.total_times[time_key] = total_time
        print(f"Collecting {location.str()} (Total trips: {self.total_trips}, Total stops: {self.total_stops})")
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
            total_collected=sum(stop.amount_collected for stop in stops),
            speed_kph=self.speed_kph
        )
