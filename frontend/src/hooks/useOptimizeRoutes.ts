import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { ConfigRequest, Location, RouteResponse } from '../types/models';
import { optimizeRoutes } from '../services/api';

export function useOptimizeRoutes() {
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastRequest, setLastRequest] = useState<{
    config: ConfigRequest;
    locations: Location[];
  } | null>(null);

  const { data: routes, mutate } = useSWR<RouteResponse[]>('/optimize', null, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 0
  });

  const generateRoutes = async (config: ConfigRequest, locations: Location[]) => {
    setError(null);
    setIsGenerating(true);
    setLastRequest({ config, locations });

    const finalConfig = {
      ...config,
      settings: {
        ...config.settings,
        vehicles: config.settings.vehicles.map(vehicle => ({
          ...vehicle,
          depot_location: config.settings.depot_location
        }))
      },
      schedules: [config.schedules[0]] // Only use the first schedule
    };

    try {
      const result = await optimizeRoutes(finalConfig, locations);
      await mutate(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to optimize routes';
      setError(errorMessage);
      throw error;
    } finally {
      setIsGenerating(false);
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
    isLoading: isGenerating,
    error,
    generateRoutes,
    retry,
  };
}
