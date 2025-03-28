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
    const vehicles = new Set<string>();
    
    // If there's only one vehicle, always add it
    if (route.vehicle_routes.length === 1) {
      vehicles.add(route.vehicle_routes[0].vehicle_id);
    }
    
    set({ 
      activeVehicles: vehicles, 
      activeTrip: getActiveTripFromRouteInfo(route, 1)
    });
  },
}));
