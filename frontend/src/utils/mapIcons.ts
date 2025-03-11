import L from 'leaflet';
import 'leaflet.awesome-markers';

// Make sure to include the CSS in your project:
import 'leaflet.awesome-markers/dist/leaflet.awesome-markers.css';

/**
 * Create a depot marker (using a home icon)
 */
export const createDepotMarker = () => {
  return L.AwesomeMarkers.icon({
    icon: 'home',
    markerColor: 'red',
    prefix: 'fa',
    iconColor: 'white'
  });
};

/**
 * Create a location marker (using an oil can icon)
 */
export const createLocationMarker = (color: string = 'blue') => {
  return L.AwesomeMarkers.icon({
    icon: 'info',
    markerColor: color as keyof L.AwesomeMarkers.AwesomeMarkersIconOptions['markerColor'],
    prefix: 'fa',
    iconColor: 'white'
  });
};

/**
 * Create a custom marker with a specific icon and color
 */
export const createCustomMarker = (icon: string, color: string) => {
  return L.AwesomeMarkers.icon({
    icon,
    markerColor: color as keyof L.AwesomeMarkers.AwesomeMarkersIconOptions['markerColor'],
    prefix: 'fa',
    iconColor: 'white'
  });
};
