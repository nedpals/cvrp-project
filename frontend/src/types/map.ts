export interface MapRef {
  zoomTo: (coordinates: [number, number], zoom: number, offset?: { x: number, y: number }) => void;
  fitBounds: (coordinates: [number, number][], padding?: { x: number, y: number }) => void;
}
