import { TRAFFIC_CONSTANTS } from '../types/models';

export const calculateTravelTime = (distanceKm: number): number => {
    return (distanceKm / TRAFFIC_CONSTANTS.AVERAGE_SPEED_KPH) * 60;
};

export const formatTravelTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};
