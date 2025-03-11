import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.awesome-markers/dist/leaflet.awesome-markers.css';
import { Location, RouteResponse, Coordinates, StopInfo, VehicleRouteInfo } from '../types/models';
import { createDepotMarker, createLocationMarker } from '../utils/mapIcons';
import FilterControls from './FilterControls';

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
    const [activeVehicles, setActiveVehicles] = useState<Set<string>>(new Set());
    const [activeTrips, setActiveTrips] = useState<Set<number>>(new Set());
    const [activeSchedule, setActiveSchedule] = useState<string | null>(null);
    
    // Initialize filters when routes change
    useEffect(() => {
        if (routes) {
            const vehicles = new Set<string>();
            const trips = new Set<number>();
            
            // Set the first schedule as active by default
            if (routes.length > 0 && !activeSchedule) {
                setActiveSchedule(routes[0].schedule_id);
            }

            // Only get vehicles and trips for active schedule
            routes.forEach(route => {
                if (activeSchedule === route.schedule_id) {
                    route.vehicle_routes.forEach(vr => {
                        vehicles.add(vr.vehicle_id);
                        vr.stops.forEach(stop => trips.add(stop.trip_number));
                    });
                }
            });
            
            setActiveVehicles(vehicles);
            setActiveTrips(trips);
        }
    }, [routes, activeSchedule]);

    const handleVehicleToggle = (vehicleId: string) => {
        setActiveVehicles(prev => {
            const next = new Set(prev);
            if (next.has(vehicleId)) {
                next.delete(vehicleId);
            } else {
                next.add(vehicleId);
            }
            return next;
        });
    };

    const handleTripToggle = (tripNumber: number) => {
        setActiveTrips(prev => {
            const next = new Set(prev);
            if (next.has(tripNumber)) {
                next.delete(tripNumber);
            } else {
                next.add(tripNumber);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        if (routes) {
            const vehicles = new Set<string>();
            const trips = new Set<number>();
            
            routes.forEach(route => {
                route.vehicle_routes.forEach(vr => {
                    vehicles.add(vr.vehicle_id);
                    vr.stops.forEach(stop => trips.add(stop.trip_number));
                });
            });
            
            setActiveVehicles(vehicles);
            setActiveTrips(trips);
        }
    };

    const handleClearAll = () => {
        setActiveVehicles(new Set());
        setActiveTrips(new Set());
    };

    const handleScheduleChange = (scheduleId: string) => {
        setActiveSchedule(scheduleId);
    };

    // Get the color for a specific vehicle
    const getVehicleColor = (vehicleIndex: number) => VEHICLE_COLORS[vehicleIndex % VEHICLE_COLORS.length];

    return (
        <>
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
                        {routes?.map((route) => {
                            if (activeSchedule && route.schedule_id !== activeSchedule) return null;
                            return route.vehicle_routes.map((vr, idx) => (
                                <div 
                                    key={`depot-popup-${vr.vehicle_id}`} 
                                    className="font-sans mb-2"
                                    style={{ borderLeft: `4px solid ${getVehicleColor(idx)}` }}
                                >
                                    <div className="font-bold pl-2">Vehicle {vr.vehicle_id}</div>
                                    <div className="pl-2">Total Distance: {vr.total_distance.toFixed(2)} km</div>
                                    <div className="pl-2">Total Capacity: {vr.capacity.toFixed(2)}L</div>
                                </div>
                            ));
                        })}
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

                    // Skip if this location's vehicle or trip is not active
                    if (stopInfo && vehicleInfo) {
                        const routeForStop = routes?.find(r => 
                            r.vehicle_routes.some(vr => vr.vehicle_id === vehicleInfo.vehicle_id)
                        );
                        if (routeForStop && routeForStop.schedule_id !== activeSchedule) {
                            return null;
                        }
                        if (!activeVehicles.has(vehicleInfo.vehicle_id) || 
                            !activeTrips.has(stopInfo.trip_number)) {
                            return null;
                        }
                    }

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

                {/* Route Lines - Only render if routes exist */}
                {routes?.map((route) => {
                    if (activeSchedule && route.schedule_id !== activeSchedule) return null;
                    return route.vehicle_routes.map((vr, idx) => {
                        if (!activeVehicles.has(vr.vehicle_id)) return null;

                        // Filter stops by active trips
                        const filteredStops = vr.stops.filter(stop => 
                            activeTrips.has(stop.trip_number)
                        );

                        if (filteredStops.length === 0) return null;

                        const color = getVehicleColor(idx);
                        
                        // Use road paths if available
                        if (vr.road_paths && vr.road_paths.length > 0) {
                            return vr.road_paths
                                .filter(path => {
                                    const fromStop = vr.stops[path.from_idx];
                                    const toStop = vr.stops[path.to_idx];
                                    return (!fromStop || activeTrips.has(fromStop.trip_number)) &&
                                           (!toStop || activeTrips.has(toStop.trip_number));
                                })
                                .map((path, pathIdx) => (
                                    <Polyline
                                        key={`${route.schedule_id}-${vr.vehicle_id}-path-${pathIdx}`}
                                        positions={path.path}
                                        color={color}
                                        weight={config.path_weight}
                                        opacity={config.path_opacity}
                                    />
                                ));
                        }
                        
                        // Fallback to direct lines
                        const coordinates = filteredStops.map(stop => stop.coordinates);
                        return (
                            <Polyline
                                key={`${route.schedule_id}-${vr.vehicle_id}`}
                                positions={[depotLocation, ...coordinates, depotLocation]}
                                color={color}
                                weight={config.path_weight}
                                opacity={config.path_opacity}
                            />
                        );
                    });
                })}
            </MapContainer>

            {/* Add FilterControls with Schedule selector */}
            <div className="absolute top-4 left-4 z-[1000] space-y-2">
                <div className="bg-white p-2 rounded shadow">
                    <select
                        value={activeSchedule || ''}
                        onChange={(e) => handleScheduleChange(e.target.value)}
                        className="w-full p-1 text-sm border rounded"
                    >
                        {routes?.map((route) => (
                            <option key={route.schedule_id} value={route.schedule_id}>
                                {route.schedule_name}
                            </option>
                        ))}
                    </select>
                </div>
                <FilterControls
                    routes={routes?.filter(r => r.schedule_id === activeSchedule)}
                    activeVehicles={activeVehicles}
                    activeTrips={activeTrips}
                    onVehicleToggle={handleVehicleToggle}
                    onTripToggle={handleTripToggle}
                    onSelectAll={handleSelectAll}
                    onClearAll={handleClearAll}
                />
            </div>
        </>
    );
}
