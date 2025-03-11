from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
from ortools.constraint_solver.pywrapcp import RoutingIndexManager, RoutingModel
from models.location import Location, Vehicle, RouteConstraints
from .base_solver import BaseSolver
from typing import List

class ORToolsSolver(BaseSolver):
    name = "Google OR-Tools Solver"
    description = "Advanced optimization solver using Google's Operations Research tools. Best for complex routing problems."

    def __init__(self, locations: list[Location], vehicles: list[Vehicle], constraints: RouteConstraints):
        super().__init__(locations, vehicles, constraints)

    def solve(self):
        # Sort locations by distance from depot (farthest first)
        self.locations.sort(key=lambda x: x.distance_from_depot, reverse=True)
        
        # Convert problem size to int
        num_locations = int(len(self.locations))
        num_vehicles = int(len(self.vehicles))
        depot_index = int(0)  # depot index
        
        manager = pywrapcp.RoutingIndexManager(
            num_locations,
            num_vehicles,
            depot_index
        )
        
        routing = pywrapcp.RoutingModel(manager)

        # Distance callback
        def distance_callback(from_index, to_index):
            try:
                from_node = manager.IndexToNode(int(from_index))
                to_node = manager.IndexToNode(int(to_index))
                return int(self._calculate_distance(
                    self.locations[from_node].coordinates,
                    self.locations[to_node].coordinates
                ))
            except Exception as e:
                print(f"Error in distance_callback: {e}")
                return 0

        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        # Demand callback with error handling
        def demand_callback(from_index):
            try:
                node = manager.IndexToNode(int(from_index))
                return int(max(1, int(self.locations[node].wco_amount)))
            except Exception as e:
                print(f"Error in demand_callback: {e}")
                return 1

        demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index,
            0,  # null capacity slack
            [int(max(1, int(vehicle.capacity))) for vehicle in self.vehicles],
            True,  # start cumul to zero
            'Capacity'
        )

        # Set high cost for unused capacity to encourage fuller loads
        capacity_dimension = routing.GetDimensionOrDie('Capacity')
        for vehicle_id in range(len(self.vehicles)):
            index = routing.End(vehicle_id)
            capacity_dimension.SetGlobalSpanCostCoefficient(100)

        # Add one-way road constraints using forbidden transitions
        for from_loc, to_loc in self.constraints.one_way_roads:
            try:
                from_index = next(i for i, loc in enumerate(self.locations) 
                                if loc.coordinates == tuple(from_loc))
                to_index = next(i for i, loc in enumerate(self.locations) 
                              if loc.coordinates == tuple(to_loc))
                
                # Forbid travel in the opposite direction of one-way road
                routing.NextVar(manager.NodeToIndex(to_index)).RemoveValue(
                    manager.NodeToIndex(from_index)
                )
            except StopIteration:
                print(f"Warning: One-way road locations not found in current schedule")
                continue

        # Use guided local search with optimized parameters
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
        )
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        
        # Scale time limit with problem size
        time_limit = min(max(5, num_locations // 2), 30)  # Between 5-30 seconds
        search_parameters.time_limit.seconds = time_limit
        
        # Enable parallel search
        search_parameters.use_full_propagation = True
        search_parameters.number_of_solutions_to_collect = 1
        search_parameters.log_search = False

        # Add initial solution hinting
        for vehicle_id in range(num_vehicles):
            start_index = vehicle_id * (num_locations // num_vehicles)
            end_index = (vehicle_id + 1) * (num_locations // num_vehicles)
            for loc_idx in range(start_index, end_index):
                if loc_idx < num_locations:
                    routing.VehicleVar(manager.NodeToIndex(loc_idx)).SetValues([-1, vehicle_id])

        solution = routing.SolveWithParameters(search_parameters)
        return self._process_solution(manager, routing, solution)

    def _process_solution(self, manager: RoutingIndexManager, routing: RoutingModel, solution) -> List[List[Location]]:
        """Process OR-Tools solution into list of Location routes"""
        if not solution:
            return []
            
        routes = []
        
        for vehicle_id in range(len(self.vehicles)):
            if routing.IsVehicleUsed(solution, vehicle_id):
                route = [None]  # Depot placeholder
                index = routing.Start(vehicle_id)
                
                while not routing.IsEnd(index):
                    node_index = manager.IndexToNode(index)
                    if node_index != 0:  # Skip depot
                        route.append(self.locations[node_index])
                    index = solution.Value(routing.NextVar(index))
                
                route.append(None)  # End at depot
                if len(route) > 2:  # Only include routes with actual stops
                    routes.append(route)
            else:
                print(f"Vehicle {vehicle_id} is not used")
                routes.append([])
        
        return routes
