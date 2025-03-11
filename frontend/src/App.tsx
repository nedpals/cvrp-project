import ConfigForm from './components/ConfigForm';
import Map from './components/Map';
import FilterControls from './components/FilterControls';
import { useConfig } from './hooks/useConfig';
import { useLocations } from './hooks/useLocations';
import { useOptimizeRoutes } from './hooks/useOptimizeRoutes';
import { ConfigRequest, RouteResponse } from './types/models';
import { useEffect } from 'react';
import { useFilterStore } from './stores/filterStore';

function App() {
  const { visualConfig, solvers, defaultSolver, mapCenter } = useConfig();
  const { locations, addLocation, removeLocation } = useLocations();
  const { routes, isLoading: isOptimizing, generateRoutes } = useOptimizeRoutes();

  const {
    activeVehicles,
    activeTrips,
    activeSchedule,
    setActiveSchedule,
    initializeFilters
  } = useFilterStore();

  // Initialize filters when routes change
  useEffect(() => {
    if (routes) {
      initializeFilters(routes, activeSchedule);
    }
  }, [routes, activeSchedule]);

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

  // Filter locations based on active trips
  const activeLocations = locations?.filter(location => {
    // If no vehicles or trips are selected, show all locations
    if (activeVehicles.size === 0 || activeTrips.size === 0) return true;
    
    // Show all locations if no routes or no active schedule
    if (!routes || !activeSchedule) return true;
    
    const currentRoute = routes.find(r => r.schedule_id === activeSchedule);
    if (!currentRoute) return true;
    
    // Check if this location is part of any active vehicle and trip combination
    return currentRoute.vehicle_routes.some(vr =>
      activeVehicles.has(vr.vehicle_id) &&
      vr.stops.some(stop => 
        activeTrips.has(stop.trip_number) && 
        stop.location_id === location.id
      )
    );
  });

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
            locations={activeLocations}
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
            onChange={(e) => setActiveSchedule(e.target.value)}
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
