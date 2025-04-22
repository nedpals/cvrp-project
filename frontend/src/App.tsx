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

  // Filter locations based on active trip
  const activeLocations = useMemo(() => {
    if (!activeTrip || !activeTrip.vehicle_routes) return locations;
    return locations?.filter(location => {
      return activeTrip.vehicle_routes.some(vr =>
        (activeVehicles.size === 0 || activeVehicles.has(vr.vehicle_id)) &&
        vr.stops.some(stop => stop.location_id === location.id)
      );
    }) ?? [];
  }, [locations, activeVehicles, activeTrip]);

  const handleConfigSubmit = async (config: ConfigRequest) => {
    if (!config.locations || config.locations.length === 0) {
      return;
    }

    try {
      await generateRoutes(config, config.locations);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getNextStop = (locationId: string): StopInfo | null => {
    if (!activeTrip) return null;
    
    for (const vr of activeTrip.vehicle_routes) {
      const stopIndex = vr.stops.findIndex(stop => stop.location_id === locationId);
      if (stopIndex !== -1 && stopIndex < vr.stops.length - 1) {
        return vr.stops[stopIndex + 1];
      }
    }
    return null;
  };

  const handleZoomToCoordinates = (coordinates: [number, number]) => {
    // Find the selected stop based on coordinates
    const selectedStop = activeTrip?.vehicle_routes
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
      // Remove selected location ID to avoid confusion
      setSelectedLocationId(null);
      mapRef.current?.fitBounds(stops.map(stop => stop.coordinates), ZOOM_OFFSET);
    }, 50);
  };

  useEffect(() => {
    if (routes) {
      const currentRoute = routes[0];
      if (currentRoute && currentRoute.trips.length > 0) {
        const activeTrip = currentRoute.trips[0];
        const allStops = activeTrip.vehicle_routes.flatMap(vr => vr.stops);
        mapRef.current?.fitBounds(allStops.map(stop => stop.coordinates), ZOOM_OFFSET);
      }
    }
  }, [routes]);

  const handleLocationClick = (locationId: string) => {
    setSelectedLocationId(selectedLocationId === locationId ? null : locationId);
  };

  const mapData = useMemo((): MapData => {
    const nextStop = selectedLocationId ? getNextStop(selectedLocationId) : null;
    const markers = [
      // Add depot marker always
      {
        id: 'depot',
        position: depot_location,
        color: 'purple',
        onClick: () => setSelectedLocationId(null),
        popup: activeTrip ? createDepotPopup(activeTrip) : <></>
      },
      ...activeLocations.map(loc => {
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
      })
    ];

    const paths = activeTrip?.vehicle_routes.flatMap<MapPath>((vr, vrIndex) => {
      if (selectedLocationId) {
        const stopIndex = vr.stops.findIndex(stop => stop.location_id === selectedLocationId);
        if (stopIndex === -1 || stopIndex + 1 >= vr.stops.length) {
          return [];
        }

        // Only show path to next stop
        const currentStop = vr.stops[stopIndex];
        const nextStop = vr.stops[stopIndex + 1];
        const tripPath = vr.trip_paths[activeTrip.trip_number]?.find(p =>
          (p.from_coords[0] === currentStop.coordinates[0] && p.from_coords[1] === currentStop.coordinates[1]) &&
          (p.to_coords[0] === nextStop.coordinates[0] && p.to_coords[1] === nextStop.coordinates[1])
        );

        return tripPath ? [{
          id: `${activeTrip.schedule_id}-${vr.vehicle_id}-${stopIndex}`,
          points: tripPath.path,
          color: 'red'  // Keep path color as red
        }] : [];
      }

      // To avoid overlapping paths, keep track of already crossed points
      const alreadyCrossed: Record<number, Record<number, boolean>> = {};
      const activePoints: [number, number][] = [];
      const activeMarkers: MapPath[] = [];

      for (const paths of vr.trip_paths[activeTrip.trip_number] ?? []) {
        for (const path of paths.path) {
          const [x, y] = path;
          if (!alreadyCrossed[x]) {
            alreadyCrossed[x] = {};
          }

          if (!alreadyCrossed[x][y]) {
            activePoints.push(path);
            alreadyCrossed[x][y] = true;
            continue;
          }

          // if going back, register the path
          if (activePoints.length >= 1) {
            activeMarkers.push({
              id: `${activeTrip.schedule_id}-full-${vr.vehicle_id}-${activePoints.length}-${Math.random()}`,
              points: Array.from(activePoints),
              color: getVehicleColor(vrIndex)
            });

            // empty the active points
            activePoints.splice(0, activePoints.length);
          }
        }
      }

      return activeMarkers;
    }) ?? [];

    return { markers, paths };
  }, [activeLocations, activeTrip, depot_location, selectedLocationId]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('Map data:', mapData);
    }
  }, [mapData]);

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
            onLocationSelect={(locationId) => locationId && handleLocationClick(locationId || '')}
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
