import ConfigForm from './components/ConfigForm';
import Map from './components/Map';
import { useConfig } from './hooks/useConfig';
import { useLocations } from './hooks/useLocations';
import { useOptimizeRoutes } from './hooks/useOptimizeRoutes';
import { ConfigRequest, RouteResponse, StopInfo } from './types/models';
import { useEffect, useMemo, useRef } from 'react';
import { useFilterStore } from './stores/filterStore';
import ResultsCard from './components/ResultsCard';
import { useConfigStore } from './stores/configStore';
import { MapRef } from './types/map';

function App() {
  const { visualConfig, solvers, defaultSolver, mapCenter } = useConfig();
  const { depotLat, depotLng } = useConfigStore();
  const { locations, addLocation, removeLocation } = useLocations();
  const { routes, isLoading: isOptimizing, generateRoutes } = useOptimizeRoutes();
  const mapRef = useRef<MapRef>(null);

  const {
    activeVehicles,
    activeTrips,
    activeDay,  // Changed from activeSchedule
    initializeFilters
  } = useFilterStore();

  // Initialize filters when routes change
  useEffect(() => {
    if (routes) {
      initializeFilters(routes);
    }
  }, [routes]);

  const filteredRoutes = routes?.map(route => {
    if (activeDay && route.collection_day !== activeDay) return null;
    return {
      ...route,
      vehicle_routes: route.vehicle_routes.filter(vr => 
        activeVehicles.has(vr.vehicle_id) &&
        vr.stops.some(stop => activeTrips.has(stop.trip_number))
      )
    };
  }).filter(Boolean);

  const activeVehicleRoutes = useMemo(() => {
    const activeRoute = routes?.find(r => r.collection_day === activeDay);
    if (!activeRoute) return [];
    return activeRoute.vehicle_routes;
  }, [routes, activeDay]);

  // Filter locations based on active trips
  const activeLocations = useMemo(() => {
    return locations?.filter(location => {
      if (!activeVehicleRoutes) return true;
      return activeVehicleRoutes.some(vr => 
       (activeVehicles.size === 0 || activeVehicles.has(vr.vehicle_id)) &&
        vr.stops.some(stop => 
          (activeTrips.size === 0 || activeTrips.has(stop.trip_number)) &&
          stop.location_id === location.id)
      );
    }) ?? [];
  }, [locations, activeVehicles, activeTrips, activeVehicleRoutes]);

  const handleConfigSubmit = async (config: ConfigRequest) => {
    if (!locations || locations.length === 0) {
      return;
    }

    try {
      const configWithDepot = {
        ...config,
        depot_location: [parseFloat(depotLat), parseFloat(depotLng)] as [number, number]
      };
      await generateRoutes(configWithDepot, locations);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to generate routes');
    }
  };

  const handleZoomToCoordinates = (coordinates: [number, number], zoom = 16) => {
    // Offset to account for the right panels (320px total)
    const offset = {
      x: 160, // Move view left by half the panel width
      y: 0
    };
    mapRef.current?.zoomTo(coordinates, zoom, offset);
  };

  const handleZoomToTrip = (stops: StopInfo[]) => {
    const padding = {
      x: 160, // Half the panel width
      y: 40  // Top/bottom padding
    };
    mapRef.current?.fitBounds(stops.map(stop => stop.coordinates), padding);
  };

  useEffect(() => {
    if (routes && activeDay) {
      const currentRoute = routes.find(r => r.collection_day === activeDay);
      if (currentRoute) {
        const allStops = currentRoute.vehicle_routes.flatMap(vr => vr.stops);
        const padding = { x: 160, y: 40 };
        mapRef.current?.fitBounds(allStops.map(stop => stop.coordinates), padding);
      }
    }
  }, [activeDay, routes]);

  return (
    <div className="h-screen w-screen relative">
      {/* Full-screen map */}
      <div className="absolute inset-0 z-0">
        {visualConfig ? (
          <Map
            ref={mapRef}
            locations={activeLocations}
            depotLocation={[parseFloat(depotLat), parseFloat(depotLng)]}
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
          <ResultsCard 
            routes={routes ?? []} 
            onZoomToLocation={handleZoomToCoordinates}
            onZoomToTrip={handleZoomToTrip}
          />
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
