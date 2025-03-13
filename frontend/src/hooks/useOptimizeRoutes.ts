import useSWR from 'swr';
import { ConfigRequest, Location, RouteResponse } from '../types/models';
import { optimizeRoutes } from '../services/api';

export function useOptimizeRoutes() {
  const { data: routes, isLoading, mutate } = useSWR<RouteResponse[]>('/optimize', null);

  const generateRoutes = async (config: ConfigRequest, locations: Location[]) => {
    const finalConfig = {
      ...config,
      vehicles: config.vehicles.map(vehicle => ({
        ...vehicle,
        depot_location: config.depot_location
      })),
    }

    try {
      const result = await optimizeRoutes(finalConfig, locations);
      await mutate(result);
      return result;
    } catch (error) {
      console.error('Failed to optimize routes:', error);
      throw error;
    }
  };

  return {
    routes,
    isLoading,
    generateRoutes,
  };
}
