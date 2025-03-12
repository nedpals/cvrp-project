import ConfigForm from './components/ConfigForm';
import Map from './components/Map';
import { useConfig } from './hooks/useConfig';
import { useLocations } from './hooks/useLocations';
import { useOptimizeRoutes } from './hooks/useOptimizeRoutes';
import { ConfigRequest, RouteResponse } from './types/models';
import { useEffect, useMemo } from 'react';
import { useFilterStore } from './stores/filterStore';
import ResultsCard from './components/ResultsCard';

function App() {
  const { visualConfig, solvers, defaultSolver, mapCenter } = useConfig();
  const { locations, addLocation, removeLocation } = useLocations();
  const { routes, isLoading: isOptimizing, generateRoutes, switchToSchedule } = useOptimizeRoutes();

  const {
    activeVehicles,
    activeTrips,
    activeSchedule,
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

  const activeVehicleRoutes = useMemo(() => {
    const activeRoute = routes?.find(r => r.schedule_id === activeSchedule);
    if (!activeRoute) return [];
    return activeRoute.vehicle_routes;
  }, [routes, activeSchedule]);

  // Filter locations based on active trips
  const activeLocations = useMemo(() => {
    return locations?.filter(location => {
      // Show all locations if no routes or no active schedule
      if (!activeVehicleRoutes) return true;

      // Show locations that are part of active routes
      return activeVehicleRoutes.some(vr => 
       (!activeVehicles.size || activeVehicles.has(vr.vehicle_id)) &&
       (!activeTrips.size || vr.stops.some(stop => activeTrips.has(stop.trip_number))) &&
        vr.stops.some(stop => stop.location_id === location.id)
      );
    }) ?? [];
  }, [locations, activeVehicles, activeTrips, activeVehicleRoutes]);

  useEffect(() => {
    console.log('Active locations:', activeLocations);
    console.log('Active trips:', activeTrips);
    console.log('Active schedule:', activeSchedule);
    console.log('Routes:', activeVehicleRoutes);
  }, [activeLocations, activeTrips, activeVehicleRoutes]);

  const handleConfigSubmit = async (config: ConfigRequest) => {
    if (!locations || locations.length === 0 || !activeSchedule) {
      return;
    }

    try {
      await generateRoutes(config, locations, activeSchedule);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to generate routes');
    }
  };

  // Update effect to handle schedule switching
  useEffect(() => {
    if (activeSchedule && routes) {
      const matchingRoute = routes.find(r => r.schedule_id === activeSchedule);
      if (!matchingRoute) {
        // If we don't have routes for this schedule yet, try to switch to it
        switchToSchedule(activeSchedule);
      }
    }
  }, [activeSchedule, routes]);

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

      {/* Right Side - Configuration and Results */}
      <div className="absolute top-4 right-0 pr-4 pb-4 h-full z-[1000] flex gap-3">
        {/* Results Card */}
        <div className="w-80 pointer-events-auto">
          <ResultsCard routes={routes ?? []} />
        </div>

        {/* Config Cards */}
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
        </div>
      </div>
    </div>
  );
}

export default App;
