from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import json
from pathlib import Path
from typing import List
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from datetime import datetime

from models.shared_models import (
    Location,
    Vehicle,
    RouteConstraints,
    RouteAnalysisResult as RouteResponse,
    ScheduleEntry
)
from models.config import Config, MapConfig, SolveConfig
from models.location_registry import LocationRegistry
from solvers.solvers import SOLVERS
from cvrp import CVRP

import os
import traceback
from visualization.route_visualizer import RouteVisualizer

app = FastAPI(
    title="CVRP API",
    description="API for Waste Cooking Oil Collection Route Optimization",
    version="1.0.0"
)

# Serve frontend static files
frontend_path = Path(__file__).parent.parent.parent / 'frontend' / 'dist'
app.mount("/assets", StaticFiles(directory=str(frontend_path / "assets")), name="assets")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

@app.post("/api/optimize", response_model=List[RouteResponse])
async def optimize_routes(
    config: Config,
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
                depot_location=config.settings.depot_location
            ) for v in config.settings.vehicles
        ]

        # Validate solver
        if config.settings.solver not in SOLVERS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid solver. Choose from: {', '.join(SOLVERS.keys())}"
            )
        
        solver_class = SOLVERS[config.settings.solver]

        # Create CVRP instance
        cvrp = CVRP(
            vehicles=vehicles,
            solver_class=solver_class,
            constraints=config.settings.constraints
        )

        # Process routes
        results, _ = cvrp.process(
            schedule_entries=config.schedules,
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
                        center_coordinates=config.settings.depot_location,
                        api_key=os.getenv('ORS_API_KEY')
                    )

                    visualizer.add_routes(day_result)
                    final_results.append(day_result)
                    
            except Exception as path_error:
                print(f"Warning: Failed to generate road paths for schedule {base_id}: {str(path_error)}")
                final_results.extend(sorted_days)  # Add results without road paths

        # Convert datetime objects and encode to JSON
        serializable_results = []
        for result in final_results:
            result_dict = result.__dict__
            result_dict['date_generated'] = result_dict['date_generated'].isoformat()
            serializable_results.append(result_dict)

        return JSONResponse(content=jsonable_encoder(serializable_results))

    except Exception as e:
        print(f"Error: {str(e)}")
        traceback.print_exc()
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

@app.get("/api/config")
async def get_default_config():
    """Get default application configuration"""
    try:
        config_path = Path(__file__).parent.parent.parent / 'default_config.json'
        if config_path.exists():
            with open(config_path) as f:
                config_data = json.load(f)
                return Config(**config_data)
        
        # Fallback config if file doesn't exist
        return Config(
            map=MapConfig(
                center=(7.0707, 125.6087),  # Davao City center
                zoom_level=13,
                path_weight=5,
                path_opacity=0.6
            ),
            schedules=[
                ScheduleEntry(
                    id="default",
                    name="Default Schedule",
                    frequency=7,
                    file="default_schedule.csv",
                    color="#FF0000",
                    icon="fas fa-trash"
                )
            ],
            locations=[],
            settings=SolveConfig(
                solver='schedule',
                vehicles=[],
                depot_location=(7.099907716684531, 125.58941003079195),
                constraints=RouteConstraints(one_way_roads=[])
            )
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load default config: {str(e)}"
        )

# Catch-all route for SPA client-side routing
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str, request: Request):
    # If path starts with /api, let it fall through to API routes
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API route not found")
        
    # Otherwise serve the frontend index.html
    return FileResponse(str(frontend_path / "index.html"))

def start_api_server(host="0.0.0.0", port=8000):
    """Start the FastAPI server with the given host and port"""
    import uvicorn
    uvicorn.run(app, host=host, port=port)

if __name__ == "__main__":
    start_api_server()
