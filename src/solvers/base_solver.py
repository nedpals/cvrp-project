from abc import ABC, abstractmethod
from typing import List, Tuple
from models.location import Location, Vehicle, RouteConstraints
from math import radians, sin, cos, sqrt, atan2
from utils import calculate_distance

class BaseSolver(ABC):
    id = "base_solver"
    name = "Base Solver"
    description = "Abstract base solver class"

    def __init__(self, locations: list[Location], vehicles: list[Vehicle], constraints: RouteConstraints):
        self.locations = locations
        self.vehicles = vehicles
        self.constraints = constraints
        self.depot_location = vehicles[0].depot_location

    @abstractmethod
    def solve(self) -> List[List[Location]]:
        """Solve the CVRP problem and return list of routes (each route is a list of Location objects)"""
        pass

    def _calculate_distance(self, coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
        return calculate_distance(coord1, coord2)

    def calculate_route_distance(self, route: List[Tuple[float, float]]) -> float:
        """Calculate total distance of a route"""
        total_distance = 0.0
        for i in range(len(route) - 1):
            total_distance += self._calculate_distance(route[i], route[i + 1])
        return total_distance
