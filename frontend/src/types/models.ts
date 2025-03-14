export type Coordinates = [number, number];

export interface RawLocation {
    id: string;
    name: string;
    latitude: string;
    longitude: string;
    wco_amount: string;
    disposal_schedule: string;
}

export interface Location {
    id: string;
    id_num: number;
    name: string;
    coordinates: Coordinates;
    wco_amount: number;
    disposal_schedule: number;
}

export interface Vehicle {
    id: string;
    capacity: number;
    depot_location: [number, number];
}

export interface ScheduleEntry {
    id: string;
    name: string;
    frequency: number;
    file: string;
    description?: string;
    color?: string;
}

export interface ConfigRequest {
    depot_location: [number, number];
    vehicles: Vehicle[];
    schedules: ScheduleEntry[];  // Changed from schedules array to single schedule
    one_way_roads: [number, number][][];
    solver: string;
    allow_multiple_trips: boolean;
}

export interface StopInfo {
    name: string;
    location_id: string;
    coordinates: Coordinates;
    wco_amount: number;
    trip_number: number;
    cumulative_load: number;
    remaining_capacity: number;
    distance_from_depot: number;
    distance_from_prev: number;
    vehicle_capacity: number;
    sequence_number: number;
    collection_day: number;
    collection_time: number;    // Collection time in seconds
    travel_time: number;        // Travel time in seconds
}

export interface RoadPath {
    from_idx: number;
    to_idx: number;
    from_coords: Coordinates;
    to_coords: Coordinates;
    path: Coordinates[];
}

export interface RoutePathInfo {
    from_coords: [number, number];
    to_coords: [number, number];
    path: number[][];
    trip_number: number;
    travel_time_minutes: number;
}

export interface VehicleRouteInfo {
    vehicle_id: string;
    capacity: number;
    total_stops: number;
    total_trips: number;
    total_distance: number;
    total_collected: number;
    efficiency: number;
    collection_day: number;
    stops: StopInfo[];
    road_paths: Record<string, RoadPath>[];
    combined_path: RoutePathInfo[];
    trip_paths: { [key: number]: RoutePathInfo[] };
    total_collection_time: number;  // Total collection time in seconds
    total_travel_time: number;      // Total travel time in seconds
}

export interface RouteResponse {
    schedule_id: string;
    schedule_name: string;
    date_generated: string;
    total_stops: number;
    total_trips: number;
    total_locations: number;
    total_vehicles: number;
    total_distance: number;
    total_collected: number;
    collection_day: number;
    vehicle_routes: VehicleRouteInfo[];
    base_schedule_id: string;
    base_schedule_day: number;
    total_collection_time: number;  // Total collection time in seconds
    total_travel_time: number;      // Total travel time in seconds
}

export interface SolverInfo {
    id: string;
    name: string;
    description: string;
}

export interface FrequencyPreset {
    label: string;
    value: number;
}

export const FREQUENCY_PRESETS: FrequencyPreset[] = [
    { value: 1, label: 'Daily (1 day)' },
    { value: 2, label: 'Every 2 days' },
    { value: 3, label: 'Every 3 days' },
    { value: 7, label: 'Weekly (7 days)' },
    { value: 14, label: 'Biweekly (14 days)' },
    { value: 30, label: 'Monthly (30 days)' },
    { value: -1, label: 'Custom...' }
];

export const TRAFFIC_CONSTANTS = {
    AVERAGE_SPEED_KPH: 30,
} as const;
