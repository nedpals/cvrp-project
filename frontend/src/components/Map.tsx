import { forwardRef, useImperativeHandle, useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents, Polyline } from 'react-leaflet';
import { MapRef, MapData } from '../types/map';
import { Coordinates } from '../types/models';
import { createCustomMarker, createDepotMarker } from '../utils/mapIcons';
import L, { LatLngExpression } from 'leaflet';
import 'leaflet-polylinedecorator';

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
        zoomTo: (coordinates: [number, number], zoom = 16, offset?: { x: number, y: number }) => {
            const targetPoint = map.project(coordinates, zoom);
            if (offset) {
                targetPoint.x += offset.x;
            }
            const targetLatLng = map.unproject(targetPoint, zoom);
            map.flyTo(targetLatLng, zoom, {
                duration: 0.5
            });
        },
        fitBounds: (coordinates: [number, number][], padding?: { x: number, y: number }) => {
            if (coordinates.length === 0) return;

            const bounds = coordinates.reduce((bounds, coord) => {
                return bounds.extend(coord);
            }, L.latLng(coordinates[0]).toBounds(0));
            
            const paddingOptions = padding ? {
                paddingTopLeft: [padding.x, padding.y] as [number, number],
            } : undefined;
            
            map.fitBounds(bounds, {
                duration: 0.5,
                maxZoom: 14,
                animate: true,
                ...paddingOptions
            });
        }
    }));

    return null;
});

const PathDecorator = ({ points, color, opacity }: { 
    points: LatLngExpression[],
    color: string,
    opacity: number 
}) => {
    const map = useMap();

    useEffect(() => {
        const decorator = L.polylineDecorator(L.polyline(points), {
            patterns: [
                {
                    offset: '25%',
                    repeat: 50,
                    symbol: L.Symbol.arrowHead({
                        pixelSize: 15,
                        pathOptions: {
                            color: color,
                            fillOpacity: opacity,
                            weight: 0
                        }
                    })
                }
            ]
        }).addTo(map);

        return () => {
            decorator.remove();
        };
    }, [map, points, color, opacity]);

    return null;
};

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
                <div key={path.id}>
                    <Polyline
                        positions={path.points}
                        pathOptions={{
                            color: path.color || '#3388ff',
                            weight: path.weight || config.path_weight,
                            opacity: path.opacity || config.path_opacity
                        }}
                    />
                    <PathDecorator 
                        points={path.points}
                        color={path.color || '#3388ff'}
                        opacity={path.opacity || config.path_opacity}
                    />
                </div>
            ))}
        </MapContainer>
    );
});

export default Map;
