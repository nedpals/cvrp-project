from typing import List, Set, Tuple, Iterable, Dict
from models.location import Vehicle, RouteConstraints, VehicleRoute
from models.shared_models import ScheduleEntry, Location, AVERAGE_SPEED_KPH, TripAnalysisResult
from models.trip_collection import TripCollection, CollectionData
from models.location_registry import LocationRegistry
from models.route_data import RouteAnalysisResult, VehicleRouteInfo, StopInfo
from solvers.base_solver import BaseSolver
from solvers.or_tools_solver import ORToolsSolver
from scheduling.collection_scheduler import CollectionScheduler
from utils import calculate_distance
from datetime import datetime

from utils import MAX_DAILY_TIME, estimate_travel_time

class CVRP:
    def __init__(self, vehicles: List[Vehicle], solver_class: BaseSolver, constraints: RouteConstraints | None = None, allow_multiple_trips: bool = True, max_daily_time: int = MAX_DAILY_TIME):
        self.vehicles = vehicles
        self.solver_class = solver_class
        self.allow_multiple_trips = allow_multiple_trips
        self.constraints = constraints or RouteConstraints(one_way_roads=[])
        self.collection_scheduler = None  # Will be initialized during process
        self.max_daily_time = max_daily_time  # Max daily time in minutes

    def _initialize_location_registry(self, locations: LocationRegistry) -> LocationRegistry:
        """Initialize location registry with depot distances"""
        depot_location = self.vehicles[0].depot_location
        
        # Process location data
        for loc in locations:
            loc.distance_from_depot = calculate_distance(depot_location, loc.coordinates)
        
        return locations

    def optimize_routes(self, vehicle_assignments: List[List[LocationRegistry]], stop_time = 15, speed_kph = AVERAGE_SPEED_KPH) -> List[List[Location]]:
        """Optimize routes using solver after scheduler assignments"""
        if not self.solver_class:
            return vehicle_assignments
        
        total_locations = sum(len(locations) for locations in vehicle_assignments)

        minimum_optimization_threshold = 5
        if total_locations < minimum_optimization_threshold:
            print("Not enough locations to optimize. Returning original assignments.")
            return vehicle_assignments

        should_print = total_locations <= minimum_optimization_threshold
        if should_print:
            # Print all locations
            print("Locations to optimize:")
            for assignments in vehicle_assignments:
                for loc in assignments:
                    if loc is not None:
                        print(f"  - {loc.name} (ID: {loc.id})")

        # If instanceof solver is ORToolsSolver, then use it in parallel to all vehicles
        print(f'Using solver: {self.solver_class.name}')

        if self.solver_class.id == ORToolsSolver.id:
            print('uses or-tools solver')
            list_of_locations: List[Location] = []

            # Flatten the list of locations
            for locations in vehicle_assignments:
                list_of_locations.extend([loc for loc in locations if loc is not None])

            solver = self.solver_class(
                locations=list_of_locations,
                vehicles=self.vehicles,
                constraints=self.constraints,
                speed_kph=speed_kph,
                stop_time=stop_time,
                max_daily_time=self.max_daily_time
            )

            vehicle_routes = solver.solve()
            if total_locations < 6:
                # Print all locations
                print("Optimized locations:")
                for new_assignments in vehicle_routes:
                    for loc in new_assignments:
                        if loc is not None:
                            print(f"  - {loc.name} (ID: {loc.id})")

            return vehicle_routes

        # Process each vehicle's assignments independently to ensure single trip
        optimized_assignments = []
        
        # Otherwise, process each vehicle independently
        for v_idx, locations in enumerate(vehicle_assignments):
            if not locations:
                optimized_assignments.append([])
                continue

            # Create solver for just this vehicle's locations
            solver: BaseSolver = self.solver_class(
                vehicles=[self.vehicles[v_idx]],  # Just one vehicle
                locations=locations,
                constraints=self.constraints
            )

            vehicle_routes = solver.solve()
            optimized_assignments.append(vehicle_routes[0] if vehicle_routes else [])
        return optimized_assignments


    def process(self, schedule_entries: Iterable[ScheduleEntry], locations: LocationRegistry, speed_kph: float = AVERAGE_SPEED_KPH) -> Tuple[List[RouteAnalysisResult], TripCollection]:
        """Process schedules independently.
        
        Each schedule is processed separately and may span multiple days if needed based on:
        - Vehicle capacity constraints
        - Time budget constraints (8-hour workday)
        - Travel time between locations
        
        Args:
            schedule_entries: Collection schedules to process
            locations: Registry of all locations
            with_scheduling: Whether to use scheduler (kept for backwards compatibility)
            
        Returns:
            Tuple of (analysis_results, collection_tracker)
        """
        # Initialize location registry for new schedule group
        location_registry = self._initialize_location_registry(locations)
        collection_tracker = TripCollection(speed_kph=speed_kph, max_daily_time=self.max_daily_time)
        results: List[RouteAnalysisResult] = []

        # Initialize scheduler once for all schedules
        self.collection_scheduler = CollectionScheduler(
            locations=location_registry,
            schedules=schedule_entries,
            vehicles=self.vehicles,
            simulation_days=30,
            speed_kph=speed_kph,
            max_daily_time=self.max_daily_time,
        )

        # Process each schedule independently
        for schedule in schedule_entries:
            print(f"\nProcessing schedule: {schedule.name} (Frequency: {schedule.frequency} days)")
            
            # Get locations for this schedule
            schedule_locations = [
                loc for loc in location_registry.get_all()
                if loc.disposal_schedule == schedule.frequency
            ]
            
            if not schedule_locations:
                print(f"No locations found for schedule {schedule.name}")
                continue
                
            print(f"Found {len(schedule_locations)} locations for {schedule.name}")
            
            # Track processed locations for this schedule
            processed_location_ids = set()
            location_assignments = {}  # Track which day each location is assigned to
            
            day = schedule.frequency
            remaining_locations = schedule_locations.copy()
            trip_number = 0

            # Process each day's assignments                    
            print(f"\nProcessing day {day} for {schedule.name}")
            print(f"Assigned locations for day {day}: {len(schedule_locations)}")

            # Force reassignment if all locations are left
            minimum_force_threshold = 5

            while len(remaining_locations) > 0:
                if len(remaining_locations) <= minimum_force_threshold:
                    print("Force reassignment of all locations to vehicles:")
                    for location in remaining_locations:
                        print(f"  - {location.name} (ID: {location.id})")

                # Get vehicle assignments from scheduler
                initial_assignments = self.collection_scheduler.optimize_vehicle_assignments(
                    vehicles=self.vehicles,
                    day=day,
                    locations=remaining_locations,
                    force_assign=len(remaining_locations) <= minimum_force_threshold,
                    use_geo_cluster=True # Skip geo clustering for OR-Tools
                )

                total_initial_assignments_len = sum(len(locations) for locations in initial_assignments)
                if total_initial_assignments_len == 0 and len(remaining_locations) > 0:
                    break

                print(f"Initial vehicle assignments for day {day}:")
                for v_idx, assigned_locations in enumerate(initial_assignments):
                    print(f"  Vehicle {self.vehicles[v_idx].id}: {len(assigned_locations)} locations")

                # Then use solver to optimize the routes
                vehicle_assignments = self.optimize_routes(
                    vehicle_assignments=initial_assignments,
                    stop_time=schedule.collection_time_minutes,
                    speed_kph=speed_kph
                )

                if vehicle_assignments:
                    trip_number += 1

                unique_assignment_loc_ids = set(loc.id for locs in vehicle_assignments for loc in locs if loc is not None)
                unique_assignment_loc_len = len(unique_assignment_loc_ids)

                # Lazy patching: if the initial assignment = len(remaining_locations)
                # and vehicle assignments lacks 1 location, then add it to the last vehicle
                # (Add it the index with the nearest depot location)
                if total_initial_assignments_len != 0 and len(remaining_locations) == total_initial_assignments_len and total_initial_assignments_len - unique_assignment_loc_len == 1:
                    print(f"Lazy patching: Adding location to vehicle {self.vehicles[-1].id}")

                    # Find the missing location in initial assignments
                    last_location = None

                    for locs in initial_assignments:
                        for loc in locs:
                            if loc is not None and loc.id not in unique_assignment_loc_ids:
                                last_location = loc
                                break

                    if last_location is not None:
                        # Find the vehicle with the nearest depot location
                        nearest_vehicle_idx = min(
                            range(len(self.vehicles)),
                            key=lambda i: calculate_distance(
                                self.vehicles[i].depot_location,
                                last_location.coordinates
                            )
                        )

                        # Additional check: if the last location exceeds vehicle capacity
                        total_wco_before_add = sum(loc.wco_amount for locs in vehicle_assignments for loc in locs if loc is not None)
                        if total_wco_before_add + last_location.wco_amount > self.vehicles[nearest_vehicle_idx].capacity:
                            print(f"Warning: Adding location {last_location.str()} exceeds vehicle capacity. Skipping lazy patching.")
                            # Mark the last location as None
                            last_location = None

                    if last_location is not None:
                        print(f"Found missing location for lazy patching: {last_location.str()}")

                        # Find the index to insert with the nearest depot location
                        insert_index = min(
                            range(len(vehicle_assignments[nearest_vehicle_idx])),
                            key=lambda i: calculate_distance(
                                vehicle_assignments[nearest_vehicle_idx][i].coordinates if vehicle_assignments[nearest_vehicle_idx][i] is not None else self.vehicles[nearest_vehicle_idx].depot_location,
                                last_location.coordinates
                            )
                        )

                        vehicle_assignments[nearest_vehicle_idx].insert(insert_index, last_location)
                        print(f"Inserting {last_location.str()} at index {insert_index} for vehicle {self.vehicles[nearest_vehicle_idx].id}")

                        # Verify if the location is already assigned
                        if remaining_locations == 0:
                            print("All locations have been assigned.")
                    else:
                        print("Huh? No missing location found in initial assignments. Skipping lazy patching.")

                # Register collections
                for v_idx, assigned_locations in enumerate(vehicle_assignments):
                    if not assigned_locations:
                        continue
                        
                    vehicle = self.vehicles[v_idx]
                    current_load = 0.0

                    for location in assigned_locations:
                        if location is None:
                            # Presumed depot start or end
                            continue

                        # Register collection with tracker
                        success = collection_tracker.register_collection(
                            vehicle_id=vehicle.id,
                            day=day,
                            trip_number=trip_number,
                            location=location,
                            depot_location=vehicle.depot_location,
                            collection_time_minutes=schedule.collection_time_minutes
                        )

                        if not success and len(assigned_locations) > 1:
                            continue

                        # Check if the location is already processed
                        location_assignments[location.id] = day
                        # Update current load
                        current_load += location.wco_amount
                        # Track processed locations
                        processed_location_ids.add(location.id)

                remaining_locations = [loc for loc in remaining_locations if loc.id not in processed_location_ids]

                if remaining_locations and len(remaining_locations) <= 5:
                    print(f"Remaining locations for day {day}: {len(remaining_locations)}")
                    for loc in remaining_locations:
                        print(f"  - {loc.name} (ID: {loc.id})")

                if collection_tracker.exceeds_daily_time(day):
                    print(f"WARNING: Daily time exceeded for day {day}. Clearing the total time.")
                    collection_tracker.clear_total_time(day)

            # Detailed verification of locations
            missing_locations = []
            successful_locations = []
            
            for loc in schedule_locations:
                if loc.id in processed_location_ids:
                    assigned_day = location_assignments.get(loc.id, "unknown")
                    successful_locations.append((loc, assigned_day))
                else:
                    missing_locations.append(loc)

            # Print detailed report
            print(f"\nLocation Processing Report for {schedule.name}:")
            print(f"Total locations: {len(schedule_locations)}")
            print(f"Successfully processed: {len(successful_locations)}")
            print(f"Missing: {len(missing_locations)}")
            
            if successful_locations:
                print("\nProcessed Locations:")
                for loc, day in successful_locations:
                    print(f"- {loc.name}: Processed on day {day}, WCO: {loc.wco_amount}L")
            
            if missing_locations:
                print(f"\nWARNING: {len(missing_locations)} locations were not processed:")
                total_missed_wco = sum(loc.wco_amount for loc in missing_locations)
                print("\nMissing locations:")
                for loc in missing_locations:
                    print(f"- {loc.name}: {loc.wco_amount}L WCO, Distance from depot: {loc.distance_from_depot:.2f}km")
                print(f"\nTotal missed WCO: {total_missed_wco}L ({(total_missed_wco/sum(loc.wco_amount for loc in schedule_locations)*100):.1f}% of schedule total)")
                print("\nPossible reasons:")
                print("1. Vehicle capacity constraints")
                print(f"2. Time budget constraints ({self.max_daily_time/60:.1f}-hour workday)")
                print("3. Travel time constraints")

            # Generate analysis for all days of this schedule
            schedule_results = self.generate_analysis_data(
                schedule_id=schedule.id,
                schedule_name=schedule.name,
                collection_tracker=collection_tracker,
                locations=location_registry,
                base_day=schedule.frequency
            )
            results.extend(schedule_results)

        return results, collection_tracker

    def _check_location_coverage(self, collections: list[CollectionData], locations: LocationRegistry) -> Tuple[Set[str], Set[str]]:
        """
        Check if all locations are covered exactly once.
        Returns tuple of (missing_locations, duplicate_locations)
        """
        visited_locations = {
            location.id: {'count': 0, 'name': location.name, 'wco': location.wco_amount}
            for location in locations
        }  # location_id -> visit_count

        # Count visits for each location from the collection tracker
        for collection in collections:
            for location_id in collection.visited_location_ids:
                if location_id in visited_locations:
                    visited_locations[location_id]['count'] += 1
                else:
                    print(f"Warning: Visit to unknown location ID {location_id}")
        
        # Find missing and duplicate locations
        missing = set()
        duplicates = set()
        
        print("\nLocation coverage analysis:")
        for loc_id, data in visited_locations.items():
            if data['count'] == 0:
                missing.add(loc_id)
                print(f"Missing: {data['name']} (ID: {loc_id}, WCO: {data['wco']}L)")
            elif data['count'] > 1:
                duplicates.add(loc_id)
                print(f"Duplicate: {data['name']} (ID: {loc_id}, visited {data['count']} times)")
        
        return missing, duplicates
    
    def generate_analysis_data(self, schedule_id: str, schedule_name: str, 
                             collection_tracker: TripCollection,
                             locations: LocationRegistry,
                             base_day: int) -> List[RouteAnalysisResult]:
        """Generate analysis results for all days of a schedule."""
        results = []
        
        # Find all days used for this schedule
        schedule_days = sorted(set(
            day for _, day, _ in collection_tracker.vehicle_collections.keys()
            if day >= base_day  # Only include days from base day onwards
        ))
        
        # Generate analysis for each day
        for day in schedule_days:
            trip_results: List[TripAnalysisResult] = []
            day_total_distance = 0
            day_total_collected = 0
            day_total_collection_time = 0
            day_total_travel_time = 0
            day_total_locations = 0
            day_total_stops = 0
            day_total_trips = 0

            # Group vehicles by trip number
            trip_vehicles: Dict[int, List[VehicleRouteInfo]] = {}

            # Initialize trip_vehicles            
            for vehicle_idx, vehicle in enumerate(self.vehicles):
                print(f"\nProcessing vehicle {vehicle.id} for day {day}")
                route = collection_tracker.get_vehicle_route(vehicle.id, day)
                if not route.stops:
                    continue

                print(f"There are {len(route.stops)} stops for vehicle {vehicle.id} on day {day}")
                for stop in route.stops:
                    trip_num = stop.trip_number
                    if trip_num not in trip_vehicles:
                        trip_vehicles[trip_num] = []

                for trip_num in trip_vehicles.keys():
                    # Process vehicle route info as before
                    vehicle_route = self._process_vehicle_route(vehicle, route, day, trip_num, locations)
                    
                    if 0 <= vehicle_idx < len(trip_vehicles[trip_num]):
                        trip_vehicles[trip_num][vehicle_idx] = vehicle_routes
                    else:
                        trip_vehicles[trip_num].append(vehicle_route)

            # Create TripAnalysisResult for each trip
            for trip_num, vehicle_routes in trip_vehicles.items():
                trip_result = TripAnalysisResult(
                    collection_day=trip_num,
                    total_locations=sum(len(vr.stops) for vr in vehicle_routes),
                    total_vehicles=len(vehicle_routes),
                    total_distance=sum(vr.total_distance for vr in vehicle_routes),
                    total_collected=sum(vr.total_collected for vr in vehicle_routes),
                    total_collection_time=sum(vr.total_collection_time for vr in vehicle_routes),
                    total_travel_time=sum(vr.total_travel_time for vr in vehicle_routes),
                    total_stops=sum(vr.total_stops for vr in vehicle_routes),
                    vehicle_routes=vehicle_routes
                )
                trip_results.append(trip_result)

            day_total_distance = sum(trip.total_distance for trip in trip_results)
            day_total_collected = sum(trip.total_collected for trip in trip_results)
            day_total_collection_time = sum(trip.total_collection_time for trip in trip_results)
            day_total_travel_time = sum(trip.total_travel_time for trip in trip_results)
            day_total_locations = sum(trip.total_locations for trip in trip_results)
            day_total_stops = sum(trip.total_stops for trip in trip_results)
            day_total_trips = len(trip_results)

            # Create RouteAnalysisResult for the day
            day_result = RouteAnalysisResult(
                schedule_id=f"{schedule_id}_day{day}",
                schedule_name=f"{schedule_name} (Day {day})",
                date_generated=datetime.now(),
                total_locations=day_total_locations,
                total_vehicles=len(self.vehicles),
                total_distance=day_total_distance,
                total_collected=day_total_collected,
                total_collection_time=day_total_collection_time,
                total_travel_time=day_total_travel_time,
                total_trips=day_total_trips,
                total_stops=day_total_stops,
                collection_day=day,
                trips=trip_results,
                base_schedule_id=schedule_id,
                base_schedule_day=base_day
            )

            results.append(day_result)

        return results

    def _process_vehicle_route(self, vehicle: Vehicle, route: VehicleRoute, day: int, trip_number: int, locations: LocationRegistry) -> VehicleRouteInfo:
        """Helper method to process vehicle route info."""
        stops_data: list[StopInfo] = []
        should_add_depot_start = True

        # Process regular stops
        for i, stop in enumerate(route.stops):
            if stop.trip_number != trip_number:
                continue

            if should_add_depot_start:
                # Add depot start stop for each trip
                depot_start = StopInfo(
                    name="Depot",
                    location_id=f"depot_start_{vehicle.id}_trip_{stop.trip_number}",
                    coordinates=vehicle.depot_location,
                    wco_amount=0,
                    trip_number=stop.trip_number,
                    cumulative_load=0,
                    remaining_capacity=vehicle.capacity,
                    distance_from_depot=0,
                    distance_from_prev=0,
                    vehicle_capacity=vehicle.capacity,
                    sequence_number=i-1,
                    collection_day=day,
                    collection_time=0,
                    travel_time=0
                )
                stops_data.append(depot_start)
                should_add_depot_start = False

            location_data = locations.get_by_id(stop.location_id)
            remaining_capacity = vehicle.capacity - stop.cumulative_load
            
            stop_info = StopInfo(
                name=stop.location_name,
                location_id=stop.location_id,
                coordinates=stop.coordinates,
                wco_amount=stop.amount_collected,
                trip_number=stop.trip_number,
                cumulative_load=stop.cumulative_load,
                remaining_capacity=remaining_capacity,
                distance_from_depot=location_data.distance_from_depot,
                distance_from_prev=stop.distance_from_prev,
                vehicle_capacity=vehicle.capacity,
                sequence_number=i,
                collection_day=day,
                collection_time=stop.collection_time,
                travel_time=stop.travel_time
            )

            stops_data.append(stop_info)

            if (i + 1 < len(route.stops) and stop.trip_number != route.stops[i + 1].trip_number) or i == len(route.stops) - 1:
                depot_end_distance = calculate_distance(stop.coordinates, vehicle.depot_location)

                # Add depot end stop between trips
                depot_end = StopInfo(
                    name="Depot",
                    location_id=f"depot_end_{vehicle.id}_trip_{stop.trip_number}",
                    coordinates=vehicle.depot_location,
                    wco_amount=0,
                    trip_number=stop.trip_number,
                    cumulative_load=stop.cumulative_load,
                    remaining_capacity=remaining_capacity,
                    distance_from_depot=0,
                    distance_from_prev=depot_end_distance,
                    vehicle_capacity=vehicle.capacity,
                    sequence_number=i,
                    collection_day=day,
                    collection_time=0,
                    travel_time=int(estimate_travel_time(depot_end_distance, route.speed_kph) * 60)
                )

                stops_data.append(depot_end)
                should_add_depot_start = True

        vehicle_collected = sum(stop.wco_amount for stop in stops_data)
        vehicle_collection_time = sum(stop.collection_time for stop in stops_data)
        vehicle_travel_time = sum(stop.travel_time for stop in stops_data)
        total_stops = len(stops_data)
        total_distance = sum(stop.distance_from_prev for stop in stops_data)

        vehicle_route = VehicleRouteInfo(
            vehicle_id=vehicle.id,
            capacity=vehicle.capacity,
            total_stops=total_stops,
            total_trips=1,
            total_distance=total_distance,
            total_collected=vehicle_collected,
            efficiency=vehicle_collected / vehicle.capacity if vehicle.capacity > 0 else 0,
            stops=stops_data,
            collection_day=day,  # Add collection day
            road_paths=[],  # Road paths will be added later by the visualizer
            total_collection_time=vehicle_collection_time,
            total_travel_time=vehicle_travel_time,
        )

        return vehicle_route

    def print_daily_summaries(self, collection_tracker: TripCollection):
        """Print summaries of daily routes and vehicle utilization"""
        print("\nDaily Route Summaries:")
        days = sorted(set(day for _, day, _ in collection_tracker.vehicle_collections.keys()))
        
        for day in days:
            print(f"\nDay {day} Summary:")
            for vehicle in self.vehicles:
                # Get collections just for this day
                day_collections = [
                    collection for key, collection 
                    in collection_tracker.vehicle_collections.items()
                    if key[0] == vehicle.id and key[1] == day
                ]
                
                if day_collections:  # Only print if vehicle was used this day
                    # Group stops by trip number
                    trips_data = {}
                    for collection in day_collections:
                        if collection.trip_number not in trips_data:
                            trips_data[collection.trip_number] = []
                        trips_data[collection.trip_number].extend(collection.stops)
                    
                    total_stops = sum(len(c.stops) for c in day_collections)
                    total_trips = len(trips_data)
                    
                    # Calculate utilization per trip
                    trip_utilizations = []
                    for trip_num, stops in sorted(trips_data.items()):
                        trip_collected = sum(stop.amount_collected for stop in stops)
                        trip_utilization = trip_collected / vehicle.capacity
                        trip_utilizations.append(f"{trip_utilization:.1%}")
                    
                    print(f"\n  Vehicle {vehicle.id}:")
                    print(f"    Stops: {total_stops}")
                    print(f"    Trips: {total_trips}")
                    print(f"    Trip utilization: {' | '.join(trip_utilizations)}")
                    
                    # Alert if any trip exceeds capacity
                    for trip_num, stops in trips_data.items():
                        trip_collected = sum(stop.amount_collected for stop in stops)
                        if trip_collected > vehicle.capacity:
                            print(f"    WARNING: Trip {trip_num} exceeds vehicle capacity "
                                  f"({trip_collected:.1f}L > {vehicle.capacity:.1f}L)")
                            
                            # List stops in this overloaded trip
                            print("    Stops in overloaded trip:")
                            cumulative_load = 0
                            for stop in stops:
                                cumulative_load += stop.amount_collected
                                print(f"      - {stop.location_name}: {stop.amount_collected:.1f}L "
                                      f"(Cumulative: {cumulative_load:.1f}L)")