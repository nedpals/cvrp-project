import { create } from 'zustand';
import { RouteResponse } from '../types/models';

interface FilterState {
  activeVehicles: Set<string>;
  activeTrips: Set<number>;
  activeDay: number | null;
  initializeFilters: (routes: RouteResponse[]) => void;
  setActiveDay: (day: number | null) => void;
  setActiveVehicles: (vehicles: Set<string>) => void;
  setActiveTrips: (trips: Set<number>) => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  activeVehicles: new Set(),
  activeTrips: new Set(),
  activeDay: null,
  initializeFilters: (routes) => {
    const days = routes.map(r => r.collection_day);
    set({ activeDay: days[0] || null });
  },
  setActiveDay: (day) => set({ activeDay: day }),
  setActiveVehicles: (vehicles) => set({ activeVehicles: vehicles }),
  setActiveTrips: (trips) => set({ activeTrips: trips }),
}));
