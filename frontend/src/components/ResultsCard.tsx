import { getActiveTripFromRouteInfo, RouteResponse, StopInfo } from '../types/models';
import { useFilterStore } from '../stores/filterStore';
import { useConfigStore } from '../stores/configStore';
import { cn } from '../utils/utils';
import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

interface ResultsCardProps {
  routes: RouteResponse[];
  onZoomToLocation: (coordinates: [number, number]) => void;
  onZoomToTrip: (stops: StopInfo[]) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  selectedLocationId: string | null;
  onLocationSelect: (locationId: string | null) => void;
}

function ResultsCardContainer({ children }: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/95 backdrop-blur-md shadow-lg rounded-xl h-[calc(100vh-2rem)] flex flex-col overflow-hidden text-sm border border-gray-200/50">
      {children}
    </div>
  );
}

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const exportToExcel = (routes: RouteResponse[]) => {
  const workbook = XLSX.utils.book_new();
  const { config: { settings: { depot_location: [depotLat, depotLng] } } } = useConfigStore.getState();

  // Enhanced summary sheet with WCO total
  const totalStops = routes.reduce((total, route) => total + route.total_stops, 0);

  const totalWco = routes.reduce((total, route) =>
    total + route.vehicle_routes.reduce((total, vr) =>
      total + vr.stops.reduce((stopTotal, stop) => stopTotal + stop.wco_amount, 0), 0
    ), 0
  );

  const totalDistance = routes.reduce((total, route) => total + route.total_distance, 0);
  const totalTravelTime = routes.reduce((total, route) => total + route.total_travel_time, 0);
  const totalCollectionTime = routes.reduce((total, route) => total + route.total_collection_time, 0);
  const totalVehicles = routes[0].total_vehicles || 0;
  
  const summaryData = [
    ['Total Stops', totalStops],
    ['Total Distance (km)', totalDistance],
    ['Total Travel Time', formatDuration(totalTravelTime + totalCollectionTime)],
    ['Total Vehicles', totalVehicles],
    ['Total WCO Collected (L)', totalWco.toFixed(1)],
  ];
  

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  routes.forEach((route, idx) => {
    // Get all unique trips
    const trips = new Set<number>();
    route.vehicle_routes.forEach(vr => {
      vr.stops.forEach(stop => trips.add(stop.trip_number));
    });

    // Create a sheet for each trip
    Array.from(trips).sort((a, b) => a - b).forEach(tripNumber => {
      const tripData = [['Vehicle ID', 'Stop Number', 'Location Name', 'Collection Amount (L)', 'Trip Number', 'Latitude', 'Longitude']];
      
      route.vehicle_routes.forEach(vr => {
        // Add depot start for each vehicle
        tripData.push([
          vr.vehicle_id, 
          '0', 
          'Depot (Start)', 
          '0', 
          tripNumber.toString(),
          JSON.stringify(depotLat),
          JSON.stringify(depotLng)
        ]);
        
        // Add stops for this trip
        vr.stops
          .filter(stop => stop.trip_number === tripNumber)
          .forEach(stop => {
            tripData.push([
              vr.vehicle_id,
              (stop.sequence_number + 1).toString(),
              stop.name,
              stop.wco_amount.toString(),
              stop.trip_number.toString(),
              stop.coordinates[0].toString(),
              stop.coordinates[1].toString(),
            ]);
          });
        
        // Add depot end for each vehicle
        tripData.push([
          vr.vehicle_id, 
          '-', 
          'Depot (End)', 
          JSON.stringify(vr.stops.reduce((total, stop) => total + stop.wco_amount, 0)),
          tripNumber.toString(),
          JSON.stringify(depotLat),
          JSON.stringify(depotLng)
        ]);
      });

      const tripSheet = XLSX.utils.aoa_to_sheet(tripData);
      XLSX.utils.book_append_sheet(workbook, tripSheet, `Day ${idx + 1} - Trip ${tripNumber}`);
    });
  });

  // Save the file
  XLSX.writeFile(workbook, `route_export_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export default function ResultsCard({ 
  routes, 
  onZoomToLocation,
  onZoomToTrip,
  isLoading,
  error,
  onRetry,
  selectedLocationId,
  onLocationSelect
}: ResultsCardProps) {
  const [activeTab, setActiveTab] = useState<'stops' | 'stats'>('stops');
  const {
    activeVehicles,
    activeTrip,
    setActiveVehicles,
    setActiveTrip,
  } = useFilterStore();

  const toggleVehicle = (vehicleId: string) => {
    const newVehicles = new Set(activeVehicles);
    if (newVehicles.has(vehicleId)) {
      newVehicles.delete(vehicleId);
    } else {
      newVehicles.add(vehicleId);
    }
    setActiveVehicles(newVehicles);
  };

  const trips = useMemo(() => {
    const trips = new Set<number>();

    // Assume that routes is a multi-day route of the same schedule
    routes.forEach((route, routeDay) => {
      route.vehicle_routes.forEach(vr => {
        vr.stops.forEach(stop => {
          trips.add(routeDay + stop.trip_number);
        });
      });
    });

    return Array.from(trips).sort((a, b) => a - b);
  }, [routes]);

  const showTripControls = trips.length > 1;
  
  const overallStats = useMemo(() => {
    let totalStops = 0;
    let totalDistance = 0;
    let totalTravelTime = 0;
    let totalCollectionTime = 0;
    let totalVehicles = 0;
    let totalWco = 0;

    routes.forEach(route => {
      totalStops += route.total_stops;
      totalDistance += route.total_distance;
      totalTravelTime += route.total_travel_time;
      totalCollectionTime += route.total_collection_time;
      totalVehicles += route.total_vehicles;
      totalWco += route.total_collected;
    });

    return {
      totalStops,
      totalDistance,
      totalTravelTime,
      totalCollectionTime,
      totalVehicles,
      totalWco
    }
  }, [routes]);

  const currentTripStats = useMemo(() => {
    if (!activeTrip) {
      return {
        wcoTotal: 0,
        stopCount: 0,
        vehicleCount: 0,
        distance: 0,
        travelTime: 0,
        collectionTime: 0,
        duration: 0
      };
    }

    return {
      wcoTotal: activeTrip.total_collected,
      collectionTime: activeTrip.total_collection_time,
      travelTime: activeTrip.total_travel_time,
      distance: activeTrip.total_distance,
      duration: activeTrip.total_travel_time + activeTrip.total_collection_time,
      stopCount: activeTrip.total_stops,
      vehicleCount: activeTrip.vehicle_routes.length
    };
  }, [activeTrip]);

  const allActiveTripStops = useMemo(() => activeTrip?.vehicle_routes.flatMap(vr => vr.stops) ?? [], [activeTrip]);

  useEffect(() => {
    if (allActiveTripStops) {
      onZoomToTrip(allActiveTripStops);
      onLocationSelect(null);
    }
  }, [allActiveTripStops]);

  useEffect(() => {
    if (activeTrip && activeVehicles.size === 0) {
      toggleVehicle(activeTrip.vehicle_routes[0].vehicle_id);
    }
  }, [activeTrip, activeVehicles]);

  useEffect(() => {
    if (!allActiveTripStops) {
      onZoomToTrip([]);
      return;
    }

    // zoom in to location when selected, if not zoom out to trip
    if (!selectedLocationId) {
      onZoomToTrip(allActiveTripStops);
      return;
    }
    
    const stop = allActiveTripStops.find(stop => stop.location_id === selectedLocationId);
    if (stop) {
      onZoomToLocation(stop.coordinates);
      return;
    }
  }, [selectedLocationId, allActiveTripStops])

  const isStopSelected = (stop: StopInfo) => selectedLocationId === stop.location_id;

  if (isLoading) {
    return (
      <ResultsCardContainer>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </ResultsCardContainer>
    );
  }

  if (error) {
    return (
      <ResultsCardContainer>
        <div className="px-3 py-2 border-b border-gray-100 bg-white sticky top-0 z-20">
          <h1 className="font-semibold text-gray-900">Results</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl border border-red-100 text-center max-w-md">
            <p className="font-medium mb-1">Error</p>
            <p className="text-red-500 text-sm">{error}</p>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              Try Again
            </button>
          )}
        </div>
      </ResultsCardContainer>
    );
  }

  if (routes.length === 0) return null;

  return (
    <ResultsCardContainer>
      {/* Card Header */}
      <div className="px-3 py-2 border-b border-gray-100 bg-white sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <h1 className="font-semibold text-gray-900">Results</h1>
          <button
            onClick={() => routes.length && exportToExcel(routes)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            Export
          </button>
        </div>
      </div>

      {/* Route Stats */}
      <div className="px-3 py-3 border-b border-gray-100 bg-white">
        <div className="flex flex-col gap-2.5">
          <div className="bg-gradient-to-b from-blue-50 to-white px-4 py-3 rounded-xl border border-blue-100">
            <div className="flex flex-col items-center">
              <span className="text-blue-600 font-medium mb-1">Total WCO Collected</span>
              <span className="font-semibold text-blue-900 text-2xl tracking-tight">{overallStats.totalWco.toFixed(1)}L</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
              <div className="flex flex-col items-center">
                <span className="text-gray-600 text-xs mb-0.5">Stops</span>
                <span className="font-medium text-gray-900">{overallStats.totalStops}</span>
              </div>
            </div>
            <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
              <div className="flex flex-col items-center">
                <span className="text-gray-600 text-xs mb-0.5">Distance</span>
                <span className="font-medium text-gray-900">{overallStats.totalDistance.toFixed(1)}km</span>
              </div>
            </div>
            <div className="col-span-2 grid grid-cols-3 gap-2">
              <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                <div className="flex flex-col items-center">
                  <span className="text-gray-600 text-xs mb-0.5">Total Time</span>
                  <span className="font-medium text-gray-900">{formatDuration(overallStats.totalTravelTime + overallStats.totalCollectionTime)}</span>
                </div>
              </div>
              <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                <div className="flex flex-col items-center">
                  <span className="text-gray-600 text-xs mb-0.5">Travel</span>
                  <span className="font-medium text-gray-900">{formatDuration(overallStats.totalTravelTime)}</span>
                </div>
              </div>
              <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                <div className="flex flex-col items-center">
                  <span className="text-gray-600 text-xs mb-0.5">Collection</span>
                  <span className="font-medium text-gray-900">{formatDuration(overallStats.totalCollectionTime)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trip Filter - Only show if multiple trips exist */}
      {showTripControls && (
        <div className="px-3 py-2.5 border-b border-gray-100 bg-white sticky top-0 z-10">
          <div className="flex gap-1.5 flex-wrap items-center">
            {trips.map(tripNumber => (
              <button
                key={tripNumber}
                onClick={() => {
                  for (let dayIdx = 0; dayIdx < routes.length; dayIdx++) {
                    const startTripRange = routes[dayIdx].total_trips * dayIdx + 1;
                    const endTripRange = routes[dayIdx].total_trips * (dayIdx + 1);
                    if (tripNumber < startTripRange || tripNumber > endTripRange) {
                      continue;
                    }

                    if (activeTrip && activeTrip.day + activeTrip.trip_number === tripNumber) {
                      return;
                    }
                    
                    const tripIdx = tripNumber - startTripRange;
                    setActiveTrip(getActiveTripFromRouteInfo(routes[dayIdx], tripIdx + 1));
                    return;
                  }
                }}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                  activeTrip && activeTrip.day + activeTrip.trip_number === tripNumber
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
                )}
              >
                Trip {tripNumber}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Trip Content */}
      {activeTrip && (
        <>
          {showTripControls ? (
            <div className="border-b border-gray-100 bg-white">
              {/* Trip Header */}
              <div className="px-3 pt-2">
                <div className="bg-blue-50/50 px-3 py-2 rounded-lg border border-blue-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-blue-600">Trip {activeTrip.trip_number + activeTrip.day} Collection</span>
                    <span className="font-semibold text-blue-900 text-base">
                      {currentTripStats.wcoTotal.toFixed(1)}L
                    </span>
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex gap-2 px-3 mt-2">
                <button
                  onClick={() => setActiveTab('stops')}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                    activeTab === 'stops'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
                  )}
                >
                  Stops
                </button>
                <button
                  onClick={() => setActiveTab('stats')}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                    activeTab === 'stats'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
                  )}
                >
                  Statistics
                </button>
              </div>

              {/* Tab Content */}
              <div className="px-3 py-2">
                {activeTab === 'stats' && (() => {
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs">Distance</span>
                          <span className="font-medium text-gray-900">{currentTripStats.distance.toFixed(1)}km</span>
                        </div>
                      </div>
                      <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs">Duration</span>
                          <span className="font-medium text-gray-900">{formatDuration(currentTripStats.duration)}</span>
                        </div>
                      </div>
                      <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs">Travel Time</span>
                          <span className="font-medium text-gray-900">{formatDuration(currentTripStats.travelTime)}</span>
                        </div>
                      </div>
                      <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs">Collection Time</span>
                          <span className="font-medium text-gray-900">{formatDuration(currentTripStats.collectionTime)}</span>
                        </div>
                      </div>
                      <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs">Stops</span>
                          <span className="font-medium text-gray-900">{currentTripStats.stopCount}</span>
                        </div>
                      </div>
                      <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs">Vehicles</span>
                          <span className="font-medium text-gray-900">{currentTripStats.vehicleCount}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : null}

          {/* Vehicle Routes - Show if single trip or if stops tab is active */}
          {(!showTripControls || activeTab === 'stops') && (
            <div className="flex-1 overflow-y-auto bg-gray-50/50 p-2 space-y-2">
              {activeTrip.vehicle_routes.map((vr) => (
                <div key={vr.vehicle_id} 
                     className={cn(
                       'rounded-lg bg-white shadow-sm transition-all',
                       activeVehicles.has(vr.vehicle_id) ? 'not-disabled:ring-2 ring-blue-100' : ''
                     )}>
                  <button
                    disabled={activeTrip.total_stops === allActiveTripStops.length}
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
                      {vr.stops
                        .map((stop: StopInfo, idx, stops) => {
                          const isSelected = isStopSelected(stop);
                          const isDepotStart = stop.location_id.startsWith('depot_start_');
                          const isDepotEnd = stop.location_id.startsWith('depot_end_');
                          const isNextStop = !isDepotStart && selectedLocationId && 
                              idx == stops.findIndex(s => s.location_id === selectedLocationId) + 1;
                          
                          return (
                            <div
                              key={`trip-${activeTrip.trip_number}-${activeTrip.day}-stop-${stop.location_id}-vehicle-${vr.vehicle_id}-${idx}`}
                              className={cn(
                                "px-3 py-2 transition-colors cursor-pointer",
                                isSelected
                                  ? isDepotStart
                                    ? "bg-purple-50 text-purple-600 border-purple-600/20"
                                    : "bg-blue-50 text-blue-600 border-blue-600/20"
                                  : isNextStop
                                    ? isDepotEnd
                                      ? "bg-purple-50 text-purple-600 border-purple-600/20"
                                      : "bg-green-50 text-green-600 border-green-600/20"
                                    : "bg-gray-50 text-gray-600 border-gray-50/50"
                              )}
                              onClick={() => {
                                if (isSelected) {
                                  onLocationSelect(null);
                                  return;
                                }  
                                onLocationSelect(stop.location_id);
                              }}
                            >
                              <div className="flex gap-2">
                                <div className="w-8 flex flex-col items-center gap-1">
                                  <div className={cn(
                                    "w-5 h-5 shrink-0 rounded-lg flex items-center justify-center text-xs font-medium border",
                                    isDepotStart
                                      ? "bg-purple-50 text-purple-600 border-purple-600"
                                      : isDepotEnd
                                        ? "bg-purple-50 text-purple-600 border-purple-600/20"
                                        : isSelected
                                          ? "bg-blue-50 text-blue-600 border-blue-600"
                                          : isNextStop
                                            ? "bg-green-50 text-green-600 border-green-600"
                                            : "bg-blue-50 text-blue-600 border-blue-600"
                                  )}>
                                    {isDepotStart ? 'S' : 
                                     isDepotEnd ? 'E' : 
                                     idx + 1}
                                  </div>
                                  {!isDepotStart && stop.distance_from_prev !== undefined && (
                                    <div className="text-[10px] text-gray-500 font-medium">
                                      {stop.distance_from_prev.toFixed(1)}km
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className={cn(
                                    "font-medium text-xs truncate",
                                    isDepotStart || isDepotEnd ? "text-purple-900" :
                                    isSelected ? "text-blue-900" : 
                                    isNextStop ? "text-green-900" :
                                    "text-gray-900"
                                  )}>
                                    {isDepotStart ? 'Depot (Start)' :
                                     isDepotEnd ? 'Depot (End)' :
                                     stop.name}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-xs">
                                    {!isDepotStart && !isDepotEnd ? (
                                      <div className={cn(
                                        "px-1.5 py-0.5 rounded bg-white/50 border",
                                        isSelected ? "text-blue-600 border-blue-200" :
                                        isNextStop ? "text-green-600 border-green-200" :
                                        "text-gray-600 border-gray-200"
                                      )}>
                                        {stop.wco_amount}L
                                      </div>
                                    ) : null}
                                    {!isDepotStart && !isDepotEnd && (
                                      <div className="flex items-center gap-1.5 text-gray-500">
                                        <span>{formatDuration(stop.travel_time || 0)} travel</span>
                                        <span>•</span>
                                        <span>{formatDuration(stop.collection_time || 0)} collect</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ResultsCardContainer>
  );
}
