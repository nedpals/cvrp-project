import { create } from 'zustand';
import { ActiveTrip, getActiveTripFromRouteInfo, RouteResponse } from '../types/models';

interface FilterState {
  activeVehicles: Set<string>;
  activeTrip: ActiveTrip | null;
  setActiveVehicles: (vehicles: Set<string>) => void;
  setActiveTrip: (trip: ActiveTrip | null) => void;
  initializeFilters: (route: RouteResponse) => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  activeVehicles: new Set(),
  activeTrip: null,
  setActiveVehicles: (vehicles) => set({ activeVehicles: vehicles }),
  setActiveTrip: (trip) => set({ activeTrip: trip }),
  initializeFilters: (route) => {
    if (route.trips.length === 0) return;
    
    const vehicles = new Set<string>();
    const firstTrip = route.trips[0];
    
    // If there's only one vehicle, always add it
    if (firstTrip.vehicle_routes.length === 1) {
      vehicles.add(firstTrip.vehicle_routes[0].vehicle_id);
    }
    
    set({ 
      activeVehicles: vehicles, 
      activeTrip: getActiveTripFromRouteInfo(route, 1)
    });
  },
}));
