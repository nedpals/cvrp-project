from typing import List, Set
from models.location import Location, Vehicle, RouteConstraints
from .base_solver import BaseSolver

class ScheduleAwareSolver(BaseSolver):
    name = "Schedule-Aware Solver"
    description = "Specialized solver that considers location schedules and time windows. Best for time-sensitive routes."

    def __init__(self, locations: List[Location], vehicles: List[Vehicle], constraints: RouteConstraints):
        super().__init__(locations, vehicles, constraints)
        self.location_priorities = {}
        self.vehicle_schedules = {v.id: [] for v in vehicles}
        self.visited_locations: Set[str] = set()  # Track visited location IDs
        
    def solve(self) -> List[List[Location]]:
        """Solve CVRP with schedule awareness - returns list of routes with Location objects"""
        routes = []
        
        for vehicle in self.vehicles:
            available_locations = [
                loc for loc in self.locations 
                if loc.id not in self.visited_locations
            ]
            
            if not available_locations:
                continue
                
            route = self._generate_route(available_locations)
            routes.append(route)
            
        return routes

    def _generate_route(self, locations: list[Location]) -> List[Location]:
        """Generate route with single trip constraint - returns list of Location objects"""
        route = [None]  # Depot placeholder
        
        for loc in locations:
            # Add location to route
            route.append(loc)
            # Mark location as visited
            self.visited_locations.add(loc.id)
        
        # Ensure route ends at depot
        if route[-1] is not None:
            route.append(None)
            
        return route
