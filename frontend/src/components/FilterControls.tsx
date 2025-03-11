import React from 'react';
import { RouteResponse } from '../types/models';

interface FilterControlsProps {
    routes?: RouteResponse[];
    activeVehicles: Set<string>;
    activeTrips: Set<number>;
    onVehicleToggle: (vehicleId: string) => void;
    onTripToggle: (tripNumber: number) => void;
    onSelectAll: () => void;
    onClearAll: () => void;
}

export default function FilterControls({
    routes,
    activeVehicles,
    activeTrips,
    onVehicleToggle,
    onTripToggle,
    onSelectAll,
    onClearAll
}: FilterControlsProps) {
    if (!routes) return null;

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
                        onClick={onSelectAll}
                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Select All
                    </button>
                    <button
                        onClick={onClearAll}
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
                                    onClick={() => onVehicleToggle(vr.vehicle_id)}
                                    className={`px-2 py-1 text-xs rounded border ${
                                        activeVehicles.has(vr.vehicle_id)
                                            ? 'border-gray-600 bg-gray-100'
                                            : 'border-gray-300 bg-white'
                                    }`}
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
                    <div className="flex flex-wrap gap-2">
                        {Array.from(allTrips).sort((a, b) => a - b).map(tripNum => (
                            <button
                                key={tripNum}
                                onClick={() => onTripToggle(tripNum)}
                                className={`px-2 py-1 text-xs rounded border ${
                                    activeTrips.has(tripNum)
                                        ? 'border-gray-600 bg-gray-100'
                                        : 'border-gray-300 bg-white'
                                }`}
                            >
                                Trip #{tripNum}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
