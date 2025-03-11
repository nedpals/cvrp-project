from typing import List, Set, Tuple, Iterable
from models.location import Location, Vehicle, RouteConstraints
from models.shared_models import ScheduleEntry
from models.trip_collection import TripCollection, CollectionData
from models.location_registry import LocationRegistry
from models.route_data import RouteAnalysisResult, VehicleRouteInfo, StopInfo
from solvers.base_solver import BaseSolver
from scheduling.collection_scheduler import CollectionScheduler
from utils import calculate_distance
from datetime import datetime

class CVRP:
    def __init__(self, vehicles: List[Vehicle], solver_class: BaseSolver, constraints: RouteConstraints | None = None, allow_multiple_trips: bool = True):
        self.vehicles = vehicles
        self.solver_class = solver_class
        self.allow_multiple_trips = allow_multiple_trips
        self.constraints = constraints or RouteConstraints(one_way_roads=[])

    def _initialize_location_registry(self, locations: LocationRegistry) -> LocationRegistry:
        """Initialize location registry with depot distances"""
        depot_location = self.vehicles[0].depot_location
        
        # Process location data
        for loc in locations:
            loc.distance_from_depot = calculate_distance(depot_location, loc.coordinates)
        
        return locations
        
    def _generate_schedule_combinations(self, schedule_entries: List[ScheduleEntry]) -> List[List[ScheduleEntry]]:
        """Generate schedule combinations based on frequency overlaps"""
        # Sort schedules by frequency to ensure consistent ordering
        sorted_entries = sorted(schedule_entries, key=lambda x: x.frequency)
        
        # Group schedules by frequency
        frequency_groups = {}
        for entry in sorted_entries:
            if entry.frequency not in frequency_groups:
                frequency_groups[entry.frequency] = []
            frequency_groups[entry.frequency].append(entry)
            
        combinations_list = []
        frequencies = sorted(frequency_groups.keys())
        
        # Add individual frequency groups
        for freq in frequencies:
            combinations_list.append(frequency_groups[freq])
        
        # Find overlapping schedules
        # For example: if weekly=7 and bi-weekly=14, they overlap
        overlapping_groups = []
        for i, freq1 in enumerate(frequencies):
            overlapping = []
            for freq2 in frequencies[i+1:]:
                # Check if frequencies share common multiples within a reasonable range
                # Using least common multiple (LCM) would be more precise but this is simpler
                if freq2 % freq1 == 0 or freq1 % freq2 == 0:
                    overlapping.extend(frequency_groups[freq2])
            
            if overlapping:
                combined_group = frequency_groups[freq1].copy()
                combined_group.extend(overlapping)
                overlapping_groups.append(combined_group)
        
        combinations_list.extend(overlapping_groups)
        
        # Log the combinations being processed
        for combo in combinations_list:
            combo_desc = " + ".join(f"{s.name}({s.frequency}d)" for s in combo)
            print(f"Generated combination: {combo_desc}")
            
        return combinations_list
        
    def process_all_combinations(self, schedule_entries: List[ScheduleEntry], 
                               locations: LocationRegistry, 
                               with_scheduling: bool = True) -> List[Tuple[List[RouteAnalysisResult], TripCollection]]:
        """Process each schedule combination separately"""
        schedule_combinations = self._generate_schedule_combinations(schedule_entries)
        all_results = []
        
        for schedule_group in schedule_combinations:
            # Create descriptive name for this combination
            group_name = " + ".join(f"{s.name}" for s in schedule_group)
            print(f"\n{'='*80}\nProcessing schedule combination: {group_name}\n{'='*80}")
            
            # Process this combination
            results, collection_tracker = self.process(
                schedule_entries=schedule_group,
                locations=locations,
                with_scheduling=with_scheduling
            )
            
            all_results.append((results, collection_tracker))
            
        return all_results

    def process(self, schedule_entries: Iterable[ScheduleEntry], locations: LocationRegistry, with_scheduling: bool = True) -> Tuple[List[RouteAnalysisResult], TripCollection]:
        """Process one or more schedules together, handling both single and combined cases."""
        # Reset location registry for new schedule group
        location_registry = self._initialize_location_registry(locations)
        is_combined = len(schedule_entries) > 1
        schedule_names = ', '.join(s.name for s in schedule_entries)
        print(f"\nProcessing {'combined' if is_combined else 'single'} schedule: {schedule_names}")
        print(f"Total locations: {len(location_registry)}")

        # Initialize scheduler
        scheduler = CollectionScheduler(
            location_registry, 
            schedule_entries,
            simulation_days=30
        )

        # Create a collection tracker to store all collections
        collection_tracker = TripCollection()
        
        if with_scheduling:
            print("Using schedule-based optimization")
            
            # Process each day
            for day in scheduler.frequency_map:
                # Initialize routes tracking per vehicle
                vehicle_routes = {vehicle.id: [] for vehicle in self.vehicles}

                print(f"\nProcessing Day {day}")
                
                # Get daily locations based on whether it's combined or single
                daily_locations = scheduler.combine_daily_collections(schedule_entries, day)
                if not daily_locations:
                    print("No collections scheduled for today")
                    continue

                # Handle multiple trips if enabled
                remaining_locations = daily_locations.copy()
                trip_number = 1
                
                while remaining_locations and (self.allow_multiple_trips or trip_number == 1):
                    print(f"\nProcessing Trip #{trip_number}")
                    print(f"Remaining locations: {len(remaining_locations)}")
                    
                    # Get assignments for this trip with collection tracker
                    vehicle_assignments = scheduler.optimize_vehicle_assignments(
                        self.vehicles, day, remaining_locations, collection_tracker
                    )
                    
                    # Track which locations were successfully assigned
                    unassigned_locations: list[Location] = []
                    
                    # Check which locations were assigned and which weren't
                    for loc in remaining_locations:
                        was_assigned = False
                        for assigned_locs in vehicle_assignments:
                            if loc in assigned_locs:
                                was_assigned = True
                                break
                        if not was_assigned:
                            unassigned_locations.append(loc)
                    
                    # Update remaining locations only if multiple trips are allowed
                    if self.allow_multiple_trips:
                        remaining_locations = unassigned_locations
                    else:
                        remaining_locations = []

                    # Process routes for this trip
                    for vehicle_idx, assigned_locations in enumerate(vehicle_assignments):
                        if not assigned_locations:
                            continue

                        # Print assigned locations
                        vehicle = self.vehicles[vehicle_idx]

                        print(f"\n[0 | Day {day}] Vehicle {vehicle.id} assigned locations for Trip {trip_number}:")
                        for loc in assigned_locations:
                            print(f"- [1] {loc.str()}")
                            
                        solver = self.solver_class(assigned_locations, [vehicle], self.constraints)
                        new_routes = solver.solve()
                        
                        # Add routes with trip number
                        for route in new_routes:
                            if isinstance(route, list) and route:
                                route_with_trip = {
                                    'coordinates': route,
                                    'trip_number': trip_number
                                }
                                vehicle_routes[vehicle.id].append(route_with_trip)
                    
                    if remaining_locations:
                        print(f"Still unassigned after trip #{trip_number}:")
                        for loc in remaining_locations:
                            print(f"- {loc.str()}")
                    else:
                        print(f"Day {day} completed with {trip_number} trips")
                    
                    trip_number += 1

                # Process routes for all trips
                for vehicle_idx, vehicle in enumerate(self.vehicles):
                    for route_data in vehicle_routes[vehicle.id]:
                        route = route_data['coordinates']
                        trip_num = route_data['trip_number']
                        
                        if not isinstance(route, list) or not route:
                            continue
                            
                        print(f"\nProcessing route for Vehicle {vehicle.id}, Trip {trip_num}, Day {day}")
                        current_load = 0.0  # Track load for this trip
                        
                        for location in route:  # Skip depot
                            if location is None:  # Skip depot markers
                                continue
                            
                            # Register collection with the tracker instead of vehicle
                            success = collection_tracker.register_collection(
                                vehicle_id=vehicle.id,
                                day=day, 
                                trip_number=trip_num,
                                location=location
                            )
                            
                            if success:
                                current_load += location.wco_amount
                                print(f"Collected {location.wco_amount}L from {location.name}, Remaining capacity: {vehicle.capacity - current_load:.2f}L")
                            else:
                                print(f"Warning: Collection failed at {location.name}")

        else:
            # Non-scheduled processing
            print("Warning: Running without schedule optimization")
            solver: BaseSolver = self.solver_class(location_registry.get_all(), self.vehicles, self.constraints)
            all_route_locs = solver.solve()
            
            # Process routes
            for vehicle_idx, route in enumerate(all_route_locs):
                vehicle = self.vehicles[vehicle_idx]
                vehicle.remaining_capacity = vehicle.capacity
                
                for location in route:
                    if location is None:  # Skip depot markers
                        continue

                    # Register collection with the tracker instead of vehicle
                    success = collection_tracker.register_collection(
                        vehicle_id=vehicle.id,
                        day=day, 
                        trip_number=trip_num,
                        location=location,
                        depot_location=vehicle.depot_location
                    )
                    
                    if success:
                        current_load += location.wco_amount
                        print(f"Collected {location.wco_amount}L from {location.name}, Remaining capacity: {vehicle.capacity - current_load:.2f}L")
                    else:
                        print(f"Warning: Collection failed at {location.name}")

        # Check and repair coverage
        sorted_schedule_entries = sorted(schedule_entries, key=lambda s: s.frequency)
        results: list[RouteAnalysisResult] = []

        for schedule_entry in sorted_schedule_entries:
            print(f"\nChecking coverage for {schedule_entry.name}")

            found_collections = [
                collection 
                for collection in collection_tracker.vehicle_collections.values()
                if collection.day == schedule_entry.frequency
            ]

            daily_locations = LocationRegistry(scheduler.combine_daily_collections(sorted_schedule_entries, schedule_entry.frequency))

            # Recheck final coverage
            missing, duplicates = self._check_location_coverage(found_collections, daily_locations)
            if missing or duplicates:
                if missing:
                    print("\nRemaining missing locations:")
                    for loc_id in missing:
                        location = location_registry.get_by_id(loc_id)
                        if location:
                            print(f"- {location.str()}")
                if duplicates:
                    print("\nRemaining duplicate visits:")
                    for loc_id in duplicates:
                        location = location_registry.get_by_id(loc_id)
                        if location:
                            print(f"- {location.str()}")
            else:
                print("\nFinal coverage check passed: All locations visited exactly once")

            # Generate visualizations and analysis
            results.append(self.generate_analysis_data(
                schedule_id=schedule_entry.id,
                schedule_name=schedule_entry.name,
                collection_tracker=collection_tracker,
                locations=location_registry,
                day=schedule_entry.frequency
            ))

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
                             day: int) -> RouteAnalysisResult:
        """Generate structured analysis data for the routes using collection tracker"""
        vehicle_routes = []
        total_distance = 0
        total_collected = 0
        total_locations = 0
        
        for vehicle in self.vehicles:
            # Get route data from collection tracker for this vehicle and day
            route = collection_tracker.get_vehicle_route(vehicle.id, day)
            if not route.stops:
                continue
                
            stops_data = []
            vehicle_collected = 0

            total_locations += len(route.stops)
            
            for i, stop in enumerate(route.stops):
                location_data = locations.get_by_id(stop.location_id)
                stop_info = StopInfo(
                    name=stop.location_name,
                    coordinates=stop.coordinates,
                    wco_amount=stop.amount_collected,
                    trip_number=stop.trip_number,
                    cumulative_load=stop.cumulative_load,
                    remaining_capacity=stop.remaining_capacity,
                    distance_from_depot=location_data.distance_from_depot,
                    distance_from_prev=stop.distance_from_prev,
                    vehicle_capacity=vehicle.capacity,
                    sequence_number=i
                )
                stops_data.append(stop_info)
                vehicle_collected += stop.amount_collected
            
            vehicle_route = VehicleRouteInfo(
                vehicle_id=vehicle.id,
                capacity=vehicle.capacity,
                total_stops=len(route.stops),
                total_trips=max(stop.trip_number for stop in route.stops) if route.stops else 1,
                total_distance=route.total_distance,
                total_collected=vehicle_collected,
                efficiency=vehicle_collected / vehicle.capacity if vehicle.capacity > 0 else 0,
                stops=stops_data,
                road_paths=[]  # Road paths will be added later by the visualizer
            )

            vehicle_routes.append(vehicle_route)
            total_distance += route.total_distance
            total_collected += vehicle_collected
        
        # Calculate totals across all vehicles
        total_trips = sum(route.total_trips for route in vehicle_routes)
        total_stops = sum(route.total_stops for route in vehicle_routes)
        
        return RouteAnalysisResult(
            schedule_id=schedule_id,
            schedule_name=schedule_name,
            date_generated=datetime.now(),
            total_locations=total_locations - 1,  # Subtract depot
            total_vehicles=len(self.vehicles),
            total_distance=total_distance,
            total_collected=total_collected,
            total_trips=total_trips,
            total_stops=total_stops,
            vehicle_routes=vehicle_routes,
        )

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