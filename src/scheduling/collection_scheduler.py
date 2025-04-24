import numpy as np
from typing import List, Dict, Tuple, Iterable
from models.location import Location, Vehicle
from models.shared_models import ScheduleEntry
from models.location_registry import LocationRegistry
from utils import calculate_distance, estimate_collection_time, AVERAGE_SPEED_KPH, MAX_DAILY_TIME, calculate_stop_times, calculate_total_time
from clustering.geographic_clusterer import GeographicClusterer, GeographicCluster

class CollectionScheduler:
    """Manages collection schedules based on WCO generation rates and disposal schedules"""

    def __init__(self, locations: LocationRegistry, schedules: Iterable[ScheduleEntry], 
                 vehicles: List[Vehicle], simulation_days: int = 30, speed_kph: float = AVERAGE_SPEED_KPH, max_daily_time: int = MAX_DAILY_TIME):
        self.locations = locations
        self.vehicles = vehicles
        self.frequency_map = self._build_frequency_map(schedules)
        self.schedule_map = self._build_schedule_map(schedules)  # Store full schedule objects
        self.min_load_ratio = 0.5
        self.speed_kph = speed_kph
        self.max_daily_time = max_daily_time
        
        # Calculate max simulation days needed based on schedules
        max_freq = max(self.frequency_map.values())
        self.simulation_days = min(simulation_days, max_freq)
        print(f"Optimizing collection for {self.simulation_days} days based on maximum frequency")
        
        self.daily_visited_locations = {}
    
    def _build_frequency_map(self, schedules: Iterable[ScheduleEntry]) -> dict[int, int]:
        """Build mapping of schedule_type to frequency"""
        return {
            schedule.frequency: schedule.frequency
            for schedule in schedules
        }
    
    def _build_schedule_map(self, schedules: Iterable[ScheduleEntry]) -> Dict[int, ScheduleEntry]:
        """Build mapping of frequency to schedule entry"""
        return {schedule.frequency: schedule for schedule in schedules}

    def is_collection_day(self, location: Location, day: int) -> bool:
        """Check if today is a collection day for this location"""
        return day % location.disposal_schedule == 0

    def get_daily_collections(self, day: int) -> List[Location]:
        """Get locations that need collection on this day, excluding already visited locations"""
        if day not in self.daily_visited_locations:
            self.daily_visited_locations[day] = set()
            
        available_locations = [loc for loc in self.schedule_map.get(day, [])
                             if loc.id not in self.daily_visited_locations[day]]
        return available_locations
    
    def estimate_wco_amount(self, location: Location, days_since_collection: int) -> float:
        """Estimate WCO amount based on days since last collection"""
        freq = self.frequency_map.get(location.disposal_schedule, 7)
        daily_rate = location.wco_amount / freq
        return daily_rate * days_since_collection

    def _validate_assignments(self, assignments: List[List[Location]], vehicles: List[Vehicle], 
                            all_locations: List[Location]) -> Tuple[bool, List[str]]:
        """
        Validate assignments to ensure all locations are covered appropriately.
        Returns (is_valid, list_of_issues)
        """
        issues = []
        location_visits = {}  # location_id -> visit_count
        location_loads = {}   # location_id -> total_wco
        assigned_ids = set()  # Track all assigned location IDs

        # First pass - collect all assigned location IDs
        for vehicle_locs in assignments:
            for loc in vehicle_locs:
                assigned_ids.add(loc.id)
                location_visits[loc.id] = 0
                location_loads[loc.id] = loc.wco_amount

        # Make sure all required locations are in tracking
        for loc in all_locations:
            if loc.id not in location_visits:
                location_visits[loc.id] = 0
                location_loads[loc.id] = loc.wco_amount

        # Count visits and validate capacities
        for v_idx, assigned_locs in enumerate(assignments):
            vehicle = vehicles[v_idx]
            current_load = 0
            
            for loc in assigned_locs:
                if loc.id in location_visits:
                    location_visits[loc.id] += 1
                    current_load += loc.wco_amount
                    
                    # Check if split collection is needed
                    if current_load > vehicle.capacity:
                        visits_needed = int(np.ceil(loc.wco_amount / vehicle.capacity))
                        if location_visits[loc.id] < visits_needed:
                            issues.append(
                                f"Location {loc.id} needs {visits_needed} visits due to WCO amount"
                            )

        # Check for missing or excess visits
        for loc_id, visits in location_visits.items():
            if visits == 0:
                issues.append(f"Location {loc_id} was not assigned to any vehicle")
            elif visits > 1:
                wco_amount = location_loads.get(loc_id, 0)
                min_visits = int(np.ceil(wco_amount / max(v.capacity for v in vehicles)))
                if visits > min_visits:
                    issues.append(
                        f"Location {loc_id} has excess visits ({visits} vs needed {min_visits})"
                    )

        return len(issues) == 0, issues

    def _debug_print_location_details(self, locations: List[Location]):
        """Print detailed information about locations for debugging"""
        print("\nLocation Details:")
        for loc in sorted(locations, key=lambda x: x.wco_amount, reverse=True):
            print(f"- {loc.name}: ID={loc.id}, WCO={loc.wco_amount}L, Schedule={loc.disposal_schedule}")

    def _verify_all_locations_assigned(self, assignments: List[List[Location]], locations: List[Location]) -> List[Location]:
        """Verify all locations are assigned and return missing ones"""
        assigned_ids = {loc.id for vehicle_locs in assignments for loc in vehicle_locs}
        missing = [loc for loc in locations if loc.id not in assigned_ids]
        return missing

    def optimize_vehicle_assignments(self, vehicles: List[Vehicle], day: int, locations: List[Location] = None, force_assign: bool = False, use_geo_cluster: bool = True) -> List[List[Location]]:
        if not locations:
            return [[] for _ in vehicles]
            
        print('[optimize_vehicle_assignments] - Day:', day)
        
        # Get schedule for collection time parameters
        schedule = None
        if locations:
            freq = locations[0].disposal_schedule
            schedule = self.schedule_map.get(freq)
        
        collection_time = schedule.collection_time_minutes if schedule else 15.0

        # Skip clustering if use_geo_cluster is False
        clusters = []

        if use_geo_cluster:
            # Update clusterer with schedule-specific collection time
            clusterer = GeographicClusterer(max_time_per_stop=collection_time, speed_kph=self.speed_kph)
            # First, cluster the locations geographically
            clusters = clusterer.cluster_locations(locations, pure_geographic=True)
            clusterer.print_cluster_analysis(clusters)

            if len(vehicles) == 1 and len(clusters) > 1:
                # Merge all clusters into one for single vehicle
                clusters = [GeographicCluster(
                    id='A',
                    locations=[loc for cluster in clusters for loc in cluster.locations],
                    total_wco=sum(cluster.total_wco for cluster in clusters),
                    center_lat=np.mean([loc.coordinates[0] for loc in locations]),
                    center_lon=np.mean([loc.coordinates[1] for loc in locations]),
                    total_time=sum(cluster.total_time for cluster in clusters)
                )]
                print(f"Single vehicle - merged {len(clusters)} clusters into one")
        else:
            # If not using geographic clustering, just use the locations as a single cluster
            clusters = [GeographicCluster(
                id='A',
                locations=locations,
                total_wco=sum(loc.wco_amount for loc in locations),
                center_lat=np.mean([loc.coordinates[0] for loc in locations]),
                center_lon=np.mean([loc.coordinates[1] for loc in locations]),
                total_time=sum(estimate_collection_time(loc, collection_time) for loc in locations)
            )]
        
        # Initialize assignments
        assignments = [[] for _ in vehicles]
        vehicle_loads = [0.0 for _ in vehicles]
        vehicle_times = [0.0 for _ in vehicles]
        visited_locations: dict[str, int] = {}
        unassigned_locations = []

        # Process each cluster
        for cluster in clusters:
            # Sort locations prioritizing geographic proximity over WCO amount
            sorted_locations = sorted(
                cluster.locations, 
                key=lambda x: (
                    calculate_distance(x.coordinates, vehicles[0].depot_location),  # Primary sort by distance from depot
                    -x.wco_amount,  # Secondary sort by WCO amount
                    estimate_collection_time(x, collection_time),  # Finally by collection time
                    x.id # Add tie-breaker for similar distances
                )
            )
            
            # Try to assign each location in the sorted order
            for location in sorted_locations:
                if location.id in visited_locations:
                    continue
                    
                # Find best vehicle considering capacity, time, and current position
                best_vehicle = -1
                best_score = float('-inf')
                
                for v_idx, vehicle in enumerate(vehicles):
                    remaining_capacity = vehicle.get_remaining_capacity(vehicle_loads[v_idx])
                    if location.wco_amount > remaining_capacity:
                        continue

                    prev_location = assignments[v_idx][-1].coordinates if assignments[v_idx] else None
                    c_time, travel_time, depot_return_time = calculate_stop_times(
                        location=location,
                        depot_location=vehicle.depot_location,
                        prev_location=prev_location,
                        collection_time_minutes=collection_time,
                        speed_kph=self.speed_kph
                    )

                    total_time = vehicle_times[v_idx] + calculate_total_time(
                        c_time, travel_time, depot_return_time
                    )
                    
                    # NOTE: To determine if the location is able to reach within 
                    # the daily time limit, see TripCollection.register_collection()
                    # instead. The routes passed in the said function were already
                    # optimized by the selected solver so the time is actually
                    # validated there instead of here.
                    # 
                    # Regardless of the absence or presence of this if check below,
                    # this does not affect the assignment of locations to vehicles.
                    if total_time > self.max_daily_time:
                        print(f"Vehicle {vehicle.id} reached daily time limit")
                        continue

                    # Calculate assignment score with higher weight on distance
                    distance_km = calculate_distance(
                        prev_location or vehicle.depot_location,
                        location.coordinates
                    )
                    distance_factor = 1.0 / (1 + distance_km)
                    capacity_ratio = location.wco_amount / remaining_capacity
                    time_ratio = total_time / self.max_daily_time
                    traffic_factor = 1.0 / (1 + (travel_time / 60))

                    # Adjusted weights to prioritize distance
                    score = (
                        distance_factor * 0.5 +      # Increased weight for distance
                        capacity_ratio * 0.2 +       # Reduced weight for capacity
                        (1 - time_ratio) * 0.2 +     # Reduced weight for time
                        traffic_factor * 0.1         # Keep traffic weight same
                    )
                    
                    if score > best_score:
                        best_score = score
                        best_vehicle = v_idx
                
                if best_vehicle >= 0:
                    assignments[best_vehicle].append(location)
                    vehicle_loads[best_vehicle] += location.wco_amount
                    vehicle_times[best_vehicle] += c_time if c_time else estimate_collection_time(location, collection_time)
                    visited_locations[location.id] = best_vehicle
                else:
                    unassigned_locations.append(location)
        
        if force_assign:
            print(f"\nTrying to assign {len(unassigned_locations)} remaining locations")
            unassigned_locations.sort(key=lambda x: -x.wco_amount)
            
            still_unassigned = []
            for location in unassigned_locations:
                if location.id in visited_locations:
                    continue
                
                assigned = False
                for v_idx, vehicle in enumerate(vehicles):
                    prev_location = assignments[v_idx][-1].coordinates if assignments[v_idx] else None
                    c_time, travel_time, depot_return_time = calculate_stop_times(
                        location=location,
                        depot_location=vehicle.depot_location,
                        prev_location=prev_location,
                        collection_time_minutes=c_time,
                        speed_kph=self.speed_kph
                    )

                    total_time = vehicle_times[v_idx] + calculate_total_time(
                        c_time, travel_time, depot_return_time
                    )
                    
                    if vehicle_loads[v_idx] + location.wco_amount <= vehicle.capacity:
                        assignments[v_idx].append(location)
                        vehicle_loads[v_idx] += location.wco_amount
                        vehicle_times[v_idx] = total_time
                        visited_locations[location.id] = v_idx
                        assigned = True
                        print(f"Force assigned {location.name} to Vehicle {vehicle.id}")
                        break

                if not assigned:
                    still_unassigned.append(location)

            unassigned_locations = still_unassigned
            
        if unassigned_locations:
            print(f"\nWarning: {len(unassigned_locations)} locations could not be assigned:")
            for loc in unassigned_locations:
                print(f"- {loc.name}: {loc.wco_amount}L")

        if sum([len(a) for a in assignments]) != 0:
            # Print assignment details
            print(f"\nAssignments for day {day}:")
            for v_idx, vehicle_locs in enumerate(assignments):
                if vehicle_locs:
                    print(f"Vehicle {vehicles[v_idx].id}: {len(vehicle_locs)} locations, "
                          f"total load: {vehicle_loads[v_idx]:.1f}L")
                    for loc in vehicle_locs:
                        print(f"  - {loc.name}: {loc.wco_amount}L")
        
        return assignments

    def _get_best_vehicle(self, location_amount: float, location_id: int, location_coords: Tuple[float, float],
                          assignments: List[List[Location]], vehicle_loads: List[float], vehicle_trips: List[int],
                          vehicles: List[Vehicle]) -> int:
        if location_id in {loc.id for locs in assignments for loc in locs}:
            return -1
                
        best_vehicle = -1
        best_score = float('-inf')
        
        for i, current_load in enumerate(vehicle_loads):
            if not assignments[i]:  # Empty route
                remaining = vehicles[i].capacity - current_load
                if remaining >= location_amount:
                    score = 1.0  # Prefer empty routes for better distribution
                    if score > best_score:
                        best_score = score
                        best_vehicle = i
                continue
            
            # Check distance to last location in route
            last_loc = assignments[i][-1]
            dist = calculate_distance(last_loc.coordinates, location_coords)
            
            remaining = vehicles[i].capacity - current_load
            if remaining >= location_amount:
                # Score based on trips, capacity, and distance
                trip_factor = 1.0 / (vehicle_trips[i] + vehicles[i].trip_count)
                capacity_factor = remaining / vehicles[i].capacity
                distance_factor = 1.0 / (1 + dist)  # Prefer closer locations
                score = (trip_factor * 0.4 + 
                        capacity_factor * 0.3 + 
                        distance_factor * 0.3)
                
                if score > best_score:
                    best_score = score
                    best_vehicle = i
        
        return best_vehicle

    @staticmethod
    def can_schedules_overlap(freq1: int, freq2: int) -> bool:
        """Check if two schedules can have overlapping collection days"""
        return freq1 % freq2 == 0 or freq2 % freq1 == 0
