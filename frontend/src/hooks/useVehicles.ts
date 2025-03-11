import { useState } from 'react';
import { Vehicle } from '../types/models';

export function useVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    { id: 'v1', capacity: 1000 }
  ]);
  
  const addVehicle = () => {
    setVehicles([
      ...vehicles,
      { id: `v${vehicles.length + 1}`, capacity: 1000 }
    ]);
  };
  
  const removeVehicle = (index: number) => {
    setVehicles(vehicles.filter((_, i) => i !== index));
  };
  
  const updateVehicle = (index: number, field: keyof Vehicle, value: unknown) => {
    const updatedVehicles = [...vehicles];
    updatedVehicles[index] = { ...updatedVehicles[index], [field]: value };
    setVehicles(updatedVehicles);
  };
  
  return {
    vehicles,
    addVehicle,
    removeVehicle,
    updateVehicle,
    setVehicles
  };
}
