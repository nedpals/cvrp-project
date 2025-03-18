import ConfigForm from './components/ConfigForm';
import Map from './components/Map';
import { useOptimizeRoutes } from './hooks/useOptimizeRoutes';
import { ConfigRequest, StopInfo } from './types/models';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFilterStore } from './stores/filterStore';
import ResultsCard from './components/ResultsCard';
import { useConfigStore } from './stores/configStore';
import { MapData, MapPath, MapRef } from './types/map';
import { findStopAndVehicleInfo, getVehicleColor, createLocationPopup, createDepotPopup } from './utils/mapHelpers';

function App() {
  const { 
    config: { 
      map: mapConfig, 
      settings: { depot_location, solver },
      locations 
    }
  } = useConfigStore();
  const { routes, isLoading: isOptimizing, generateRoutes, error, retry } = useOptimizeRoutes();
  const mapRef = useRef<MapRef>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const RIGHT_PANEL_WIDTH = 160 * 2; // 2 panels of 160px each
  const ZOOM_OFFSET = {
    x: -(RIGHT_PANEL_WIDTH * 2),
    y: 0
  }

  const {
    activeVehicles,
    activeTrip,
    initializeFilters
  } = useFilterStore();

  // Initialize filters when routes change
  useEffect(() => {
    if (routes?.[0]) {
      initializeFilters(routes[0]);
    }
  }, [routes]);

  const activeVehicleRoutes = useMemo(() => {
    if (!routes?.[0]) return [];
    return routes[0].vehicle_routes;
  }, [routes]);

  // Filter locations based on active trip
  const activeLocations = useMemo(() => {
    return locations?.filter(location => {
      if (!activeVehicleRoutes) return true;
      return activeVehicleRoutes.some(vr =>
        (activeVehicles.size === 0 || activeVehicles.has(vr.vehicle_id)) &&
        vr.stops.some(stop =>
          (activeTrip === null || activeTrip === stop.trip_number) &&
          stop.location_id === location.id)
      );
    }) ?? [];
  }, [locations, activeVehicles, activeTrip, activeVehicleRoutes]);

  const handleConfigSubmit = async (config: ConfigRequest) => {
    if (!locations || locations.length === 0) {
      return;
    }

    try {
      await generateRoutes(config, locations);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getNextStop = (locationId: string): StopInfo | null => {
    if (!routes?.[0]) return null;
    
    for (const vr of routes[0].vehicle_routes) {
      const stopIndex = vr.stops.findIndex(stop => stop.location_id === locationId);
      if (stopIndex !== -1 && stopIndex < vr.stops.length - 1) {
        return vr.stops[stopIndex + 1];
      }
    }
    return null;
  };

  const handleZoomToCoordinates = (coordinates: [number, number]) => {
    // Find the selected stop based on coordinates
    const selectedStop = routes?.[0]?.vehicle_routes
      .flatMap(vr => vr.stops)
      .find(stop => stop.coordinates[0] === coordinates[0] && stop.coordinates[1] === coordinates[1]);

    // Find next stop if this is a selected location
    const nextStop = selectedStop && selectedLocationId === selectedStop.location_id 
      ? getNextStop(selectedStop.location_id)
      : null;

    if (nextStop && selectedStop) {
      // If there's a next stop, fit bounds to include both locations
      const bounds = [selectedStop.coordinates, nextStop.coordinates];
      // Add slight delay to ensure map is ready
      setTimeout(() => {
        mapRef.current?.fitBounds(bounds, ZOOM_OFFSET);
      }, 50);
    } else {
      mapRef.current?.zoomTo(coordinates, 16, {
        x: RIGHT_PANEL_WIDTH,
        y: 0
      });
    }
  };

  const handleZoomToTrip = (stops: StopInfo[]) => {
    if (!stops.length) return;
    // Add slight delay to ensure map is ready
    setTimeout(() => {
      mapRef.current?.fitBounds(stops.map(stop => stop.coordinates), ZOOM_OFFSET);
    }, 50);
  };

  useEffect(() => {
    if (routes) {
      const currentRoute = routes[0];
      if (currentRoute) {
        const allStops = currentRoute.vehicle_routes.flatMap(vr => vr.stops);
        mapRef.current?.fitBounds(allStops.map(stop => stop.coordinates), ZOOM_OFFSET);
      }
    }
  }, [routes]);

  const handleLocationClick = (locationId: string) => {
    setSelectedLocationId(selectedLocationId === locationId ? null : locationId);
  };

  const mapData = useMemo((): MapData => {
    const nextStop = selectedLocationId ? getNextStop(selectedLocationId) : null;

    const markers = activeLocations.map(loc => {
      const [stopInfo, vehicleInfo, vehicleIndex] = findStopAndVehicleInfo(loc);
      const isNextStop = nextStop ? loc.id === nextStop.location_id : false;

      return {
        id: loc.id,
        position: loc.coordinates,
        color: selectedLocationId ? 
          (loc.id === selectedLocationId ? 'blue' : 
           isNextStop ? 'green' : 'gray') : 
          (stopInfo && vehicleIndex >= 0 ? getVehicleColor(vehicleIndex) : 'gray'),
        popup: createLocationPopup(loc, stopInfo, vehicleInfo, vehicleIndex),
        onClick: () => handleLocationClick(loc.id)
      };
    });

    // Add depot marker always
    markers.unshift({
      id: 'depot',
      position: depot_location,
      color: 'purple',
      onClick: () => setSelectedLocationId(null),
      popup: routes ? createDepotPopup(routes) : <></>
    });

    const paths = routes?.flatMap((route) =>
      route.vehicle_routes.flatMap<MapPath>((vr, vrIndex) => {
        if (selectedLocationId) {
          const stopIndex = vr.stops.findIndex(stop => stop.location_id === selectedLocationId);
          if (stopIndex === -1) return [];
          
          // Only show path to next stop
          if (stopIndex < vr.stops.length - 1) {
            const currentStop = vr.stops[stopIndex];
            const nextStop = vr.stops[stopIndex + 1];
            const tripPath = vr.trip_paths[currentStop.trip_number]?.find(p => 
              (p.from_coords[0] === currentStop.coordinates[0] && p.from_coords[1] === currentStop.coordinates[1]) && 
              (p.to_coords[0] === nextStop.coordinates[0] && p.to_coords[1] === nextStop.coordinates[1])
            );
            
            return tripPath ? [{
              id: `${route.schedule_id}-${vr.vehicle_id}-${stopIndex}`,
              points: tripPath.path,
              color: 'red'  // Keep path color as red
            }] : [];
          }
          return [];
        }

        return [{
          id: `${route.schedule_id}-${vr.vehicle_id}`,
          points: activeTrip ? vr.trip_paths[activeTrip]?.flatMap(stop => stop.path) ?? [] : [],
          color: getVehicleColor(vrIndex)
        }];
      })
    ) || [];

    return { markers, paths };
  }, [activeLocations, activeTrip, routes, depot_location, selectedLocationId]);

  return (
    <div className="h-screen w-screen relative overflow-hidden pointer-events-none">
      {/* Full-screen map */}
      <div className="absolute inset-0 z-0 pointer-events-auto">
        {mapConfig ? (
          <Map
            ref={mapRef}
            center={mapConfig.center || depot_location}
            config={mapConfig}
            data={mapData}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gray-100">
            <div className="text-gray-600">Loading map configuration...</div>
          </div>
        )}
      </div>

      {/* Right Side - Configuration and Results */}
      <div className="absolute top-4 right-0 pr-4 bottom-4 z-50 flex gap-3 overflow-hidden pointer-events-auto">
        {/* Results Card */}
        <div className="w-80 h-full pointer-events-auto flex flex-col">
          <ResultsCard
            routes={routes ?? []}
            onZoomToLocation={handleZoomToCoordinates}
            onZoomToTrip={handleZoomToTrip}
            isLoading={isOptimizing}
            error={error}
            onRetry={retry}
            selectedLocationId={selectedLocationId}
            onLocationSelect={(locationId) => locationId && handleLocationClick(locationId)}
          />
        </div>

        {/* Config Cards */}
        <div className="w-80 h-full pointer-events-auto flex flex-col">
          <ConfigForm
            onSubmit={handleConfigSubmit}
            defaultSolver={solver}
            isLoading={isOptimizing}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
