import { create } from 'zustand';
import { RouteResponse } from '../types/models';

interface FilterState {
  activeVehicles: Set<string>;
  activeTrips: Set<number>;
  activeSchedule: string | null;
  setActiveSchedule: (scheduleId: string) => void;
  toggleVehicle: (vehicleId: string) => void;
  toggleTrip: (tripNumber: number) => void;
  selectAll: (routes: RouteResponse[]) => void;
  clearAll: () => void;
  initializeFilters: (routes: RouteResponse[], currentSchedule: string | null) => void;
  toggleAllTrips: (route: RouteResponse) => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  activeVehicles: new Set(),
  activeTrips: new Set(),
  activeSchedule: null,

  setActiveSchedule: (scheduleId) => set({ activeSchedule: scheduleId }),

  toggleVehicle: (vehicleId) => set((state) => {
    const next = new Set(state.activeVehicles);
    if (next.has(vehicleId)) next.delete(vehicleId);
    else next.add(vehicleId);
    return { activeVehicles: next };
  }),

  toggleTrip: (tripNumber) => set((state) => {
    const next = new Set<number>();
    // If clicking the same trip that's already selected, clear it
    // Otherwise, select only this trip
    if (state.activeTrips.size === 1 && state.activeTrips.has(tripNumber)) {
      return { activeTrips: next };
    } else {
      next.add(tripNumber);
      return { activeTrips: next };
    }
  }),

  selectAll: (routes) => set(() => {
    const vehicles = new Set<string>();
    const trips = new Set<number>();
    routes.forEach(route => {
      route.vehicle_routes.forEach(vr => {
        vehicles.add(vr.vehicle_id);
        vr.stops.forEach(stop => trips.add(stop.trip_number));
      });
    });
    return { activeVehicles: vehicles, activeTrips: trips };
  }),

  clearAll: () => set({ activeVehicles: new Set(), activeTrips: new Set() }),

  initializeFilters: (routes, currentSchedule) => set(() => {
    const vehicles = new Set<string>();
    const trips = new Set<number>();
    let scheduleId = currentSchedule;

    if (routes.length > 0 && !currentSchedule) {
      scheduleId = routes[0].schedule_id;
    }

    routes.forEach(route => {
      if (scheduleId === route.schedule_id) {
        route.vehicle_routes.forEach(vr => {
          vehicles.add(vr.vehicle_id);
          vr.stops.forEach(stop => trips.add(stop.trip_number));
        });
      }
    });

    return {
      activeVehicles: vehicles,
      activeTrips: trips,
      activeSchedule: scheduleId
    };
  }),

  toggleAllTrips: (route) => set((state) => {
    const allTripNumbers = new Set<number>();
    route.vehicle_routes.forEach(vr => {
      vr.stops.forEach(stop => allTripNumbers.add(stop.trip_number));
    });

    // If all trips are currently selected, clear them
    // Otherwise, select all trips
    if (state.activeTrips.size === Array.from(allTripNumbers).length &&
        Array.from(allTripNumbers).every(trip => state.activeTrips.has(trip))) {
      return { activeTrips: new Set() };
    } else {
      return { activeTrips: allTripNumbers };
    }
  }),
}));
