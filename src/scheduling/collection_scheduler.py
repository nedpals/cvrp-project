from typing import List, Dict, Set, Tuple, Optional, Iterable
from models.location import Location, Vehicle
from models.shared_models import ScheduleEntry
from models.location_registry import LocationRegistry
from models.trip_collection import TripCollection
from utils import calculate_distance
import numpy as np
from clustering.geographic_clusterer import GeographicClusterer

class CollectionScheduler:
    """Manages collection schedules based on WCO generation rates and disposal schedules"""

    def __init__(self, locations: LocationRegistry, schedules: Iterable[ScheduleEntry], simulation_days: int = 30):
        self.locations = locations
        self.frequency_map = self._build_frequency_map(schedules)
        self.MAX_COLLECTION_TIME = 7  # minutes per establishment
        self.min_load_ratio = 0.5  # Minimum vehicle load ratio to consider assignment
        
        # Calculate max simulation days needed based on schedules
        max_freq = max(self.frequency_map.values())
        self.simulation_days = min(simulation_days, max_freq)
        print(f"Optimizing collection for {self.simulation_days} days based on maximum frequency")
        
        self.schedule_map = self._build_schedule_map()
        self.daily_visited_locations = {}
        self.clusterer = GeographicClusterer()
    
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
        """Check if today is a collection day for this location using schedule map"""
        return location in self.schedule_map.get(day, [])

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

    def optimize_vehicle_assignments(self, vehicles: List[Vehicle], day: int, locations: List[Location] = None,
                                    collection_tracker: Optional[TripCollection] = None) -> List[List[Location]]:
        """Single trip optimization for vehicle assignments with geographic clustering"""
        if not locations:
            return [[] for _ in vehicles]
            
        print('[optimize_vehicle_assignments] - Day:', day)
        
        # First, cluster the locations
        clusters = self.clusterer.cluster_locations(locations)
        self.clusterer.print_cluster_analysis(clusters)
        
        # Initialize assignments
        assignments = [[] for _ in vehicles]
        vehicle_loads = [0.0 for _ in vehicles]
        vehicle_times = [0.0 for _ in vehicles]
        visited_locations: dict[str, int] = {}
        unassigned_locations = []
        
        # Assign clusters to vehicles
        for cluster in clusters:
            best_vehicle = -1
            best_score = float('-inf')
            
            for v_idx, vehicle in enumerate(vehicles):
                remaining = vehicle.get_remaining_capacity(vehicle_loads[v_idx])
                if remaining < cluster.total_wco:
                    continue
                    
                load_ratio = cluster.total_wco / vehicle.capacity
                time_ratio = cluster.total_time / (self.MAX_COLLECTION_TIME * len(cluster.locations))
                
                if time_ratio > 1.0:
                    continue
                    
                score = load_ratio * 0.7 + (1 - time_ratio) * 0.3
                
                if score > best_score:
                    best_score = score
                    best_vehicle = v_idx
            
            if best_vehicle >= 0:
                for location in cluster.locations:
                    if location.id not in visited_locations:
                        assignments[best_vehicle].append(location)
                        vehicle_loads[best_vehicle] += location.wco_amount
                        visited_locations[location.id] = best_vehicle
            else:
                # If cluster couldn't be assigned, add locations to unassigned list
                unassigned_locations.extend(cluster.locations)
        
        # Try to assign remaining locations individually
        if unassigned_locations:
            print(f"\nTrying to assign {len(unassigned_locations)} remaining locations individually")
            unassigned_locations.sort(key=lambda x: x.wco_amount, reverse=True)
            
            still_unassigned = []
            for location in unassigned_locations:
                if location.id in visited_locations:
                    continue
                    
                best_vehicle = -1
                best_fit = float('inf')
                
                for v_idx, vehicle in enumerate(vehicles):
                    remaining = vehicle.get_remaining_capacity(vehicle_loads[v_idx])
                    if remaining >= location.wco_amount:
                        # Find vehicle with best remaining capacity fit
                        fit_score = remaining - location.wco_amount
                        if fit_score < best_fit:
                            best_fit = fit_score
                            best_vehicle = v_idx
                
                if best_vehicle >= 0:
                    assignments[best_vehicle].append(location)
                    vehicle_loads[best_vehicle] += location.wco_amount
                    visited_locations[location.id] = best_vehicle
                    print(f"Assigned {location.name} to Vehicle {vehicles[best_vehicle].id}")
                else:
                    still_unassigned.append(location)
            
            if still_unassigned:
                print(f"\nWarning: {len(still_unassigned)} locations could not be assigned in this trip")
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

    def get_overlapping_schedules(schedules: List[ScheduleEntry]) -> List[Set[ScheduleEntry]]:
        """Group schedules that can be optimized together"""
        schedule_groups = []
        used_schedules = set()

        for i, schedule1 in enumerate(schedules):
            if schedule1.id in used_schedules:
                continue

            current_group = {schedule1}
            freq1 = schedule1.frequency

            for schedule2 in schedules[i+1:]:
                if schedule2.id in used_schedules:
                    continue
                    
                if CollectionScheduler.can_schedules_overlap(freq1, schedule2.frequency):
                    current_group.add(schedule2)

            schedule_groups.append(current_group)
            used_schedules.update(s.id for s in current_group)

        return schedule_groups

    def get_overlapping_schedules_for_day(self, schedules: List[ScheduleEntry], day: int) -> Set[ScheduleEntry]:
        """Get schedules that overlap on the specified day"""
        overlapping = set()

        print(f"Checking overlapping schedules for day {day}")
        
        for schedule in schedules:
            if day % schedule.frequency == 0:  # Check if this is a collection day for this schedule
                overlapping.add(schedule)
                # Find other schedules that overlap on this day
                for other in schedules:
                    if other != schedule and day % other.frequency == 0:
                        overlapping.add(other)
        
        return overlapping

    def combine_daily_collections(self, all_schedules: Set[ScheduleEntry], day: int) -> List[Location]:
        """Combine collections from overlapping schedules for a day"""
        temp_registry = LocationRegistry()
        
        # Get schedules that overlap on this specific day
        active_schedules = self.get_overlapping_schedules_for_day(list(all_schedules), day)
        if not active_schedules:
            return []
            
        print(f"Active schedules for day {day}: {[s.name for s in active_schedules]}")
        
        for schedule in active_schedules:
            schedule_locations = [
                loc for loc in self.locations.get_all()
                if loc.disposal_schedule == schedule.frequency 
                and self.is_collection_day(loc, day)
            ]
            
            for location in schedule_locations:
                temp_registry.add(location)
        
        return temp_registry.get_all()
