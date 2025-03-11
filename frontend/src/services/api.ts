import { ConfigRequest, Location, RouteResponse, SolverInfo } from '../types/models';
import { VisualizationConfig } from '../types/config';

const API_BASE_URL = 'http://localhost:8000/api';

// Fetch functions
export async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${url}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  return response.json();
}

// Visualization config
export const getVisualizationConfig = () => 
  fetcher<VisualizationConfig>('/config/visualization');

// Solvers
export const getSolvers = () => 
  fetcher<{ solvers: SolverInfo[] }>('/solvers');

// Download configuration as JSON file
export const downloadConfigAsJson = (config: ConfigRequest) => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "schedule_config.json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};

// Create a key generator for route optimization
export const getOptimizeRoutesKey = (config: ConfigRequest, scheduleId: string) => 
  `/optimize?config=${JSON.stringify(config)}&scheduleId=${scheduleId}`;

// Mutations
export const optimizeRoutes = async (
  config: ConfigRequest, 
  locations: Location[]
): Promise<RouteResponse[]> => {
  const response = await fetch(`${API_BASE_URL}/optimize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ config, locations }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to optimize routes');
  }
  
  return response.json();
};
