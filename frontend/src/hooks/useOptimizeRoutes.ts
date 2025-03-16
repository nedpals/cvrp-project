import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { ConfigRequest, Location, RouteResponse } from '../types/models';
import { optimizeRoutes } from '../services/api';

export function useOptimizeRoutes() {
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<{
    config: ConfigRequest;
    locations: Location[];
  } | null>(null);

  const { data: routes, isLoading, mutate } = useSWR<RouteResponse[]>('/optimize', null);

  const generateRoutes = async (config: ConfigRequest, locations: Location[]) => {
    setError(null);
    setLastRequest({ config, locations });

    const finalConfig = {
      ...config,
      vehicles: config.vehicles.map(vehicle => ({
        ...vehicle,
        depot_location: config.depot_location
      })),
      schedules: [config.schedules[0]] // Only use the first schedule
    }

    try {
      const result = await optimizeRoutes(finalConfig, locations);
      await mutate(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to optimize routes';
      setError(errorMessage);
      throw error;
    }
  };

  const retry = useCallback(async () => {
    if (!lastRequest) return;
    
    try {
      await generateRoutes(lastRequest.config, lastRequest.locations);
    } catch (error) {
      console.error('Retry failed:', error);
    }
  }, [lastRequest]);

  return {
    routes,
    isLoading,
    error,
    generateRoutes,
    retry,
  };
}
