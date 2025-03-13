from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
import json
from pathlib import Path
from typing import List
from fastapi.encoders import jsonable_encoder

from models.shared_models import (
    Location,
    Vehicle,
    RouteConstraints,
    RouteAnalysisResult as RouteResponse,
    ScheduleEntry
)
from .models import ConfigRequest
from models.location_registry import LocationRegistry
from cvrp import CVRP
from solvers.or_tools_solver import ORToolsSolver
from solvers.greedy_solver import GreedySolver
from solvers.nearest_neighbor_solver import NearestNeighborSolver
from solvers.schedule_aware_solver import ScheduleAwareSolver

import os
from visualization.route_visualizer import RouteVisualizer

app = FastAPI(
    title="CVRP API",
    description="API for Waste Cooking Oil Collection Route Optimization",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Solver mapping
SOLVERS = {
    'ortools': ORToolsSolver,
    'greedy': GreedySolver,
    'nearest': NearestNeighborSolver,
    'schedule': ScheduleAwareSolver
}

@app.post("/api/optimize", response_model=List[RouteResponse])
async def optimize_routes(
    config: ConfigRequest,
    locations: List[Location]
) -> List[RouteResponse]:
    try:
        # Initialize location registry
        location_registry = LocationRegistry()
        for loc in locations:
            location_registry.add(loc)

        # Create vehicles from config
        vehicles = [
            Vehicle(
                id=v.id,
                capacity=v.capacity,
                depot_location=config.depot_location
            ) for v in config.vehicles
        ]

        # Create route constraints
        constraints = RouteConstraints(
            one_way_roads=[(tuple(road[0]), tuple(road[1])) 
                          for road in config.one_way_roads]
        )

        # Validate solver
        if config.solver not in SOLVERS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid solver. Choose from: {', '.join(SOLVERS.keys())}"
            )
        
        solver_class = SOLVERS[config.solver]

        # Create CVRP instance
        cvrp = CVRP(
            vehicles=vehicles,
            solver_class=solver_class,
            constraints=constraints,
            allow_multiple_trips=config.allow_multiple_trips
        )

        # Convert schedule entries
        schedule_entries = [
            ScheduleEntry(
                id=s.id,
                name=s.name,
                frequency=s.frequency,
                file=s.file
            ) for s in config.schedules
        ]

        # Process routes
        results, collection_tracker = cvrp.process(
            schedule_entries=schedule_entries,
            locations=location_registry
        )
        
        # Generate road paths and group by schedule
        schedule_results = {}  # Group results by base schedule
        for result in results:
            base_id = result.base_schedule_id
            if base_id not in schedule_results:
                schedule_results[base_id] = []
            schedule_results[base_id].append(result)
        
        # Process each schedule's results
        final_results = []
        for base_id, schedule_days in schedule_results.items():
            # Sort by day
            sorted_days = sorted(schedule_days, key=lambda x: x.collection_day)
            
            try:
                # Process each day
                for day_result in sorted_days:
                    visualizer = RouteVisualizer(
                        center_coordinates=config.depot_location,
                        api_key=os.getenv('ORS_API_KEY')
                    )

                    visualizer.add_routes(day_result)
                    
                    # Get computed paths and update the result
                    computed_paths = visualizer.get_computed_paths()
                    if day_result.schedule_id in computed_paths:
                        for vehicle_route in day_result.vehicle_routes:
                            if vehicle_route.vehicle_id in computed_paths[day_result.schedule_id]:
                                vehicle_route.road_paths = computed_paths[day_result.schedule_id][vehicle_route.vehicle_id]
                    
                    final_results.append(day_result)
                    
            except Exception as path_error:
                print(f"Warning: Failed to generate road paths for schedule {base_id}: {str(path_error)}")
                final_results.extend(sorted_days)  # Add results without road paths

        # Convert to JSON-serializable format
        return Response(content=jsonable_encoder(final_results), media_type="application/json")

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/api/solvers")
async def get_solvers():
    """Get list of available solvers with their names and descriptions"""
    return {
        "solvers": [
            {
                "id": solver_id,
                "name": solver_class.name,
                "description": solver_class.description
            }
            for solver_id, solver_class in SOLVERS.items()
        ]
    }

@app.get("/api/config/visualization")
async def get_visualization_config():
    """Get visualization configuration"""
    try:
        config_path = Path(__file__).parent.parent.parent / 'data' / 'visualization_config.json'
        with open(config_path) as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load visualization config: {str(e)}"
        )

def start_api_server(host="0.0.0.0", port=8000):
    """Start the FastAPI server with the given host and port"""
    import uvicorn
    uvicorn.run(app, host=host, port=port)

if __name__ == "__main__":
    start_api_server()
