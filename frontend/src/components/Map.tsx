import { Point } from 'leaflet';
import { forwardRef, useImperativeHandle } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents, Polyline } from 'react-leaflet';
import { MapRef, MapData } from '../types/map';
import { Coordinates } from '../types/models';
import { createCustomMarker, createDepotMarker } from '../utils/mapIcons';

import 'leaflet.awesome-markers/dist/leaflet.awesome-markers.css';
import 'leaflet/dist/leaflet.css';

interface MapConfig {
    zoom_level: number;
    path_weight: number;
    path_opacity: number;
}

interface MapProps {
    center: Coordinates;
    config: MapConfig;
    data?: MapData;
    onClick?: (lat: number, lng: number) => void;
}

const MapClickHandler = ({ onClick }: { onClick?: (lat: number, lng: number) => void }) => {
    useMapEvents({
        click: (e) => {
            onClick?.(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
};

const MapController = forwardRef<MapRef, unknown>((_, ref) => {
    const map = useMap();

    useImperativeHandle(ref, () => ({
        zoomTo: (coordinates: [number, number], zoom: number, offset?: { x: number, y: number }) => {
            // Calculate target point with offset before zooming
            const targetPoint = map.project(coordinates, zoom);
            if (offset) {
                targetPoint.x += offset.x;
            }
            const targetLatLng = map.unproject(targetPoint, zoom);
            
            // Use flyTo for smooth animation and better UX
            map.flyTo(targetLatLng, zoom, {
                duration: 0.5 // seconds
            });
        },
        fitBounds: (coordinates: [number, number][], padding?: { x: number, y: number }) => {
            if (coordinates.length === 0) return;
            
            // Create bounds from coordinates
            const bounds = coordinates.reduce((bounds, coord) => {
                return bounds.extend(coord);
            }, map.getBounds().pad(-0.9)); // Start with a small initial bounds
            
            // Calculate center and zoom that would fit these bounds
            const center = bounds.getCenter();
            const zoom = map.getBoundsZoom(bounds, false, new Point(padding?.x || 0, padding?.y || 0));
            
            // Smoothly fly to the new view
            if (padding) {
                map.setView(center, zoom, {
                    duration: 0.5,
                });
            } else {
                map.flyTo(center, zoom, {
                    duration: 0.5
                });
            }
        }
    }));

    return null;
});

const Map = forwardRef<MapRef, MapProps>(({ 
    center, 
    config,
    data,
    onClick
}, ref) => {
    return (
        <MapContainer
            center={center}
            zoom={config.zoom_level}
            className="h-full w-full z-0"
        >
            <MapController ref={ref} />
            {onClick && <MapClickHandler onClick={onClick} />}
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {/* Markers */}
            {data?.markers?.map((marker) => (
                <Marker
                    key={marker.id}
                    position={marker.position}
                    icon={marker.icon === 'depot' 
                        ? createDepotMarker() 
                        : createCustomMarker('circle', marker.color || 'gray')
                    }
                >
                    {marker.popup && <Popup>{marker.popup}</Popup>}
                </Marker>
            ))}

            {/* Paths */}
            {data?.paths?.map((path) => (
                <Polyline
                    key={path.id}
                    positions={path.points}
                    pathOptions={{
                        color: path.color || '#3388ff',
                        weight: path.weight || config.path_weight,
                        opacity: path.opacity || config.path_opacity
                    }}
                />
            ))}
        </MapContainer>
    );
});

export default Map;
