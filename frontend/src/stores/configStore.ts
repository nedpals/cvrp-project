import { create } from 'zustand';
import { produce } from 'immer';
import { ConfigRequest, ScheduleEntry, Vehicle, Location, VehicleConfig, SolveConfig } from '../types/models';
import { downloadConfigAsJson, getDefaultConfig } from '../services/api';

interface ConfigState {
  config: ConfigRequest;
  isLoading: boolean;
  error: string | null;

  // Actions
  setSolver: (solver: string) => void;
  setDepotLocation: (lat: number, lng: number) => void;
  addVehicle: () => void;
  removeVehicle: (index: number) => void;
  updateVehicle: (vehicle: VehicleConfig) => void;
  setVehicles: (vehicles: Vehicle[]) => void;
  addOneWayRoad: () => void;
  updateOneWayRoad: (index: number, pointIndex: number, coordIndex: number, value: string) => void;
  removeOneWayRoad: (index: number) => void;
  exportConfig: () => void;
  importConfig: (config: ConfigRequest) => void;
  loadDefaultConfig: () => Promise<void>;
  setSchedules: (schedules: ScheduleEntry[]) => void;
  addSchedule: (schedule: ScheduleEntry) => void;
  updateSchedule: (schedule: ScheduleEntry) => void;
  removeSchedule: (scheduleId: string) => void;

  // Location actions
  addLocation: (location: Location) => void;
  updateLocation: (location: Location) => void;
  removeLocation: (locationId: string) => void;
  setLocations: (locations: Location[]) => void;

  updateSettings: (settings: SolveConfig) => void;
}

const defaultConfig: ConfigRequest = {
  map: {
    center: [7.06427, 125.60566],
    zoom_level: 13,
    path_weight: 5,
    path_opacity: 0.6
  },
  settings: {
    solver: 'schedule',
    vehicles: [],
    depot_location: [7.06427, 125.60566],
    constraints: {
      one_way_roads: []
    },
    max_daily_time: 7 * 60, // in minutes
    average_speed_kph: 30.0
  },
  schedules: [],
  locations: []
};

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: defaultConfig,
  isLoading: false,
  error: null,

  setSolver: (solver) => set(
    produce((state) => {
      state.config.settings.solver = solver;
    })
  ),

  setDepotLocation: (lat, lng) => set(
    produce((state) => {
      state.config.settings.depot_location = [lat, lng];
      state.config.map.center = [lat, lng];
    })
  ),

  addVehicle: () => set(
    produce((state) => {
      const newVehicle = {
        id: `vehicle_${state.config.settings.vehicles.length + 1}`,
        capacity: 1000,
        depot_location: state.config.settings.depot_location
      };
      state.config.settings.vehicles.push(newVehicle);
    })
  ),

  removeVehicle: (index) => set(
    produce((state) => {
      state.config.settings.vehicles.splice(index, 1);
    })
  ),

  updateVehicle: (vehicle: VehicleConfig) => set(
    produce((state: ConfigState) => {
      const index = state.config.settings.vehicles.findIndex(v => v.id === vehicle.id);
      if (index !== -1) {
        state.config.settings.vehicles[index] = vehicle;
      }
    })
  ),

  setVehicles: (vehicles) => set(
    produce((state) => {
      state.config.settings.vehicles = vehicles;
    })
  ),

  addOneWayRoad: () => set(
    produce((state) => {
      state.config.settings.constraints.one_way_roads.push([[0, 0], [0, 0]]);
    })
  ),

  updateOneWayRoad: (index, pointIndex, coordIndex, value) => set(
    produce((state) => {
      state.config.settings.constraints.one_way_roads[index][pointIndex][coordIndex] = parseFloat(value);
    })
  ),

  removeOneWayRoad: (index) => set(
    produce((state) => {
      state.config.settings.constraints.one_way_roads.splice(index, 1);
    })
  ),

  exportConfig: () => {
    const { config } = get();
    downloadConfigAsJson(config);
  },

  importConfig: (config) => set(
    produce((state: ConfigState) => {
      state.config = {
        map: {
          ...defaultConfig.map,
          ...config.map
        },
        settings: {
          ...defaultConfig.settings,
          ...config.settings,
          vehicles: config.settings?.vehicles || defaultConfig.settings.vehicles,
          constraints: {
            ...defaultConfig.settings.constraints,
            ...config.settings?.constraints,
            one_way_roads: config.settings?.constraints?.one_way_roads || defaultConfig.settings.constraints.one_way_roads
          }
        },
        schedules: config.schedules || defaultConfig.schedules,
        locations: config.locations || defaultConfig.locations
      };
    })
  ),

  loadDefaultConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const config = await getDefaultConfig();
      set({ config, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  setSchedules: (schedules) => set(
    produce((state) => {
      state.config.schedules = schedules;
    })
  ),

  addSchedule: (schedule) => set(
    produce((state) => {
      state.config.schedules.push(schedule);
    })
  ),

  updateSchedule: (schedule) => set(
    produce((state: ConfigState) => {
      const index = state.config.schedules.findIndex(s => s.id === schedule.id);
      if (index !== -1) {
        state.config.schedules[index] = schedule;
      }
    })
  ),

  removeSchedule: (scheduleId) => set(
    produce((state: ConfigState) => {
      state.config.schedules = state.config.schedules.filter(s => s.id !== scheduleId);
    })
  ),

  // Location actions
  addLocation: (location) => set(
    produce((state) => {
      state.config.locations.push(location);
    })
  ),

  updateLocation: (location) => set(
    produce((state: ConfigState) => {
      const index = state.config.locations.findIndex(l => l.id === location.id);
      if (index !== -1) {
        state.config.locations[index] = location;
      }
    })
  ),

  removeLocation: (locationId) => set(
    produce((state: ConfigState) => {
      state.config.locations = state.config.locations.filter(l => l.id !== locationId);
    })
  ),

  setLocations: (locations) => set(
    produce((state: ConfigState) => {
      state.config.locations = locations;
    })
  ),

  updateSettings: (settings: SolveConfig) =>
    set(state => ({
      config: {
        ...state.config,
        settings: {
          ...settings,
          average_speed_kph: settings.average_speed_kph || 30.0,  // Ensure default value
        }
      }
    })),
}));
