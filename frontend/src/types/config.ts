export interface VisualizationConfig {
    map: {
        center: [number, number];
        zoom_level: number;
        path_weight: number;
        path_opacity: number;
    };
    solver: {
        default: string;
    };
}

export interface ScheduleEntry {
    id: string;
    name: string;
    file: string;
    description: string;
    color: string;
    frequency: number;
}

export interface VehicleConfig {
    id: string;
    capacity: number;
}

export interface ScheduleConfig {
    schedules: ScheduleEntry[];
    vehicles: VehicleConfig[];
    depot_location: [number, number];
    one_way_roads: [[number, number], [number, number]][];
    visualization: {
        zoom_level: number;
        path_weight: number;
        path_opacity: number;
    };
}
