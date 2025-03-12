import folium
import openrouteservice as ors
from openrouteservice.directions import directions
from typing import List, Tuple, Dict, Any
from models.route_data import RouteAnalysisResult, RoutePathInfo, StopInfo
import os
from folium import plugins

class RouteVisualizer:
    """Visualizes vehicle routes on a map using OpenRouteService for actual road networks."""
    
    # List of contrasting colors for better route visualization
    colors = [
        '#1f77b4',  # blue
        '#ff7f0e',  # orange
        '#2ca02c',  # green
        '#d62728',  # red
        '#9467bd',  # purple
        '#8c564b',  # brown
        '#e377c2',  # pink
        '#7f7f7f',  # gray
        '#bcbd22',  # yellow-green
        '#17becf',  # cyan
    ]

    def __init__(self, center_coordinates: Tuple[float, float], api_key: str = None):
        """
        Initialize the visualizer.
        
        Args:
            center_coordinates: (latitude, longitude) of the map center
            api_key: OpenRouteService API key, defaults to env variable ORS_API_KEY
        """
        self.center = center_coordinates
        self.map = folium.Map(location=center_coordinates, zoom_start=13)
        self.colors = ['red', 'blue', 'green', 'purple', 'orange', 'darkred']
        self.client = ors.Client(key=api_key or os.getenv('ORS_API_KEY'), base_url='http://localhost:8080/ors')
        # Store the computed road paths
        self.computed_paths = {}

    def _get_route_coordinates(self, start_coords: Tuple[float, float], 
                             end_coords: Tuple[float, float]) -> List[List[float]]:
        """Get the actual road route between two points using OpenRouteService."""
        try:
            coords = [[start_coords[1], start_coords[0]], 
                     [end_coords[1], end_coords[0]]]  # ORS uses [long, lat]
            route = directions(
                client=self.client,
                coordinates=coords,
                profile='driving-hgv',
                format='geojson',
                optimize_waypoints=True
            )
            return route['features'][0]['geometry']['coordinates']
        except Exception as e:
            print(f"Error getting route: {e}")
            # Fallback to straight line if routing fails
            return coords

    def add_routes(self, analysis: RouteAnalysisResult):
        """Add routes to the map with enhanced information display."""
        for vehicle_route_idx, route_info in enumerate(analysis.vehicle_routes):
            color = self.colors[vehicle_route_idx % len(self.colors)]
            stops = route_info.stops
            
            # Create combined route paths
            combined_paths: List[RoutePathInfo] = []
            trip_paths: Dict[int, List[RoutePathInfo]] = {}
            
            # Group stops by trip
            trip_stops: Dict[int, List[StopInfo]] = {}
            for stop in stops:
                if stop.trip_number not in trip_stops:
                    trip_stops[stop.trip_number] = []
                trip_stops[stop.trip_number].append(stop)
            
            # Process each trip separately
            for trip_number, trip_stop_list in trip_stops.items():
                trip_paths[trip_number] = []
                
                # Add depot to start of trip
                route_coords = [self.center] + [stop.coordinates for stop in trip_stop_list] + [self.center]
                
                # Generate paths for this trip
                for i in range(len(route_coords) - 1):
                    road_coords = self._get_route_coordinates(route_coords[i], route_coords[i + 1])
                    path_coords = [[coord[1], coord[0]] for coord in road_coords]
                    
                    path_info = RoutePathInfo(
                        from_coords=route_coords[i],
                        to_coords=route_coords[i + 1],
                        path=path_coords,
                        trip_number=trip_number
                    )
                    
                    trip_paths[trip_number].append(path_info)
                    combined_paths.append(path_info)
                    
                    # Add to map visualization
                    folium.PolyLine(
                        locations=path_coords,
                        color=color,
                        weight=2,
                        opacity=0.8,
                        popup=f'Vehicle {route_info.vehicle_id} - Trip {trip_number}'
                    ).add_to(self.map)
            
            # Store paths in route info
            route_info.combined_path = combined_paths
            route_info.trip_paths = trip_paths

        # Initialize computed paths for this analysis
        self.computed_paths[analysis.schedule_id] = {}
        
        for vehicle_route_idx, route_info in enumerate(analysis.vehicle_routes):
            color = self.colors[vehicle_route_idx % len(self.colors)]
            stops = route_info.stops
            
            # Create route coordinates list including depot at start/end
            route_coords = [self.center]  # Start at depot
            route_coords.extend(stop.coordinates for stop in stops)
            route_coords.append(self.center)  # End at depot
            
            # Initialize path coordinates for this vehicle
            vehicle_path_coords = []
            
            # Add markers for each stop
            for i, coords in enumerate(route_coords):
                if i == 0 or i == len(route_coords) - 1:  # Depot
                    html = f"""
                        <div style='font-family: Arial'>
                            <b>Depot - Vehicle {route_info.vehicle_id}</b><br>
                            Coordinates: {coords[0]:.6f}, {coords[1]:.6f}<br>
                            Total Distance: {route_info.total_distance:.2f} km<br>
                            Total Capacity: {route_info.capacity:.2f}L<br>
                            Initial Load: 0.00L
                        </div>
                    """
                else:
                    stop = stops[i-1]  # Adjust for depot offset
                    capacity_used = (stop.cumulative_load / route_info.capacity * 100)
                    capacity_color = (
                        'green' if capacity_used < 60 else
                        'orange' if capacity_used < 90 else
                        'red'
                    )
                    
                    html = f"""
                        <div style='font-family: Arial'>
                            <b>Stop {stop.sequence_number} - {stop.name}</b><br>
                            Trip: #{stop.trip_number}<br>
                            Distance from depot: {stop.distance_from_depot:.2f} km<br>
                            WCO Collected: {stop.wco_amount:.2f}L<br>
                            <div style='color: {capacity_color}'>
                                Vehicle Load: {stop.cumulative_load:.2f}L / {route_info.capacity:.2f}L
                                ({capacity_used:.2f}%)
                            </div>
                            <div style='background: #f0f0f0; padding: 5px; margin-top: 5px;'>
                                Remaining Capacity: {stop.remaining_capacity:.2f}L
                            </div>
                        </div>
                    """
                    
                folium.Marker(
                    coords,
                    popup=folium.Popup(html, max_width=300),
                    icon=folium.Icon(color=color, 
                                   icon='home' if i == 0 or i == len(route_coords) - 1 else 'info-sign')
                ).add_to(self.map)

            # Draw route lines following actual roads
            for i in range(len(route_coords) - 1):
                road_coords = self._get_route_coordinates(route_coords[i], route_coords[i + 1])
                path_coords = [[coord[1], coord[0]] for coord in road_coords]
                vehicle_path_coords.append({
                    'from_idx': i,
                    'to_idx': i + 1,
                    'from_coords': route_coords[i],
                    'to_coords': route_coords[i + 1],
                    'path': path_coords
                })
                
                folium.PolyLine(
                    locations=path_coords,
                    color=color,
                    weight=2,
                    opacity=0.8,
                    popup=f'Vehicle {route_info.vehicle_id} - Segment {i}'
                ).add_to(self.map)

                plugins.AntPath(
                    locations=path_coords,
                    color=color,
                    weight=2,
                    opacity=0.6,
                ).add_to(self.map)
                
            # Store the computed paths for this vehicle
            self.computed_paths[analysis.schedule_id][route_info.vehicle_id] = vehicle_path_coords

        # Fit bounds to show all markers
        if analysis.vehicle_routes:
            all_coords = []
            for route in analysis.vehicle_routes:
                all_coords.extend(stop.coordinates for stop in route.stops)
            
            if all_coords:
                self.map.fit_bounds([[min(lat for lat, _ in all_coords), 
                                    min(lon for _, lon in all_coords)],
                                   [max(lat for lat, _ in all_coords), 
                                    max(lon for _, lon in all_coords)]])

    def save(self, filename: str):
        """Save the map and route data in multiple formats."""
        # Convert Path object to string if needed
        filename = str(filename)
        
        # Save HTML map
        self.map.save(filename)
        
        # Save as TXT and JSON (without .html extension)
        base_filename = filename.rsplit('.', 1)[0]
        self._save_text_summary(f"{base_filename}.txt")
        self._save_json_summary(f"{base_filename}.json")
        
    def _save_text_summary(self, filename: str):
        """Save route summary in plain text format."""
        with open(filename, 'w', encoding='utf-8') as f:
            for schedule_id, vehicle_routes in self.computed_paths.items():
                f.write(f"Schedule: {schedule_id}\n")
                f.write("=" * 50 + "\n\n")
                
                for vehicle_id, paths in vehicle_routes.items():
                    f.write(f"Vehicle {vehicle_id}:\n")
                    f.write("-" * 30 + "\n")
                    
                    current_trip = 1
                    for path in paths:
                        if path.get('trip_number', 1) != current_trip:
                            current_trip = path['trip_number']
                            f.write(f"\nTrip #{current_trip}:\n")
                            
                        from_lat, from_lon = path['from_coords']
                        to_lat, to_lon = path['to_coords']
                        f.write(f"• From: ({from_lat:.6f}, {from_lon:.6f})\n")
                        f.write(f"  To: ({to_lat:.6f}, {to_lon:.6f})\n")
                    f.write("\n")
                f.write("\n")

    def _save_json_summary(self, filename: str):
        """Save route summary in JSON format."""
        import json
        
        # Convert coordinates to serializable format
        json_data = {}
        for schedule_id, vehicle_routes in self.computed_paths.items():
            json_data[schedule_id] = {}
            for vehicle_id, paths in vehicle_routes.items():
                json_data[schedule_id][vehicle_id] = [
                    {
                        'from_coords': list(path['from_coords']),
                        'to_coords': list(path['to_coords']),
                        'path': path['path'],
                        'trip_number': path.get('trip_number', 1)
                    }
                    for path in paths
                ]
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2)
        
    def get_computed_paths(self) -> Dict[str, Dict[str, List[Dict[str, Any]]]]:
        """Return the computed road paths for all routes."""
        return self.computed_paths
