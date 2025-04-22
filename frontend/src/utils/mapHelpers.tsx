import { Location, RouteResponse, StopInfo, VehicleRouteInfo } from '../types/models';

const VEHICLE_COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

export const getVehicleColor = (vehicleIndex: number) => 
    VEHICLE_COLORS[vehicleIndex % VEHICLE_COLORS.length];

export const findStopAndVehicleInfo = (
    loc: Location, 
    routes?: RouteResponse[]
): [StopInfo | null, VehicleRouteInfo | null, number] => {
    if (!routes) return [null, null, -1];
    
    let stopInfo = null;
    let vehicleInfo = null;
    let vehicleIndex = -1;
    
    routes.forEach(route => {
        route.trips.forEach(trip => {
            trip.vehicle_routes.forEach((vr, idx) => {
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
    });
    
    return [stopInfo, vehicleInfo, vehicleIndex];
};

export const createLocationPopup = (
    loc: Location, 
    stopInfo: StopInfo | null, 
    vehicleInfo: VehicleRouteInfo | null, 
    vehicleIndex: number
) => {
    if (!stopInfo || !vehicleInfo) {
        return (
            <div>
                <h3 className="font-bold">{loc.name}</h3>
                <p>WCO: {loc.wco_amount}L</p>
            </div>
        );
    }

    const capacityUsed = (stopInfo.cumulative_load / vehicleInfo.capacity) * 100;
    const capacityColor = 
        capacityUsed < 60 ? 'text-green-600' : 
        capacityUsed < 90 ? 'text-orange-500' : 
        'text-red-600';

    return (
        <div className="font-sans" style={{ borderLeft: `4px solid ${getVehicleColor(vehicleIndex)}` }}>
            <div className="font-bold">Stop {stopInfo.sequence_number} - {loc.name}</div>
            <div>Trip: #{stopInfo.trip_number}</div>
            <div>Distance from depot: {stopInfo.distance_from_depot.toFixed(2)} km</div>
            <div>WCO Collected: {stopInfo.wco_amount.toFixed(2)}L</div>
            <div className={capacityColor}>
                Vehicle Load: {stopInfo.cumulative_load.toFixed(2)}L / {vehicleInfo.capacity.toFixed(2)}L
                ({capacityUsed.toFixed(2)}%)
            </div>
            <div className="bg-gray-100 p-1 mt-1 rounded">
                Remaining Capacity: {stopInfo.remaining_capacity.toFixed(2)}L
            </div>
        </div>
    );
};

export const createDepotPopup = (route: { vehicle_routes: VehicleRouteInfo[] }) => {
    return (<>
        {route.vehicle_routes.map((vr, idx) => (
            <div 
                key={`depot-popup-${vr.vehicle_id}`} 
                className="font-sans mb-2"
                style={{ borderLeft: `4px solid ${getVehicleColor(idx)}` }}
            >
                <div className="font-bold pl-2">Vehicle {vr.vehicle_id}</div>
                <div className="pl-2">Total Distance: {vr.total_distance.toFixed(2)} km</div>
                <div className="pl-2">Total Capacity: {vr.capacity.toFixed(2)}L</div>
            </div>
        ))}
    </>);
};
