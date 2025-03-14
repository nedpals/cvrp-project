from typing import List, Dict, Tuple, Optional, Iterable
from models.location import Location, Vehicle
from models.shared_models import ScheduleEntry, AVERAGE_SPEED_KPH
from models.location_registry import LocationRegistry
from models.trip_collection import TripCollection
from utils import calculate_distance
import numpy as np
from clustering.geographic_clusterer import GeographicClusterer

class CollectionScheduler:
    """Manages collection schedules based on WCO generation rates and disposal schedules"""

    def __init__(self, locations: LocationRegistry, schedules: Iterable[ScheduleEntry], 
                 vehicles: List[Vehicle], simulation_days: int = 30):
        self.locations = locations
        self.vehicles = vehicles
        self.frequency_map = self._build_frequency_map(schedules)
        self.MAX_DAILY_TIME = 7 * 60  # Total working day in minutes
        self.MAX_STOP_TIME = 15  # Maximum minutes allowed per establishment
        self.min_load_ratio = 0.5  # Minimum vehicle load ratio to consider assignment
        self.SPEED_KPH = AVERAGE_SPEED_KPH
        self.MAX_TRAVEL_TIME = 240  # 4 hours max travel time
        
        # Calculate max simulation days needed based on schedules
        max_freq = max(self.frequency_map.values())
        self.simulation_days = min(simulation_days, max_freq)
        print(f"Optimizing collection for {self.simulation_days} days based on maximum frequency")
        
        self.schedule_map = self._build_schedule_map()
        self.daily_visited_locations = {}
        self.clusterer = GeographicClusterer(max_time_per_stop=self.MAX_STOP_TIME)
    
    def _build_frequency_map(self, schedules: Iterable[ScheduleEntry]) -> dict[int, int]:
        """Build mapping of schedule_type to frequency"""
        return {
            schedule.frequency: schedule.frequency
            for schedule in schedules
        }
    
    def _build_schedule_map(self) -> Dict[int, List[Location]]:
        """Create daily collection schedule map"""
        schedule_map = {day: [] for day in range(1, self.simulation_days + 1)}
        
        for location in self.locations.get_all():
            if not location.disposal_schedule:
                continue
                
            freq = self.frequency_map.get(location.disposal_schedule, 7)
            for day in range(1, self.simulation_days + 1):
                if day % freq == 0:
                    schedule_map[day].append(location)
                
        return schedule_map

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

    def optimize_vehicle_assignments(self, vehicles: List[Vehicle], day: int, locations: List[Location] = None) -> List[List[Location]]:
        if not locations:
            return [[] for _ in vehicles]
            
        print('[optimize_vehicle_assignments] - Day:', day)
        
        # First, cluster the locations geographically
        clusters = self.clusterer.cluster_locations(locations, pure_geographic=True)
        self.clusterer.print_cluster_analysis(clusters)
        
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
                    self.clusterer.estimate_collection_time(x)  # Finally by collection time
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
                        
                    # Calculate time and load scores
                    collection_time = min(
                        self.MAX_STOP_TIME,
                        self.clusterer.estimate_collection_time(location)
                    )
                    current_time = vehicle_times[v_idx]
                    
                    # Get distance and travel time factors
                    if assignments[v_idx]:
                        last_loc = assignments[v_idx][-1]
                        distance_km = calculate_distance(last_loc.coordinates, location.coordinates)
                    else:
                        distance_km = calculate_distance(vehicle.depot_location, location.coordinates)

                    distance_factor = 1.0 / (1 + distance_km)
                    travel_time = self._estimate_travel_time(distance_km)
                    total_time = current_time + collection_time + travel_time
                    
                    if (collection_time > self.MAX_STOP_TIME or 
                        total_time > self.MAX_DAILY_TIME):
                        continue
                        
                    if travel_time > self.MAX_TRAVEL_TIME:
                        continue
                    
                    # Calculate assignment score with higher weight on distance
                    capacity_ratio = location.wco_amount / remaining_capacity
                    time_ratio = total_time / self.MAX_DAILY_TIME
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
                    vehicle_times[best_vehicle] += self.clusterer.estimate_collection_time(location)
                    visited_locations[location.id] = best_vehicle
                else:
                    unassigned_locations.append(location)
        
        # Try to assign any remaining locations
        if unassigned_locations:
            print(f"\nTrying to assign {len(unassigned_locations)} remaining locations")
            unassigned_locations.sort(key=lambda x: -x.wco_amount)
            
            still_unassigned = []
            for location in unassigned_locations:
                if location.id in visited_locations:
                    continue
                
                assigned = False
                for v_idx, vehicle in enumerate(vehicles):
                    if (vehicle_loads[v_idx] + location.wco_amount <= vehicle.capacity and
                        vehicle_times[v_idx] + self.clusterer.estimate_collection_time(location) <= self.MAX_DAILY_TIME):
                        assignments[v_idx].append(location)
                        vehicle_loads[v_idx] += location.wco_amount
                        vehicle_times[v_idx] += self.clusterer.estimate_collection_time(location)
                        visited_locations[location.id] = v_idx
                        assigned = True
                        print(f"Assigned {location.name} to Vehicle {vehicle.id}")
                        break
                
                if not assigned:
                    still_unassigned.append(location)
            
            if still_unassigned:
                print(f"\nWarning: {len(still_unassigned)} locations could not be assigned:")
                for loc in still_unassigned:
                    print(f"- {loc.name}: {loc.wco_amount}L")
        
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

    def balance_daily_collections(self, locations: List[Location], vehicles: List[Vehicle], original_day: int) -> Dict[int, List[Location]]:
        """Balance locations across multiple days, allowing multiple trips per day within time constraints"""
        balanced_days: Dict[int, List[Location]] = {original_day: []}
        remaining = locations.copy()
        current_day = original_day
        
        # Track vehicle daily times
        vehicle_daily_times = {v.id: 0.0 for v in vehicles}
        vehicle_daily_trips = {v.id: 0 for v in vehicles}
        
        while remaining:
            available_vehicles = [
                v for v in vehicles 
                if vehicle_daily_times[v.id] < self.MAX_DAILY_TIME
            ]
            
            if not available_vehicles:
                # All vehicles have reached their daily time limit, move to next day
                current_day += 1
                balanced_days[current_day] = []
                vehicle_daily_times = {v.id: 0.0 for v in vehicles}
                vehicle_daily_trips = {v.id: 0 for v in vehicles}
                print(f"Moving to day {current_day} - all vehicles reached daily time limit")
                continue
                
            # Try to assign locations to available vehicles for new trips
            assignments = self.optimize_vehicle_assignments(
                available_vehicles, 
                current_day, 
                remaining
            )

            assigned_locations = set()
            for v_idx, vehicle_locs in enumerate(assignments):
                if not vehicle_locs:
                    continue
                    
                vehicle = available_vehicles[v_idx]
                vehicle_daily_trips[vehicle.id] += 1
                
                # Calculate total time for this trip including travel time
                trip_time = 0.0
                prev_loc = None
                
                for loc in vehicle_locs:
                    # Collection time
                    collection_time = self.clusterer.estimate_collection_time(loc)
                    
                    # Travel time
                    if prev_loc:
                        distance = calculate_distance(prev_loc.coordinates, loc.coordinates)
                        travel_time = self._estimate_travel_time(distance)
                        trip_time += travel_time
                    else:
                        # First location - calculate from depot
                        distance = calculate_distance(vehicle.depot_location, loc.coordinates)
                        travel_time = self._estimate_travel_time(distance)
                        trip_time += travel_time
                    
                    trip_time += collection_time
                    prev_loc = loc
                    assigned_locations.add(loc)
                
                # Update vehicle's daily time
                vehicle_daily_times[vehicle.id] += trip_time
                
            if not assigned_locations:
                # If no assignments possible with current vehicles/time constraints
                current_day += 1
                balanced_days[current_day] = []
                vehicle_daily_times = {v.id: 0.0 for v in vehicles}
                vehicle_daily_trips = {v.id: 0 for v in vehicles}
                print(f"Moving to day {current_day} - no feasible assignments")
                continue
                
            # Record assignments for this day
            balanced_days[current_day].extend(assigned_locations)
            
            # Update remaining locations
            remaining = [loc for loc in remaining if loc not in assigned_locations]
            
            if remaining:
                print(f"Day {current_day}: Assigned {len(assigned_locations)} locations, "
                      f"{len(remaining)} locations remaining")
                for v in vehicles:
                    trips = vehicle_daily_trips[v.id]
                    time = vehicle_daily_times[v.id]
                    print(f"Vehicle {v.id}: {trips} trips, {time:.1f} minutes used")
            else:
                print(f"Day {current_day}: Assigned all locations")
        
        for day, locs in balanced_days.items():
            print(f"[end] Day {day}: {len(locs)} locations assigned")
        return balanced_days

    def combine_daily_collections(self, schedule: ScheduleEntry, day: int) -> List[Location]:
        """Get collections for a specific schedule and day"""
        if day % schedule.frequency != 0:
            return []
            
        # Get locations for this schedule
        schedule_locations = [
            loc for loc in self.locations.get_all()
            if loc.disposal_schedule == schedule.frequency
        ]
        
        # Balance locations across days if needed
        balanced_assignments = self.balance_daily_collections(
            schedule_locations,
            self.vehicles,
            day
        )
        
        return balanced_assignments.get(day, [])
    
    def _estimate_travel_time(self, distance_km: float) -> float:
        """Estimate travel time in minutes based on average city speed"""
        return (distance_km / self.SPEED_KPH) * 60
