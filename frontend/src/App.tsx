import ConfigForm from './components/ConfigForm';
import Map from './components/Map';
import { useConfig } from './hooks/useConfig';
import { useLocations } from './hooks/useLocations';
import { useOptimizeRoutes } from './hooks/useOptimizeRoutes';
import { ConfigRequest } from './types/models';

function App() {
  const { visualConfig, solvers, defaultSolver, mapCenter } = useConfig();
  const { locations, addLocation, removeLocation } = useLocations();
  const { routes, isLoading: isOptimizing, generateRoutes } = useOptimizeRoutes();

  const handleConfigSubmit = async (config: ConfigRequest) => {
    try {
      await generateRoutes(config, locations);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to generate routes');
    }
  };

  return (
    <div className="h-screen w-screen relative">
      {/* Full-screen map */}
      <div className="absolute inset-0 z-0">
        {visualConfig ? (
          <Map
            locations={locations}
            depotLocation={mapCenter}
            center={mapCenter}
            routes={routes}
            config={visualConfig.map}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gray-100">
            <div className="text-gray-600">Loading map configuration...</div>
          </div>
        )}
      </div>

      {/* Floating UI elements */}
      <div className="absolute top-4 right-4 z-[1000] pointer-events-none">
        <div className="w-80 space-y-3 pointer-events-auto">
          <ConfigForm 
            onSubmit={handleConfigSubmit} 
            solvers={solvers}
            defaultSolver={defaultSolver}
            locations={locations}
            onAddLocation={addLocation}
            onRemoveLocation={removeLocation}
            isLoading={isOptimizing}
          />
          
          {routes && (
            <div className="bg-white/95 backdrop-blur p-3 rounded-lg shadow-lg max-h-80 overflow-y-auto">
              <h2 className="text-base font-semibold mb-2 border-b pb-1">Results</h2>
              <div className="space-y-3">
                {routes.map((route) => (
                  <div key={route.schedule_id} className="p-2 bg-blue-50/70 rounded-md">
                    <h3 className="font-medium text-sm text-blue-800">{route.schedule_name}</h3>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs mt-1 text-gray-700">
                      <div>Distance:</div><div className="font-medium">{route.total_distance.toFixed(2)} km</div>
                      <div>Collected:</div><div className="font-medium">{route.total_collected.toFixed(2)} L</div>
                      <div>Vehicles:</div><div className="font-medium">{route.vehicle_routes.length}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
