import { RouteResponse, StopInfo } from '../types/models';
import { useFilterStore } from '../stores/filterStore';
import { useConfigStore } from '../stores/configStore';
import { cn } from '../utils/utils';
import { useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';

interface ResultsCardProps {
  routes: RouteResponse[];
  onZoomToLocation: (coordinates: [number, number]) => void;
  onZoomToTrip: (stops: StopInfo[]) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const exportToExcel = (route: RouteResponse) => {
  const workbook = XLSX.utils.book_new();
  
  // Summary sheet
  const summaryData = [
    ['Total Stops', route.total_stops],
    ['Total Distance (km)', route.total_distance],
    ['Total Travel Time', formatDuration(route.total_travel_time)],
    ['Total Vehicles', route.total_vehicles],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Vehicle routes sheet
  const routesData = [['Vehicle ID', 'Stop Number', 'Location Name', 'Collection Amount (L)', 'Trip Number']];
  route.vehicle_routes.forEach(vr => {
    vr.stops.forEach(stop => {
      routesData.push([
        vr.vehicle_id,
        JSON.stringify(stop.sequence_number + 1),
        stop.name,
        JSON.stringify(stop.wco_amount),
        JSON.stringify(stop.trip_number)
      ]);
    });
  });
  const routesSheet = XLSX.utils.aoa_to_sheet(routesData);
  XLSX.utils.book_append_sheet(workbook, routesSheet, 'Routes');

  // Save the file
  XLSX.writeFile(workbook, `route_export_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export default function ResultsCard({ 
  routes, 
  onZoomToLocation,
  onZoomToTrip,
  isLoading,
  error,
  onRetry
}: ResultsCardProps) {
  const {
    activeVehicles,
    activeTrip,
    setActiveVehicles,
    setActiveTrip,
  } = useFilterStore();
  const { depotLat, depotLng } = useConfigStore();
  const currentRoute = useMemo(() => routes.length !== 0 ? routes[0] : null, [routes]);

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
  
  const totalWco = useMemo(() => {
    if (!currentRoute) return 0;
    return currentRoute.vehicle_routes.reduce((total, vr) => {
      return total + vr.stops.reduce((stopTotal, stop) => stopTotal + stop.wco_amount, 0);
    }, 0);
  }, [currentRoute]);

  useEffect(() => {
    console.log(currentRoute);
    if (activeTrip && currentRoute) {
      const tripStops = currentRoute.vehicle_routes
        .flatMap(vr => vr.stops)
        .filter(stop => stop.trip_number === activeTrip);
      onZoomToTrip(tripStops);
    }
  }, [activeTrip, currentRoute]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 h-full">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-4 h-full">
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <div className="text-red-500">Error: {error}</div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!currentRoute) return null;

  return (
    <div className="bg-white/95 backdrop-blur-md shadow-lg rounded-xl h-[calc(100vh-2rem)] flex flex-col overflow-hidden text-sm border border-gray-200/50">
      {/* Card Header */}
      <div className="px-3 py-2 border-b border-gray-100 bg-white sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <h1 className="font-semibold text-gray-900">Results</h1>
          <button
            onClick={() => currentRoute && exportToExcel(currentRoute)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            Export Route
          </button>
        </div>
      </div>

      {/* Trip Filter */}
      <div className="px-3 py-2.5 border-b border-gray-50/80 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex gap-1.5 flex-wrap items-center">
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
        <div className="flex flex-wrap gap-2 text-xs">
          <div className="relative bg-gradient-to-b from-green-50 to-white p-2.5 rounded-lg shadow-sm border border-green-100 w-full">
            <div className="flex flex-col relative z-10">
              <span className="text-gray-500 mb-0.5">WCO Collected</span>
              <span className="font-semibold text-gray-900 text-sm">{totalWco.toFixed(1)}L</span>
            </div>
          </div>
          <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100 flex-1 min-w-[120px]">
            <div className="flex flex-col">
              <span className="text-gray-500 mb-0.5">Total Stops</span>
              <span className="font-semibold text-gray-900">{currentRoute.total_stops}</span>
            </div>
          </div>
          <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100 flex-1 min-w-[120px]">
            <div className="flex flex-col">
              <span className="text-gray-500 mb-0.5">Distance</span>
              <span className="font-semibold text-gray-900">{currentRoute.total_distance.toFixed(1)}km</span>
            </div>
          </div>
          <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100 flex-1 min-w-[120px]">
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
