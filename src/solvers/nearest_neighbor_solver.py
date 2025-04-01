from models.location import Location, Vehicle, RouteConstraints
from .base_solver import BaseSolver
from typing import List

class NearestNeighborSolver(BaseSolver):
    id = "nearest_neighbor_solver"
    name = "Nearest Neighbor Solver"
    description = "Simple solver that always chooses the closest next location. Fast but may not find optimal solutions."

    def __init__(self, locations: list[Location], vehicles: list[Vehicle], constraints: RouteConstraints):
        super().__init__(locations, vehicles, constraints)
        self.unvisited = set(range(len(locations)))
        
    def solve(self) -> List[List[Location]]:
        """Solve CVRP using nearest neighbor approach with capacity prioritization"""
        routes = []
        
        # Sort locations by distance (farthest first) for initial assignments
        sorted_locations = sorted(
            enumerate(self.locations), 
            key=lambda x: (-x[1].distance_from_depot, -x[1].wco_amount)
        )
        
        for vehicle in self.vehicles:
            route = [None]  # Depot placeholder
            current_load = 0.0
            current_pos = self.depot_location
            remaining_locs = set(i for i, _ in sorted_locations)
            
            while remaining_locs:
                best_loc_idx = None
                best_distance = float('inf')
                
                for loc_idx in remaining_locs:
                    location = self.locations[loc_idx]
                    
                    if current_load + location.wco_amount > vehicle.capacity:
                        if current_pos != self.depot_location:
                            route.append(None)  # Return to depot
                            current_load = 0.0
                            current_pos = self.depot_location
                    
                    dist = self._calculate_distance(current_pos, location.coordinates)
                    if dist < best_distance:
                        best_distance = dist
                        best_loc_idx = loc_idx
                
                if best_loc_idx is None:
                    break
                    
                best_loc = self.locations[best_loc_idx]
                route.append(best_loc)
                current_load += best_loc.wco_amount
                current_pos = best_loc.coordinates
                remaining_locs.remove(best_loc_idx)
                
                if current_load >= 0.9 * vehicle.capacity:
                    route.append(None)  # Return to depot
                    current_load = 0.0
                    current_pos = self.depot_location
            
            if route[-1] is not None:
                route.append(None)
            
            routes.append(route)
            
        return routes
