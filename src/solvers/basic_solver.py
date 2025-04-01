from typing import List, Set
from models.location import Location, Vehicle, RouteConstraints
from .base_solver import BaseSolver

class BasicSolver(BaseSolver):
    name = "Basic Solver"
    description = "Simple solver that generates routes without optimization"

    def __init__(self, locations: List[Location], vehicles: List[Vehicle], constraints: RouteConstraints):
        super().__init__(locations, vehicles, constraints)
        
    def solve(self) -> List[List[Location]]:
        # Passively generate routes
        final_routes = [None] + self.locations + [None]  # Add depot placeholder
        return [
            final_routes for _ in self.vehicles
        ]
