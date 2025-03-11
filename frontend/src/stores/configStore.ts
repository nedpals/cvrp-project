import { create } from 'zustand';
import { ConfigRequest, Coordinates } from '../types/models';
import { downloadConfigAsJson } from '../services/api';

interface ConfigState {
  depotLat: string;
  depotLng: string;
  solver: string;
  oneWayRoads: Coordinates[][];
  setDepotLat: (lat: string) => void;
  setDepotLng: (lng: string) => void;
  setSolver: (solver: string) => void;
  addOneWayRoad: () => void;
  updateOneWayRoad: (index: number, pointIndex: number, coordIndex: number, value: string) => void;
  removeOneWayRoad: (index: number) => void;
  exportConfig: () => void;
  importConfig: (config: ConfigRequest) => void;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  depotLat: '7.06427',
  depotLng: '125.60566',
  solver: 'schedule',
  oneWayRoads: [],

  setDepotLat: (lat) => set({ depotLat: lat }),
  setDepotLng: (lng) => set({ depotLng: lng }),
  setSolver: (solver) => set({ solver }),

  addOneWayRoad: () => set((state) => ({
    oneWayRoads: [...state.oneWayRoads, [[0, 0], [0, 0]]]
  })),

  updateOneWayRoad: (index, pointIndex, coordIndex, value) => set((state) => {
    const newRoads = [...state.oneWayRoads];
    newRoads[index][pointIndex][coordIndex] = parseFloat(value);
    return { oneWayRoads: newRoads };
  }),

  removeOneWayRoad: (index) => set((state) => ({
    oneWayRoads: state.oneWayRoads.filter((_, i) => i !== index)
  })),

  exportConfig: () => {
    const { depotLat, depotLng, solver, oneWayRoads } = get();
    downloadConfigAsJson({
      depot_location: [parseFloat(depotLat), parseFloat(depotLng)],
      solver,
      one_way_roads: oneWayRoads,
      vehicles: [],
      schedules: [],
      allow_multiple_trips: false
    });
  },

  importConfig: (config) => {
    if (config.depot_location && Array.isArray(config.depot_location)) {
      set({
        depotLat: config.depot_location[0].toString(),
        depotLng: config.depot_location[1].toString()
      });
    }
    if (config.solver) {
      set({ solver: config.solver });
    }
    if (config.one_way_roads) {
      set({ oneWayRoads: config.one_way_roads });
    }
  }
}));
