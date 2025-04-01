export type Coordinates = [number, number];

export interface VehicleConfig {
    id: string;
    capacity: number;
}

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
    collection_time_minutes: number;
}

export interface ScheduleTemplate {
    name: string;
    frequency: number;
}

export const SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
    { name: 'Daily Collection', frequency: 1 },
    { name: 'Bi-daily Collection', frequency: 2 },
    { name: 'Weekly Collection', frequency: 7 },
    { name: 'Bi-weekly Collection', frequency: 14 },
    { name: 'Monthly Collection', frequency: 30 },
];

export interface MapConfig {
  center?: [number, number];
  zoom_level: number;
  path_weight: number;
  path_opacity: number;
}

export interface SolveConfig {
  solver: string;
  vehicles: VehicleConfig[];
  depot_location: [number, number];
  average_speed_kph: number;
  constraints: {
    one_way_roads: [number, number][][];
  };
}

export interface ConfigRequest {
  map: MapConfig;
  settings: SolveConfig;
  schedules: ScheduleEntry[];
  locations: Location[];
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
    path: [number, number][];
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

export interface ActiveTrip {
    schedule_id: string;
    trip_number: number;
    day: number;
    total_stops: number;
    total_distance: number;
    total_collected: number;
    total_collection_time: number;
    total_travel_time: number;
    vehicle_routes: VehicleRouteInfo[];
}

export const getActiveTripFromRouteInfo = (route: RouteResponse, tripNumber: number): ActiveTrip => {
    const vehicleRoutes = route.vehicle_routes.map(vr => ({ ...vr, stops: vr.stops.filter(stop => stop.trip_number === tripNumber) }));
    const stops = vehicleRoutes.flatMap(vr => vr.stops);
    const totalStops = stops.length;
    const totalDistance = stops.reduce((acc, stop) => acc + stop.distance_from_prev, 0);
    const totalCollected = stops.reduce((acc, stop) => acc + stop.wco_amount, 0);
    const totalCollectionTime = stops.reduce((acc, stop) => acc + stop.collection_time, 0);
    const totalTravelTime = vehicleRoutes.reduce((acc, vr) => acc + vr.total_travel_time, 0);

    return {
        schedule_id: route.schedule_id,
        trip_number: tripNumber,
        day: route.collection_day - route.base_schedule_day,
        total_stops: totalStops,
        total_distance: totalDistance,
        total_collected: totalCollected,
        total_collection_time: totalCollectionTime,
        total_travel_time: totalTravelTime,
        vehicle_routes: vehicleRoutes,
    };
};
    
export const FREQUENCY_PRESETS: FrequencyPreset[] = [
    { value: 1, label: 'Daily (1 day)' },
    { value: 2, label: 'Every 2 days' },
    { value: 3, label: 'Every 3 days' },
    { value: 7, label: 'Weekly (7 days)' },
    { value: 14, label: 'Biweekly (14 days)' },
    { value: 30, label: 'Monthly (30 days)' },
    { value: -1, label: 'Custom...' }
];
