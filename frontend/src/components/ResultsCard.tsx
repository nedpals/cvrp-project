import { RouteResponse } from '../types/models';
import { useFilterStore } from '../stores/filterStore';

interface ResultsCardProps {
  routes: RouteResponse[] | null;
}

export default function ResultsCard({ routes }: ResultsCardProps) {
  const {
    activeVehicles,
    activeTrips,
    activeSchedule,
    toggleVehicle,
    toggleTrip,
    toggleAllTrips,
  } = useFilterStore();

  if (!routes || !activeSchedule) return null;

  const currentRoute = routes.find(r => r.schedule_id === activeSchedule);
  if (!currentRoute) return null;

  return (
    <div className="bg-white/95 backdrop-blur p-4 rounded-lg shadow-lg h-[calc(100vh-2rem)]">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-800">{currentRoute.schedule_name}</h2>
          <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
            <div className="bg-blue-50 p-2 rounded">
              <span className="text-blue-700 font-medium">{currentRoute.total_stops}</span>
              <span className="text-gray-600 ml-1">stops</span>
            </div>
            <div className="bg-blue-50 p-2 rounded">
              <span className="text-blue-700 font-medium">{currentRoute.total_trips}</span>
              <span className="text-gray-600 ml-1">trips</span>
            </div>
            <div className="bg-blue-50 p-2 rounded">
              <span className="text-blue-700 font-medium">{currentRoute.total_distance.toFixed(1)}</span>
              <span className="text-gray-600 ml-1">km</span>
            </div>
            <div className="bg-blue-50 p-2 rounded">
              <span className="text-blue-700 font-medium">{currentRoute.total_collected.toFixed(1)}</span>
              <span className="text-gray-600 ml-1">L collected</span>
            </div>
          </div>
        </div>

        {/* Vehicle Routes */}
        <div className="flex-1 overflow-y-auto">
          {currentRoute.vehicle_routes.map((vr) => (
            <div key={vr.vehicle_id} className="mb-4 last:mb-0">
              <button
                onClick={() => toggleVehicle(vr.vehicle_id)}
                className={`w-full text-left p-2 rounded ${
                  activeVehicles.has(vr.vehicle_id)
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">Vehicle {vr.vehicle_id}</span>
                  <span className="text-sm">{vr.efficiency.toFixed(1)}% efficient</span>
                </div>
                <div className="text-xs mt-1">
                  <span className="mr-2">{vr.total_collected.toFixed(1)}L collected</span>
                  <span>{vr.total_distance.toFixed(1)}km traveled</span>
                </div>
              </button>

              {activeVehicles.has(vr.vehicle_id) && (
                <div className="mt-2 pl-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-gray-600">Trips</span>
                    <button
                      onClick={() => toggleAllTrips(currentRoute)}
                      className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                    >
                      Toggle All
                    </button>
                  </div>
                  <div className="space-y-1">
                    {vr.stops.map((stop) => (
                      <button
                        key={`${stop.trip_number}-${stop.sequence_number}`}
                        onClick={() => toggleTrip(stop.trip_number)}
                        className={`w-full text-left p-2 rounded text-xs ${
                          activeTrips.has(stop.trip_number)
                            ? 'bg-blue-50 text-blue-800'
                            : 'bg-gray-50 text-gray-800'
                        }`}
                      >
                        <div className="flex justify-between">
                          <span>Trip #{stop.trip_number}</span>
                          <span>{stop.wco_amount}L</span>
                        </div>
                        <div className="text-xs mt-1 text-gray-500">
                          Stop #{stop.sequence_number} - {stop.name}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
