import { RouteResponse, StopInfo } from '../types/models';
import { useFilterStore } from '../stores/filterStore';
import { useConfigStore } from '../stores/configStore';
import { cn } from '../utils/utils';

interface ResultsCardProps {
  routes: RouteResponse[];
  onZoomToLocation: (coordinates: [number, number]) => void;
  onZoomToTrip: (stops: StopInfo[]) => void;
}

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export default function ResultsCard({ 
  routes, 
  onZoomToLocation
}: ResultsCardProps) {
  const {
    activeVehicles,
    activeTrip,
    setActiveVehicles,
    setActiveTrip,
  } = useFilterStore();
  const { depotLat, depotLng } = useConfigStore();

  if (!routes || routes.length === 0) return null;

  const currentRoute = routes[0];
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

  const getAllTrips = () => {
    const trips = new Set<number>();
    currentRoute?.vehicle_routes.forEach(vr => {
      vr.stops.forEach(stop => {
        trips.add(stop.trip_number);
      });
    });
    return Array.from(trips).sort((a, b) => a - b);
  };

  return (
    <div className="bg-white/95 backdrop-blur-md shadow-lg rounded-xl h-[calc(100vh-2rem)] flex flex-col overflow-hidden text-sm border border-gray-200/50">
      {/* Trip Filter */}
      <div className="px-3 py-2.5 border-b border-gray-50/80 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex gap-1.5 flex-wrap">
          {getAllTrips().map(tripNumber => (
            <button
              key={tripNumber}
              onClick={() => setActiveTrip(tripNumber === activeTrip ? null : tripNumber)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-lg transition-all',
                activeTrip === tripNumber
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600 ring-offset-2'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              )}
            >
              Trip {tripNumber}
            </button>
          ))}
        </div>
      </div>

      {/* Route Stats */}
      <div className="px-3 py-2.5 border-b border-gray-50/80 bg-gray-50/80">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-medium text-gray-900">Route Summary</h2>
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
               className={cn(
                 'rounded-lg bg-white shadow-sm transition-all',
                 activeVehicles.has(vr.vehicle_id) ? 'not-disabled:ring-2 ring-blue-100' : ''
               )}>
            <button
              disabled={currentRoute.total_vehicles === 1}
              onClick={() => toggleVehicle(vr.vehicle_id)}
              className="w-full text-left py-2 px-3 rounded-lg transition-colors not-disabled:hover:bg-gray-50"
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

            {activeVehicles.has(vr.vehicle_id) && activeTrip && (
              <div className="py-2 border-t border-gray-100 divide-y divide-gray-50">
                {/* Depot Start */}
                <div 
                  className="px-4 py-2 bg-gray-50/50 cursor-pointer hover:bg-gray-100/50"
                  onClick={() => onZoomToLocation([parseFloat(depotLat), parseFloat(depotLng)])}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-lg flex items-center justify-center text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
                      S
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs truncate text-gray-900">
                        Depot
                      </div>
                      <div className="text-[10px] text-gray-500">
                        Start Location
                      </div>
                    </div>
                  </div>
                </div>

                {/* Regular Stops */}
                {vr.stops
                  .filter(stop => stop.trip_number === activeTrip)
                  .map((stop: StopInfo) => (
                    <div
                      key={stop.sequence_number}
                      className="px-4 py-2 transition-colors hover:bg-gray-50/50 cursor-pointer"
                      onClick={() => onZoomToLocation(stop.coordinates)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-lg flex items-center justify-center text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
                          {stop.sequence_number + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs truncate text-gray-900">
                            {stop.name}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            Collection: {stop.wco_amount}L
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                {/* Depot End */}
                <div 
                  className="px-4 py-2 bg-gray-50/50 cursor-pointer hover:bg-gray-100/50"
                  onClick={() => onZoomToLocation([parseFloat(depotLat), parseFloat(depotLng)])}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-lg flex items-center justify-center text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
                      E
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs truncate text-gray-900">
                        Depot
                      </div>
                      <div className="text-[10px] text-gray-500">
                        End Location
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
