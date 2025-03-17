from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
from ortools.constraint_solver.pywrapcp import RoutingIndexManager, RoutingModel
from models.location import Location, Vehicle, RouteConstraints
from models.shared_models import AVERAGE_SPEED_KPH
from .base_solver import BaseSolver
from typing import List
from utils import estimate_collection_time

class ORToolsSolver(BaseSolver):
    name = "Google OR-Tools Solver"
    description = "Advanced optimization solver using Google's Operations Research tools. Best for complex routing problems."

    def __init__(self, locations: list[Location], vehicles: list[Vehicle], constraints: RouteConstraints):
        super().__init__(locations, vehicles, constraints)
        self.MAX_DAILY_TIME = 7 * 60  # Total working day in minutes (from CollectionScheduler)
        self.MAX_STOP_TIME = 15  # Maximum minutes allowed per establishment
        self.SPEED_KPH = AVERAGE_SPEED_KPH

    def solve(self):
        # Handle edge cases
        if len(self.locations) == 1:
            # Return single location route
            return [[None, self.locations[0], None]]
            
        # Convert problem size to int
        num_locations = int(len(self.locations))
        num_vehicles = int(len(self.vehicles))
        depot_index = int(0)  # depot index
        
        # Ensure we have enough vehicles to service all locations
        # Each vehicle must visit at least one location
        min_required_vehicles = max(1, (num_locations + 2) // 3)  # At most 3 locations per vehicle
        num_vehicles = num_vehicles if num_vehicles == 1 else max(min_required_vehicles, num_vehicles)
        
        if num_vehicles == 0:
            return []
            
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

        # Define time window constraints with scheduler constants
        def time_callback(from_index, to_index):
            try:
                from_node = manager.IndexToNode(int(from_index))
                to_node = manager.IndexToNode(int(to_index))
                
                # Add service time for the from_node (except depot)
                service_time = 0
                if from_node != depot_index:
                    service_time = max(5, min(
                        int(estimate_collection_time(self.locations[from_node], self.MAX_STOP_TIME) * 1.2),
                        self.MAX_STOP_TIME
                    ))
                
                # Calculate travel time
                distance = self._calculate_distance(
                    self.locations[from_node].coordinates,
                    self.locations[to_node].coordinates
                )
                travel_time = int(distance / self.SPEED_KPH * 60)
                
                return travel_time + service_time
            except Exception as e:
                print(f"Error in time_callback: {e}")
                return self.MAX_STOP_TIME

        time_callback_index = routing.RegisterTransitCallback(time_callback)
        routing.AddDimension(
            time_callback_index,
            60,  # Allow 60 minute slack for breaks
            self.MAX_DAILY_TIME * 2,  # Double the max daily time to allow for flexibility
            True,  # Force start cumul to zero
            'Time'
        )

        time_dimension = routing.GetDimensionOrDie('Time')
        
        # Set working hours constraints with more flexibility
        for location_idx in range(num_locations):
            index = manager.NodeToIndex(location_idx)
            if location_idx == depot_index:
                # Allow depot visits at any time
                time_dimension.CumulVar(index).SetRange(0, self.MAX_DAILY_TIME * 2)
            else:
                # Give more flexible time windows for locations
                time_dimension.CumulVar(index).SetRange(0, self.MAX_DAILY_TIME)

        # Add a dimension for capacity
        def demand_callback(from_index):
            """Return the demand of the node (WCO amount to collect)"""
            try:
                from_node = manager.IndexToNode(int(from_index))
                # Depot has zero demand
                if from_node == depot_index:
                    return 0
                return int(self.locations[from_node].wco_amount * 10)  # Multiply by 10 to handle decimal values
            except Exception as e:
                print(f"Error in demand_callback: {e}")
                return 0

        demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)

        # Add capacity dimension - the total amount that can be collected in one trip
        total_demand = sum(int(loc.wco_amount * 10) for loc in self.locations if loc.coordinates != self.depot_location)
        vehicle_capacities = [int(v.capacity * 10) for v in self.vehicles]

        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index,
            0,       # No slack
            vehicle_capacities,  # Vehicle capacities
            True,    # Start cumul to zero
            'Capacity'
        )

        # Add constraint to prevent returns to depot before all locations are visited
        for vehicle_id in range(num_vehicles):
            index = routing.Start(vehicle_id)
            routing.AddDisjunction([index], 0)  # Allow not using all vehicles

        # Use guided local search with optimized parameters
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        if num_vehicles == 1:
            search_parameters.first_solution_strategy = (
                routing_enums_pb2.FirstSolutionStrategy.SAVINGS
            )
            time_limit = min(max(10, num_locations), 60)
        else:
            search_parameters.first_solution_strategy = (
                routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
            )
            time_limit = min(max(5, num_locations // 2), 30)

        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.seconds = time_limit
        
        # Enable parallel search
        search_parameters.use_full_propagation = True
        search_parameters.number_of_solutions_to_collect = 1
        search_parameters.log_search = False

        # Process solution with better error handling
        try:
            solution = routing.SolveWithParameters(search_parameters)
            if not solution:
                # If no solution found, use simple TSP for single vehicle
                if num_vehicles == 1:
                    return [[None] + sorted(self.locations, key=lambda x: x.distance_from_depot) + [None]]
                # Fallback for small multi-vehicle problems
                elif num_locations <= 10:
                    return [[None] + self.locations + [None]]
            return self._process_solution(manager, routing, solution)
        except Exception as e:
            print(f"Error solving route: {e}")
            if num_vehicles == 1:
                return [[None] + sorted(self.locations, key=lambda x: x.distance_from_depot) + [None]]
            # Fallback for very small problems
            if num_locations <= 5:
                return [[None] + self.locations + [None]]
            return []

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
