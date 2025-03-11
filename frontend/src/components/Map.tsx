import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.awesome-markers/dist/leaflet.awesome-markers.css';
import { Location, RouteResponse, Coordinates, StopInfo, VehicleRouteInfo } from '../types/models';
import { createDepotMarker, createLocationMarker } from '../utils/mapIcons';
import RoutePathLayer from './RoutePathLayer';

interface MapConfig {
    zoom_level: number;
    path_weight: number;
    path_opacity: number;
}

interface MapProps {
    locations: Location[];
    center: Coordinates;
    depotLocation: Coordinates;
    routes?: RouteResponse[];
    config: MapConfig;
}

const VEHICLE_COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

export default function Map({ locations, center, depotLocation, routes, config }: MapProps) {
    const getVehicleColor = (vehicleIndex: number) => VEHICLE_COLORS[vehicleIndex % VEHICLE_COLORS.length];

    return (
        <MapContainer
            center={center}
            zoom={config.zoom_level}
            className="h-full w-full z-0"
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {/* Depot Marker */}
            <Marker 
                position={depotLocation}
                icon={createDepotMarker()}
            >
                <Popup>
                    {routes?.map((route) => (
                        route.vehicle_routes.map((vr, idx) => (
                            <div 
                                key={`depot-popup-${vr.vehicle_id}`} 
                                className="font-sans mb-2"
                                style={{ borderLeft: `4px solid ${getVehicleColor(idx)}` }}
                            >
                                <div className="font-bold pl-2">Vehicle {vr.vehicle_id}</div>
                                <div className="pl-2">Total Distance: {vr.total_distance.toFixed(2)} km</div>
                                <div className="pl-2">Total Capacity: {vr.capacity.toFixed(2)}L</div>
                            </div>
                        ))
                    ))}
                    {!routes && <div>Depot</div>}
                </Popup>
            </Marker>

            {/* Location Markers */}
            {locations.map((loc) => {
                const findStopAndVehicleInfo = (): [StopInfo | null, VehicleRouteInfo | null, number] => {
                    if (!routes) return [null, null, -1];
                    
                    let stopInfo = null;
                    let vehicleInfo = null;
                    let vehicleIndex = -1;
                    
                    routes.forEach(route => {
                        route.vehicle_routes.forEach((vr, idx) => {
                            vr.stops.forEach(stop => {
                                if (stop.name === loc.name || 
                                    (stop.coordinates[0] === loc.coordinates[0] && 
                                     stop.coordinates[1] === loc.coordinates[1])) {
                                    stopInfo = stop;
                                    vehicleInfo = vr;
                                    vehicleIndex = idx;
                                }
                            });
                        });
                    });
                    
                    return [stopInfo, vehicleInfo, vehicleIndex];
                };

                const [stopInfo, vehicleInfo, vehicleIndex] = findStopAndVehicleInfo();

                return (
                    <Marker
                        key={`location-${loc.id}-${loc.coordinates[0]}-${loc.coordinates[1]}-${loc.wco_amount}`}
                        position={loc.coordinates}
                        icon={createLocationMarker(stopInfo && vehicleIndex >= 0 ? getVehicleColor(vehicleIndex) : 'gray')}
                    >
                        <Popup>
                            {stopInfo && vehicleInfo ? (
                                <div className="font-sans" style={{ borderLeft: `4px solid ${getVehicleColor(vehicleIndex)}` }}>
                                    <div className="font-bold">Stop {stopInfo.sequence_number} - {loc.name}</div>
                                    <div>Trip: #{stopInfo.trip_number}</div>
                                    <div>Distance from depot: {stopInfo.distance_from_depot.toFixed(2)} km</div>
                                    <div>WCO Collected: {stopInfo.wco_amount.toFixed(2)}L</div>
                                    
                                    {/* Capacity usage with color coding */}
                                    {(() => {
                                        const capacityUsed = (stopInfo.cumulative_load / vehicleInfo.capacity) * 100;
                                        const capacityColor = 
                                            capacityUsed < 60 ? 'text-green-600' : 
                                            capacityUsed < 90 ? 'text-orange-500' : 
                                            'text-red-600';
                                        
                                        return (
                                            <div className={capacityColor}>
                                                Vehicle Load: {stopInfo.cumulative_load.toFixed(2)}L / {vehicleInfo.capacity.toFixed(2)}L
                                                ({capacityUsed.toFixed(2)}%)
                                            </div>
                                        );
                                    })()}
                                    
                                    <div className="bg-gray-100 p-1 mt-1 rounded">
                                        Remaining Capacity: {stopInfo.remaining_capacity.toFixed(2)}L
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <h3 className="font-bold">{loc.name}</h3>
                                    <p>WCO: {loc.wco_amount}L</p>
                                </div>
                            )}
                        </Popup>
                    </Marker>
                );
            })}

            {/* Route Paths */}
            {routes?.map(route => 
                route.vehicle_routes.map((vr, idx) => (
                    <RoutePathLayer
                        key={`${route.schedule_id}-${vr.vehicle_id}`}
                        vehicleRoute={vr}
                        color={getVehicleColor(idx)}
                    />
                ))
            )}
        </MapContainer>
    );
}
