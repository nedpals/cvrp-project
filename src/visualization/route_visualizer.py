import folium
import openrouteservice as ors
from openrouteservice.directions import directions
from typing import List, Tuple, Dict, Any
from models.route_data import RouteAnalysisResult, RoutePathInfo, StopInfo, VehicleRouteInfo
import os
from folium import plugins
from utils import calculate_distance

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

    def __init__(self, center_coordinates: Tuple[float, float], api_key: str = None, ors_base_url: str = None):
        """
        Initialize the visualizer.
        
        Args:
            center_coordinates: (latitude, longitude) of the map center
            api_key: OpenRouteService API key, defaults to env variable ORS_API_KEY
        """
        if api_key is None:
            api_key = os.environ.get('ORS_API_KEY', None)

        if ors_base_url is None:
            ors_base_url = os.environ.get('ORS_BASE_URL', 'http://localhost:8080/ors')

        self.center = center_coordinates
        self.map = folium.Map(location=center_coordinates, zoom_start=13)
        self.colors = ['red', 'blue', 'green', 'purple', 'orange', 'darkred']
        self.client = ors.Client(key=api_key, base_url=ors_base_url)
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
        """Add routes to the map with enhanced multi-day information display."""
        # Add day marker as a custom div
        folium.Element(f"""
            <div id="day-info-{analysis.collection_day}" 
                 style="position: fixed; top: 20px; left: 20px; z-index: 1000; 
                        background: white; padding: 10px; border-radius: 4px; 
                        border: 2px solid #666;">
                <b>Collection Day {analysis.collection_day}</b><br>
                Total Locations: {analysis.total_locations}<br>
                Total Distance: {analysis.total_distance:.2f} km<br>
                Total Collected: {analysis.total_collected:.2f}L
            </div>
        """).add_to(self.map)
        
        # Add route legend as a custom div
        folium.Element(f"""
            <div id="legend-{analysis.schedule_id}" 
                 style="position: fixed; bottom: 50px; right: 20px; 
                        background: white; padding: 10px; border: 2px solid #666; 
                        border-radius: 5px; z-index: 1000;">
                <h4 style="margin: 0 0 10px 0;">Day {analysis.collection_day}</h4>
                <div style="font-size: 12px;">
                    <b>Schedule:</b> {analysis.schedule_name}<br>
                    <b>Locations:</b> {analysis.total_locations}<br>
                    <b>Total WCO:</b> {analysis.total_collected:.2f}L<br>
                    <b>Distance:</b> {analysis.total_distance:.2f} km
                </div>
            </div>
        """).add_to(self.map)

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
                
                # Add depot markers
                self._add_trip_depot_markers(
                    route_info, trip_number, color, 
                    trip_stop_list[0].coordinates if trip_stop_list else self.center
                )
                
                # Add route paths and stop markers
                trip_paths[trip_number] = self._add_trip_route(
                    trip_number, trip_stop_list, route_info, color
                )
                combined_paths.extend(trip_paths[trip_number])
            
            # Store paths in route info
            route_info.trip_paths = trip_paths
            
            # Store computed paths for this analysis
            if analysis.schedule_id not in self.computed_paths:
                self.computed_paths[analysis.schedule_id] = {}
            self.computed_paths[analysis.schedule_id][route_info.vehicle_id] = [
                self._convert_path_to_dict(path) for path in combined_paths
            ]

        # Fit bounds to show all markers
        self._fit_bounds_to_markers(analysis)

    def _add_trip_depot_markers(self, route_info: VehicleRouteInfo, trip_number: int, 
                              color: str, first_stop_coords: Tuple[float, float]):
        """Add depot markers for trip start/end with enhanced info."""
        depot_html = f"""
            <div style='font-family: Arial'>
                <b>Depot - Vehicle {route_info.vehicle_id}</b><br>
                Trip #{trip_number}<br>
                Distance to first stop: {calculate_distance(self.center, first_stop_coords):.2f} km<br>
                Vehicle Capacity: {route_info.capacity:.2f}L
            </div>
        """
        
        for is_end in [False, True]:
            marker = folium.Marker(
                location=self.center,
                icon=folium.Icon(
                    color=color,
                    icon='home' if not is_end else 'flag',
                    prefix='fa'
                )
            )
            marker.add_to(self.map)
            # Add popup separately
            folium.Popup(depot_html, max_width=300).add_to(marker)

    def _add_trip_route(self, trip_number: int, stops: List[StopInfo], 
                       route_info: VehicleRouteInfo, color: str) -> List[RoutePathInfo]:
        """Add route visualization for a single trip."""
        paths = []
        route_coords = [self.center] + [stop.coordinates for stop in stops] + [self.center]
        
        # Add stop markers with enhanced information
        for i, stop in enumerate(stops):
            capacity_used = (stop.cumulative_load / route_info.capacity * 100)
            capacity_color = self._get_capacity_color(capacity_used)
            
            stop_html = self._create_stop_popup_html(
                stop, route_info.capacity, capacity_used, capacity_color, trip_number
            )
            
            marker = folium.Marker(
                location=stop.coordinates,
                icon=folium.Icon(color=color, icon='info-sign')
            )
            marker.add_to(self.map)
            # Add popup separately
            folium.Popup(stop_html, max_width=300).add_to(marker)

        # Add route lines
        for i in range(len(route_coords) - 1):
            path = self._create_route_path(
                route_coords[i], route_coords[i + 1], 
                color, route_info.vehicle_id, trip_number
            )
            paths.append(path)

        return paths

    def _create_stop_popup_html(self, stop: StopInfo, vehicle_capacity: float, 
                              capacity_used: float, capacity_color: str, 
                              trip_number: int) -> str:
        """Create enhanced HTML popup content for stops."""
        return f"""
            <div style='font-family: Arial'>
                <h4 style='margin: 4px 0;'>{stop.name}</h4>
                <div style='background: #f5f5f5; padding: 6px; border-radius: 4px; margin: 4px 0;'>
                    <b>Stop #{stop.sequence_number + 1}</b> (Trip #{trip_number})<br>
                    Distance from depot: {stop.distance_from_depot:.2f} km<br>
                    Distance from prev: {stop.distance_from_prev:.2f} km
                </div>
                <div style='margin: 8px 0;'>
                    <b>Collection:</b> {stop.wco_amount:.2f}L<br>
                    <div style='color: {capacity_color}'>
                        Load: {stop.cumulative_load:.2f}L / {vehicle_capacity:.2f}L<br>
                        ({capacity_used:.1f}%)
                    </div>
                </div>
                <div style='background: #e8f4ff; padding: 6px; border-radius: 4px;'>
                    Remaining: {stop.remaining_capacity:.2f}L
                </div>
            </div>
        """

    def _create_route_path(self, from_coords: Tuple[float, float], to_coords: Tuple[float, float], 
                         color: str, vehicle_id: str, trip_number: int) -> RoutePathInfo:
        """Create route path between two coordinates."""
        road_coords = self._get_route_coordinates(from_coords, to_coords)
        path_coords = [[coord[1], coord[0]] for coord in road_coords]
        
        path_info = RoutePathInfo(
            from_coords=from_coords,
            to_coords=to_coords,
            path=path_coords,
            trip_number=trip_number
        )
        
        folium.PolyLine(
            locations=path_coords,
            color=color,
            weight=2,
            opacity=0.8,
            popup=f'Vehicle {vehicle_id} - Trip {trip_number}'
        ).add_to(self.map)
        
        plugins.AntPath(
            locations=path_coords,
            color=color,
            weight=2,
            opacity=0.6,
        ).add_to(self.map)
        
        return path_info

    def _get_capacity_color(self, capacity_used: float) -> str:
        """Get color based on capacity utilization."""
        if capacity_used < 60:
            return '#28a745'  # green
        elif capacity_used < 90:
            return '#ffc107'  # yellow
        else:
            return '#dc3545'  # red

    def _convert_path_to_dict(self, path: RoutePathInfo) -> dict:
        """Convert RoutePathInfo to serializable dictionary."""
        return {
            'from_coords': list(path.from_coords),
            'to_coords': list(path.to_coords),
            'path': path.path,
            'trip_number': path.trip_number,
            'travel_time_minutes': path.travel_time_minutes
        }

    def _fit_bounds_to_markers(self, analysis: RouteAnalysisResult):
        """Fit map bounds to show all markers."""
        if analysis.vehicle_routes:
            all_coords = []
            for route in analysis.vehicle_routes:
                all_coords.extend(stop.coordinates for stop in route.stops)
                all_coords.append(self.center)  # Include depot
            
            if all_coords:
                self.map.fit_bounds([
                    [min(lat for lat, _ in all_coords), min(lon for _, lon in all_coords)],
                    [max(lat for lat, _ in all_coords), max(lon for _, lon in all_coords)]
                ])

    def save(self, filename: str, analysis: RouteAnalysisResult):
        """Save the map and route data in multiple formats."""
        # Convert Path object to string if needed
        filename = str(filename)
        
        # Save HTML map
        self.map.save(filename)
        
        # Save as TXT and JSON (without .html extension)
        base_filename = filename.rsplit('.', 1)[0]
        self._save_text_summary(f"{base_filename}.txt", analysis)
        self._save_json_summary(f"{base_filename}.json")
        
    def _save_text_summary(self, filename: str, analysis: RouteAnalysisResult):
        """Save route summary in plain text format with aggregated statistics."""
        with open(filename, 'w', encoding='utf-8') as f:
            for schedule_id, vehicle_routes in self.computed_paths.items():
                # Initialize counters
                total_trips = set()
                total_stops = 0
                total_distance = 0.0
                total_collected = 0.0

                # Calculate totals from vehicle routes
                for route_info in analysis.vehicle_routes:
                    # Add all trip numbers to set
                    total_trips.update(stop.trip_number for stop in route_info.stops)
                    # Count stops
                    total_stops += len(route_info.stops)
                    # Sum up distance
                    total_distance += route_info.total_distance
                    # Sum up collected WCO
                    total_collected += sum(stop.wco_amount for stop in route_info.stops)

                # Write summary in requested format
                f.write(f"Schedule: {schedule_id}\n")
                f.write(f"Total Trips: {len(total_trips)}\n")
                f.write(f"Total Stops: {total_stops}\n")
                f.write(f"Total Distance: {total_distance:.2f} km\n")
                f.write(f"Total Collected: {total_collected:.2f} L\n")

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
