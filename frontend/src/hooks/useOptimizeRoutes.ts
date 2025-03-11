import { useState } from 'react';
import { mutate } from 'swr';
import { ConfigRequest, Location, RouteResponse } from '../types/models';
import { optimizeRoutes } from '../services/api';

export function useOptimizeRoutes() {
  const [routes, setRoutes] = useState<RouteResponse[] | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generateRoutes = async (config: ConfigRequest, locations: Location[]) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await optimizeRoutes(config, locations);
      setRoutes(result);
      
      // Update any cached data if needed
      mutate('/optimize', result, false);
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to optimize routes'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    routes,
    isLoading,
    error,
    generateRoutes,
    clearRoutes: () => setRoutes(undefined)
  };
}
