import ConfigForm from './components/ConfigForm';
import Map from './components/Map';
import FilterControls from './components/FilterControls';
import { useConfig } from './hooks/useConfig';
import { useLocations } from './hooks/useLocations';
import { useOptimizeRoutes } from './hooks/useOptimizeRoutes';
import { ConfigRequest, RouteResponse } from './types/models';
import { useState, useEffect } from 'react';

function App() {
  const { visualConfig, solvers, defaultSolver, mapCenter } = useConfig();
  const { locations, addLocation, removeLocation } = useLocations();
  const { routes, isLoading: isOptimizing, generateRoutes } = useOptimizeRoutes();

  const [activeVehicles, setActiveVehicles] = useState<Set<string>>(new Set());
  const [activeTrips, setActiveTrips] = useState<Set<number>>(new Set());
  const [activeSchedule, setActiveSchedule] = useState<string | null>(null);

  // Initialize filters when routes change
  useEffect(() => {
    if (routes) {
      const vehicles = new Set<string>();
      const trips = new Set<number>();
      
      if (routes.length > 0 && !activeSchedule) {
        setActiveSchedule(routes[0].schedule_id);
      }

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
      if (next.has(vehicleId)) next.delete(vehicleId);
      else next.add(vehicleId);
      return next;
    });
  };

  const handleTripToggle = (tripNumber: number) => {
    setActiveTrips(prev => {
      const next = new Set(prev);
      if (next.has(tripNumber)) next.delete(tripNumber);
      else next.add(tripNumber);
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

  const filteredRoutes = routes?.map(route => {
    if (activeSchedule && route.schedule_id !== activeSchedule) return null;
    return {
      ...route,
      vehicle_routes: route.vehicle_routes.filter(vr => 
        activeVehicles.has(vr.vehicle_id) &&
        vr.stops.some(stop => activeTrips.has(stop.trip_number))
      )
    };
  }).filter(Boolean);

  const handleConfigSubmit = async (config: ConfigRequest) => {
    if (!locations || locations.length === 0) {
      return;
    }

    try {
      await generateRoutes(config, locations);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to generate routes');
    }
  };

  return (
    <div className="h-screen w-screen relative">
      {/* Full-screen map */}
      <div className="absolute inset-0 z-0">
        {visualConfig ? (
          <Map
            locations={locations}
            depotLocation={mapCenter}
            center={mapCenter}
            routes={filteredRoutes?.filter((route): route is RouteResponse => route !== null)}
            config={visualConfig.map}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gray-100">
            <div className="text-gray-600">Loading map configuration...</div>
          </div>
        )}
      </div>

      {/* Filter Controls */}
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

      {/* Floating UI elements */}
      <div className="absolute top-4 right-4 z-[1000] pointer-events-none">
        <div className="w-80 space-y-3 pointer-events-auto">
          <ConfigForm 
            onSubmit={handleConfigSubmit} 
            solvers={solvers}
            defaultSolver={defaultSolver}
            locations={locations}
            onAddLocation={addLocation}
            onRemoveLocation={removeLocation}
            isLoading={isOptimizing}
          />
          
          {routes && (
            <div className="bg-white/95 backdrop-blur p-3 rounded-lg shadow-lg max-h-80 overflow-y-auto">
              <h2 className="text-base font-semibold mb-2 border-b pb-1">Results</h2>
              <div className="space-y-3">
                {routes.map((route) => (
                  <div key={route.schedule_id} className="p-2 bg-blue-50/70 rounded-md">
                    <h3 className="font-medium text-sm text-blue-800">{route.schedule_name}</h3>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs mt-1 text-gray-700">
                      <div>Distance:</div><div className="font-medium">{route.total_distance.toFixed(2)} km</div>
                      <div>Collected:</div><div className="font-medium">{route.total_collected.toFixed(2)} L</div>
                      <div>Vehicles:</div><div className="font-medium">{route.vehicle_routes.length}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
