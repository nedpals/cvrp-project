import { LayerGroup, Polyline } from 'react-leaflet';
import { VehicleRouteInfo } from '../types/models';
import { useFilterStore } from '../stores/filterStore';
import { LatLngTuple } from 'leaflet';

interface RoutePathLayerProps {
  vehicleRoute: VehicleRouteInfo;
  color: string;
}

export default function RoutePathLayer({ vehicleRoute, color }: RoutePathLayerProps) {
  const { activeTrips } = useFilterStore();

  // If no trips are selected, show combined path
  if (activeTrips.size === 0 && vehicleRoute.combined_path) {
    return (
      <LayerGroup>
        {vehicleRoute.combined_path.map((pathInfo) => (
          <Polyline
            positions={pathInfo.path as LatLngTuple[]}
            color={color}
            weight={2}
            opacity={0.8}
          />
        ))}
      </LayerGroup>
    );
  }

  // Show only selected trip paths
  return (
    <LayerGroup>
      {Object.entries(vehicleRoute.trip_paths).map(([tripNum, paths]) => {
        const tripNumber = parseInt(tripNum);
        if (!activeTrips.has(tripNumber)) return null;

        return paths.map((pathInfo, idx) => (
          <Polyline
            key={`trip-${tripNumber}-${idx}`}
            positions={pathInfo.path as LatLngTuple[]}
            color={color}
            weight={2}
            opacity={0.8}
          />
        ));
      })}
    </LayerGroup>
  );
}
