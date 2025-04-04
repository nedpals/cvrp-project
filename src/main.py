"""
The study focuses on optimizing the collection of waste cooking oil (WCO) from deep-frying establishments in District 1, Davao City, using the Capacitated Vehicle Routing Problem (CVRP). 

The following data will be provided by the researchers:
1. Coordinates of the collection points
2. Amount of WCO generated per collection point
3. Disposal schedule per collection point
4. No. of vehicles

Programmer's Task:
1. Design collection routes that aligns to the:
     a. disposal schedule considering capacity of the vehicle
     b. one-way road constraints
     c. no. of vehicles
2. Provide the distance traveled by each vehicle
3. Conduct trials to test the route distance optimality by comparing primary optimization tool (Google OR) with the validation tool (Gurobi)
4. Visualization of the routes
"""

import traceback
import pandas as pd
import os
from pathlib import Path
from models.location import Location, Vehicle
from visualization.route_visualizer import RouteVisualizer
from typing import List
import json
import argparse
from models.config import Config
from models.shared_models import ScheduleEntry
from datetime import datetime
from models.route_data import RouteAnalysisResult
from models.trip_collection import TripCollection
from models.location_registry import LocationRegistry
from cvrp import CVRP
from data.schedule_loader import ScheduleLoader
from api.server import start_api_server
from solvers.solvers import SOLVERS, DEFAULT_SOLVER_ID

class DateTimeEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle datetime objects and custom classes"""
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if hasattr(obj, '__dict__'):
            return obj.__dict__
        try:
            return json.JSONEncoder.default(self, obj)
        except TypeError:
            return str(obj)  # Last resort: convert to string

class CvrpSystem:
    def __init__(self):
        self.api_key = os.getenv('ORS_API_KEY')
        self.data_path = Path(__file__).parent.parent / 'data'

    def create_output_directory(self) -> Path:
        """Create timestamped output directory for results."""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        base_output_dir = Path(__file__).parent.parent / 'output'
        output_dir = base_output_dir / timestamp
        
        # Create directories if they don't exist
        output_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"Output directory created at: {output_dir}")
        return output_dir

    @staticmethod
    def parse_args():
        parser = argparse.ArgumentParser(description='CVRP Solver for WCO Collection')
        parser.add_argument(
            '--solver', 
            type=str,
            choices=list(SOLVERS.keys()),
            default=DEFAULT_SOLVER_ID,
            help='Solver to use for route optimization'
        )
        parser.add_argument(
            '--api',
            action='store_true',
            help='Start the API server instead of running CVRP directly'
        )
        parser.add_argument(
            '--port',
            type=int,
            default=8000,
            help='Port for the API server (default: 8000)'
        )
        parser.add_argument(
            '--disable-scheduling',
            action='store_true',
            help='Disable schedule-based optimization (not recommended)'
        )
        return parser.parse_args()

    def load_config(self) -> Config:
        config_path = Path(__file__).parent.parent / 'data' / 'schedule_config.json'
        with open(config_path) as f:
            config_dict = json.load(f)
        return Config(**config_dict)
    
    def load_schedule_data(self, schedule_entry: ScheduleEntry) -> LocationRegistry:
        """Load location data from schedule-specific CSV file."""
        data_path = Path(__file__).parent.parent / 'data' / schedule_entry.file
        df = pd.read_csv(data_path)
        
        registry = LocationRegistry()
        for _, row in df.iterrows():
            location = Location(
                name=row['name'],
                coordinates=(row['latitude'], row['longitude']),
                wco_amount=row['wco_amount'],
                disposal_schedule=row['disposal_schedule']
            )

            registry.add(location)
        
        return registry

    def save_analysis_results(self, config: Config, cvrp: CVRP, results: List[RouteAnalysisResult], collection_tracker: TripCollection):
        """Save analysis results to files, organizing by schedule and day."""
        # Group results by base schedule
        schedule_groups: dict[str, list[RouteAnalysisResult]] = {}
        for analysis in results:
            base_id = analysis.base_schedule_id
            if base_id not in schedule_groups:
                schedule_groups[base_id] = []
            schedule_groups[base_id].append(analysis)

        output_path = self.create_output_directory()
        
        # Process each schedule group
        for base_id, schedule_results in schedule_groups.items():
            # Create schedule directory
            schedule_dir = output_path / base_id
            schedule_dir.mkdir(exist_ok=True)
            
            print(f"\nProcessing results for schedule {base_id}:")
            
            # Save each day's results
            for analysis in sorted(schedule_results, key=lambda x: x.collection_day):
                day = analysis.collection_day
                print(f"  Saving day {day} results...")
                
                # Create visualization
                visualizer = RouteVisualizer(
                    center_coordinates=config.map.center,
                    api_key=self.api_key
                )
                visualizer.add_routes(analysis)
                
                # Save visualization and data
                visualizer.save(schedule_dir / f"routes_day{day}.html", analysis)
                with open(schedule_dir / f"analysis_day{day}.json", 'w') as f:
                    json.dump(analysis, f, indent=2, cls=DateTimeEncoder)

            # Create schedule summary
            summary = {
                'schedule_id': base_id,
                'total_days': len(schedule_results),
                'days': [day.collection_day for day in schedule_results],
                'total_locations': sum(day.total_locations for day in schedule_results),
                'total_distance': sum(day.total_distance for day in schedule_results),
                'total_collected': sum(day.total_collected for day in schedule_results)
            }
            
            with open(schedule_dir / 'schedule_summary.json', 'w') as f:
                json.dump(summary, f, indent=2)
            
            print(f"  Summary: {len(schedule_results)} days, {summary['total_locations']} locations")
        
        # Print daily summaries
        print("\nDaily Route Summaries:")
        cvrp.print_daily_summaries(collection_tracker)

    def run(self):
        args = self.parse_args()
        
        if args.api:
            print(f"Starting API server on port {args.port}...")
            start_api_server(port=args.port)
            return

        if not self.api_key:
            print("Warning: ORS_API_KEY environment variable not set")
            return

        config = self.load_config()
        solver_class = SOLVERS[args.solver]
        print(f"Using {args.solver} solver")

        # Update vehicle creation to include depot_location
        vehicles = [
            Vehicle(
                id=vehicle_config.id,
                capacity=vehicle_config.capacity,
                depot_location=config.settings.depot_location
            )
            for vehicle_config in config.settings.vehicles
        ]

        # Load all schedule data
        locations = ScheduleLoader.load_all_schedules(
            config.schedules,
            self.data_path
        )

        # Initialize CVRP solver
        cvrp = CVRP(
            vehicles=vehicles,
            solver_class=solver_class,
            constraints=config.settings.constraints,
            max_daily_time=config.settings.max_daily_time,
        )

        try:
            # Process schedules independently
            results, collection_tracker = cvrp.process(
                schedule_entries=config.schedules,
                locations=locations,
                speed_kph=config.settings.average_speed_kph
            )
            
            # Save results
            self.save_analysis_results(config, cvrp, results, collection_tracker)
        except Exception as e:
            print(f"Error processing schedules: {e}")
            traceback.print_exc()

def main():
    system = CvrpSystem()
    system.run()

if __name__ == "__main__":
    main()
