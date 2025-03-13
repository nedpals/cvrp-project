import useSWR from 'swr';
import { ConfigRequest, Location, RouteResponse } from '../types/models';
import { optimizeRoutes, getOptimizeRoutesKey } from '../services/api';

export function useOptimizeRoutes() {
  const routesCache = new Map<string, RouteResponse[]>();
  const { data: routes, isLoading, mutate } = useSWR<RouteResponse[]>('/optimize', null);

  const generateRoutes = async (config: ConfigRequest, locations: Location[], scheduleId: string) => {
    const finalConfig = {
      ...config,
      vehicles: config.vehicles.map(vehicle => ({
        ...vehicle,
        depot_location: config.depot_location
      })),
    }
    const cacheKey = getOptimizeRoutesKey(finalConfig, scheduleId);
    
    // Check if we have this result cached
    if (routesCache.has(cacheKey)) {
      const cachedResult = routesCache.get(cacheKey)!;
      await mutate(cachedResult);
      return cachedResult;
    }

    try {
      const result = await optimizeRoutes(finalConfig, locations);
      routesCache.set(cacheKey, result);
      await mutate(result);
      return result;
    } catch (error) {
      console.error('Failed to optimize routes:', error);
      throw error;
    }
  };

  const switchToSchedule = async (scheduleId: string) => {
    // Find cached result for this schedule
    const cacheEntry = Array.from(routesCache.entries()).find(([key]) => 
      key.includes(`scheduleId=${scheduleId}`)
    );

    if (cacheEntry) {
      await mutate(cacheEntry[1]);
      return cacheEntry[1];
    }
    return null;
  };

  return {
    routes,
    isLoading,
    generateRoutes,
    switchToSchedule,
  };
}
