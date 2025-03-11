import { useState } from 'react';
import { Location } from '../types/models';

export function useLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  
  const addLocation = (location: Location) => {
    setLocations(prev => [...prev, location]);
  };
  
  const removeLocation = (locationId: string) => {
    setLocations(prev => prev.filter(loc => loc.id !== locationId));
  };
  
  const updateLocation = (locationId: string, updates: Partial<Location>) => {
    setLocations(prev => 
      prev.map(loc => loc.id === locationId ? { ...loc, ...updates } : loc)
    );
  };
  
  return {
    locations,
    addLocation,
    removeLocation,
    updateLocation,
    clearLocations: () => setLocations([])
  };
}
