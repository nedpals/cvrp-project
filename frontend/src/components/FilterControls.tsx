import { RouteResponse } from '../types/models';
import { useFilterStore } from '../stores/filterStore';
import { cn } from '../utils/utils';

interface FilterControlsProps {
    routes: RouteResponse[];
}

export default function FilterControls({ routes }: FilterControlsProps) {
    const {
        activeVehicles,
        activeTrips,
        setActiveVehicles,
        setActiveTrips,
    } = useFilterStore();

    if (!routes || routes.length === 0) return null;

    const toggleVehicle = (vehicleId: string) => {
        const newVehicles = new Set(activeVehicles);
        if (newVehicles.has(vehicleId)) {
            newVehicles.delete(vehicleId);
        } else {
            newVehicles.add(vehicleId);
        }
        setActiveVehicles(newVehicles);
    };

    const selectAll = (routes: RouteResponse[]) => {
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
    };

    const clearAll = () => {
        setActiveVehicles(new Set());
        setActiveTrips(new Set());
    };

    const toggleTrip = (tripNumber: number) => {
        const newTrips = new Set(activeTrips);
        if (newTrips.has(tripNumber)) {
            newTrips.delete(tripNumber);
        } else {
            newTrips.add(tripNumber);
        }
        setActiveTrips(newTrips);
    };

    const toggleAllTrips = (route: RouteResponse) => {
        const routeTrips = new Set<number>();
        route.vehicle_routes.forEach(vr => {
            vr.stops.forEach(stop => routeTrips.add(stop.trip_number));
        });

        // If all trips in this route are active, clear them. Otherwise, add all
        const allActive = Array.from(routeTrips).every(trip => activeTrips.has(trip));
        if (allActive) {
            const newTrips = new Set(activeTrips);
            routeTrips.forEach(trip => newTrips.delete(trip));
            setActiveTrips(newTrips);
        } else {
            const newTrips = new Set(activeTrips);
            routeTrips.forEach(trip => newTrips.add(trip));
            setActiveTrips(newTrips);
        }
    };

    const allTrips = new Set<number>();
    const vehicleColors: Record<string, string> = {};
    const COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

    routes.forEach(route => {
        route.vehicle_routes.forEach((vr, idx) => {
            vehicleColors[vr.vehicle_id] = COLORS[idx % COLORS.length];
            vr.stops.forEach(stop => {
                allTrips.add(stop.trip_number);
            });
        });
    });

    return (
        <div className="bg-white/95 backdrop-blur p-3 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Filters</h3>
                <div className="space-x-2">
                    <button
                        onClick={() => selectAll(routes)}
                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Select All
                    </button>
                    <button
                        onClick={clearAll}
                        className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                        Clear All
                    </button>
                </div>
            </div>
            
            <div className="space-y-4">
                {/* Vehicle filters */}
                <div>
                    <h4 className="text-sm font-medium mb-1">Vehicles</h4>
                    <div className="flex flex-wrap gap-2">
                        {routes.map(route => 
                            route.vehicle_routes.map(vr => (
                                <button
                                    key={vr.vehicle_id}
                                    onClick={() => toggleVehicle(vr.vehicle_id)}
                                    className={cn(
                                        'px-2 py-1 text-xs rounded border',
                                        activeVehicles.has(vr.vehicle_id)
                                            ? 'border-gray-600 bg-gray-100'
                                            : 'border-gray-300 bg-white'
                                    )}
                                    style={{
                                        borderLeftWidth: '4px',
                                        borderLeftColor: vehicleColors[vr.vehicle_id]
                                    }}
                                >
                                    Vehicle {vr.vehicle_id}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Trip filters */}
                <div>
                    <h4 className="text-sm font-medium mb-1">Trips</h4>
                    <div className="space-y-2">
                        {routes.map(route => {
                            const routeTrips = new Set<number>();
                            route.vehicle_routes.forEach(vr => {
                                vr.stops.forEach(stop => routeTrips.add(stop.trip_number));
                            });
                            const allSelected = Array.from(routeTrips).every(trip => activeTrips.has(trip));
                            
                            return (
                                <div key={route.schedule_id} className="space-y-2">
                                    <button
                                        onClick={() => toggleAllTrips(route)}
                                        className={cn(
                                            'text-xs px-2 py-1 rounded w-full',
                                            allSelected
                                                ? 'bg-blue-500 text-white hover:bg-blue-600'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        )}
                                    >
                                        {allSelected ? 'Clear All Trips' : 'Select All Trips'}
                                    </button>
                                    <div className="flex flex-wrap gap-2">
                                        {Array.from(routeTrips).sort((a, b) => a - b).map(tripNum => (
                                            <button
                                                key={tripNum}
                                                onClick={() => toggleTrip(tripNum)}
                                                className={cn(
                                                    'px-2 py-1 text-xs rounded',
                                                    activeTrips.has(tripNum)
                                                        ? 'bg-blue-500 text-white'
                                                        : 'border border-gray-300 bg-white hover:bg-gray-50'
                                                )}
                                            >
                                                Trip #{tripNum}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
