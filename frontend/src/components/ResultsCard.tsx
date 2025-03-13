import { RouteResponse, StopInfo } from '../types/models';
import { useFilterStore } from '../stores/filterStore';
import { useState } from 'react';

interface ResultsCardProps {
  routes: RouteResponse[];
}

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export default function ResultsCard({ routes }: ResultsCardProps) {
  const {
    activeVehicles,
    activeTrips,
    activeDay,
    setActiveVehicles,
    setActiveTrips,
    setActiveDay
  } = useFilterStore();

  const [expandedTrips, setExpandedTrips] = useState<Set<number>>(new Set());

  if (!routes || routes.length === 0 || !activeDay) return null;

  const currentRoute = routes.find(r => r.collection_day === activeDay);
  if (!currentRoute) return null;

  const toggleVehicle = (vehicleId: string) => {
    const newVehicles = new Set(activeVehicles);
    if (newVehicles.has(vehicleId)) {
      newVehicles.delete(vehicleId);
    } else {
      newVehicles.add(vehicleId);
    }
    setActiveVehicles(newVehicles);
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
    const trips = new Set<number>();
    if (activeTrips.size === 0) {
      // Add all trips
      route.vehicle_routes.forEach(vr => {
        vr.stops.forEach(stop => {
          trips.add(stop.trip_number);
        });
      });
    }
    setActiveTrips(trips);
  };

  const toggleTripExpansion = (tripNumber: number) => {
    const newExpanded = new Set(expandedTrips);
    if (newExpanded.has(tripNumber)) {
      newExpanded.delete(tripNumber);
    } else {
      newExpanded.add(tripNumber);
    }
    setExpandedTrips(newExpanded);
  };

  // Group stops by trip number
  const getTripStops = (stops: StopInfo[]) => {
    const tripMap = new Map();
    stops.forEach(stop => {
      if (!tripMap.has(stop.trip_number)) {
        tripMap.set(stop.trip_number, []);
      }
      tripMap.get(stop.trip_number).push(stop);
    });
    return tripMap;
  };

  return (
    <div className="bg-white/95 backdrop-blur-md shadow-lg rounded-xl h-[calc(100vh-2rem)] flex flex-col overflow-hidden text-sm border border-gray-200/50">
      {/* Day Selection */}
      <div className="px-3 py-2.5 border-b border-gray-50/80 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex gap-1.5">
          {routes.map(route => (
            <button
              key={route.collection_day}
              onClick={() => setActiveDay(route.collection_day)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeDay === route.collection_day
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600 ring-offset-2'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:shadow-sm'
              }`}
            >
              Day {route.collection_day}
            </button>
          ))}
        </div>
      </div>

      {/* Route Stats */}
      <div className="px-3 py-2.5 border-b border-gray-50/80 bg-gray-50/80">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-medium text-gray-900">Route Summary</h2>
          <span className="text-xs text-gray-500">Day {currentRoute.collection_day}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100">
            <div className="flex flex-col">
              <span className="text-gray-500 mb-0.5">Total Stops</span>
              <span className="font-semibold text-gray-900">{currentRoute.total_stops}</span>
            </div>
          </div>
          <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100">
            <div className="flex flex-col">
              <span className="text-gray-500 mb-0.5">Distance</span>
              <span className="font-semibold text-gray-900">{currentRoute.total_distance.toFixed(1)}km</span>
            </div>
          </div>
          <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100">
            <div className="flex flex-col">
              <span className="text-gray-500 mb-0.5">Duration</span>
              <span className="font-semibold text-gray-900">{formatDuration(currentRoute.total_travel_time)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Routes */}
      <div className="flex-1 overflow-y-auto bg-gray-50/50 p-2 space-y-2">
        {currentRoute.vehicle_routes.map((vr) => (
          <div key={vr.vehicle_id} 
               className={`rounded-lg bg-white shadow-sm transition-all ${
                 activeVehicles.has(vr.vehicle_id) ? 'ring-2 ring-blue-100' : ''
               }`}>
            <button
              onClick={() => toggleVehicle(vr.vehicle_id)}
              className="w-full text-left px-3 py-2 rounded-lg transition-colors hover:bg-gray-50"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${activeVehicles.has(vr.vehicle_id) ? 'bg-blue-500' : 'bg-gray-300'}`} />
                  <span className="font-medium text-gray-900">Vehicle {vr.vehicle_id}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {vr.efficiency.toFixed(1)}% efficient
                  </span>
                </div>
              </div>
            </button>

            {activeVehicles.has(vr.vehicle_id) && (
              <div className="px-3 py-2 border-t border-gray-100">
                <div className="flex justify-between items-center py-1.5 mb-2">
                  <span className="text-xs font-medium text-gray-700">Trip Routes</span>
                  <button
                    onClick={() => toggleAllTrips(currentRoute)}
                    className="text-xs px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all"
                  >
                    Toggle All
                  </button>
                </div>
                <div className="space-y-1">
                  {Array.from(getTripStops(vr.stops)).map(([tripNumber, stops]) => (
                    <div key={tripNumber} className="rounded-lg border border-gray-100">
                      <div className="flex items-center justify-between p-2">
                        <button
                          onClick={() => toggleTripExpansion(+tripNumber)}
                          className="flex items-center gap-2 flex-1"
                        >
                          <svg
                            className={`w-3.5 h-3.5 text-gray-500 transition-transform ${
                              expandedTrips.has(+tripNumber) ? 'rotate-90' : ''
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">Trip #{tripNumber}</span>
                            <span className="text-[10px] text-gray-500">{stops.length} stops</span>
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={activeTrips.has(+tripNumber)}
                            onChange={() => toggleTrip(+tripNumber)}
                            className="h-3.5 w-3.5 rounded text-blue-500 focus:ring-blue-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      
                      {expandedTrips.has(+tripNumber) && (
                        <div className="border-t border-gray-100 divide-y divide-gray-50">
                          {stops.map((stop: StopInfo) => (
                            <div
                              key={stop.sequence_number}
                              className="p-2 hover:bg-gray-50/50"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-medium border border-blue-100">
                                  {stop.sequence_number}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 text-xs truncate">
                                    {stop.name}
                                  </div>
                                  <div className="text-[10px] text-gray-500">
                                    Collection: {stop.wco_amount}L
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
