import { LatLngExpression } from "leaflet"

export interface MapRef {
    zoomTo: (coordinates: [number, number], zoom?: number, offset?: { x: number, y: number }) => void;
    fitBounds: (coordinates: [number, number][], padding?: {
        x: number;
        y: number;
    }) => void;
}

export interface MapMarker {
    id: string;
    position: LatLngExpression;
    color?: string;
    icon?: 'default' | 'depot';
    popup?: React.ReactNode;
}

export interface MapPath {
    id: string;
    points: LatLngExpression[];
    color?: string;
    weight?: number;
    opacity?: number;
}

export interface MapData {
    markers?: MapMarker[];
    paths?: MapPath[];
}
