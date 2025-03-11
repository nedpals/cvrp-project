from typing import List
from models.location import Location, Vehicle, RouteConstraints
from .base_solver import BaseSolver
import heapq

class GreedySolver(BaseSolver):
    name = "Greedy Solver"
    description = "Fast solver that prioritizes closest locations and maximum capacity utilization. Good for simple routes."

    def __init__(self, locations: list[Location], vehicles: list[Vehicle], constraints: RouteConstraints):
        super().__init__(locations, vehicles, constraints)
        self.unvisited = set(range(len(locations)))
        
    def solve(self):
        """Solve CVRP using greedy approach with capacity constraints"""
        routes = []
        
        # Sort locations by distance (farthest first) and WCO amount
        location_priorities = []
        for i, loc in enumerate(self.locations):
            priority = (-loc.distance_from_depot, -loc.wco_amount)  # Negative for max-heap
            heapq.heappush(location_priorities, (priority, i))
        
        # Assign locations to vehicles
        for vehicle in self.vehicles:
            route = self._build_route(vehicle, location_priorities)
            routes.append(route)
            
        return routes
    
    def _build_route(self, vehicle: Vehicle, location_priorities: List) -> List[Location]:
        """Build route for a single vehicle"""
        route = [None]  # Depot placeholder
        remaining_capacity = vehicle.capacity
        available_locations = location_priorities.copy()
        current_pos = self.depot_location
        
        while available_locations:
            best_location = None
            best_idx = -1
            best_distance = float('inf')
            
            for i, (priority, loc_idx) in enumerate(available_locations):
                location = self.locations[loc_idx]
                
                if location.wco_amount > remaining_capacity:
                    continue
                
                dist = self._calculate_distance(current_pos, location.coordinates)
                if dist < best_distance:
                    best_distance = dist
                    best_location = location
                    best_idx = i
                    
            if best_location is None:
                route.append(None)  # Return to depot
                remaining_capacity = vehicle.capacity
                current_pos = self.depot_location
                continue
                
            route.append(best_location)
            remaining_capacity -= best_location.wco_amount
            current_pos = best_location.coordinates
            available_locations.pop(best_idx)
            
            if remaining_capacity < 100:  # Minimum threshold
                route.append(None)  # Return to depot
                remaining_capacity = vehicle.capacity
                current_pos = self.depot_location
        
        if route[-1] is not None:
            route.append(None)
            
        return route