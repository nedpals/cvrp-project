from typing import Dict, List, Tuple, Optional, Set
from collections import defaultdict
from models.location import Location

class LocationRegistry:
    """Efficient data structure for storing and retrieving locations with array-based indexing"""
    
    def __init__(self, items: List[Location] = None):
        self._all_locations: List[Location] = []
        self._location_ids: List[str] = []  # Change to string IDs
        self._coordinates_map: Dict[Tuple[float, float], List[str]] = defaultdict(list)  # coordinates -> list of location IDs
        self._location_names: List[str] = []
        self._name_indices: Dict[str, List[int]] = defaultdict(list)

        if items:
            for item in items:
                self.add(item)

    def add(self, location: Location) -> None:
        """Add a location to all indices"""
        if location.id in self._location_ids:
            return

        index = len(self._all_locations)
        self._all_locations.append(location)
        self._location_ids.append(location.id)
        self._coordinates_map[location.coordinates].append(location.id)
        self._location_names.append(location.name)
        self._name_indices[location.name].append(index)

    def __add__(self, other: 'LocationRegistry') -> 'LocationRegistry':
        """Combine two location registries"""

        for location in other._all_locations:
            self.add(location)

        return self
            
    def remove(self, location: Location) -> None:
        """Remove a location from all indices"""
        try:
            index = self._location_ids.index(location.id)
        except ValueError:
            return
            
        # Remove from all arrays
        self._all_locations.pop(index)
        self._location_ids.pop(index)
        self._location_names.pop(index)
        name = self._location_names.pop(index)
        
        # Update name indices
        self._name_indices[name].remove(index)
        if not self._name_indices[name]:
            del self._name_indices[name]
            
        # Update remaining indices
        self._update_indices(index)
            
    def _update_indices(self, removed_index: int) -> None:
        """Update indices after removal"""
        # Update name indices - shift all indices greater than removed_index
        for indices in self._name_indices.values():
            indices[:] = [idx - 1 if idx > removed_index else idx for idx in indices]
            indices.sort()  # Keep indices ordered
            
    def get_by_id(self, location_id: str) -> Optional[Location]:
        """Get location by ID"""
        try:
            index = self._location_ids.index(location_id)
            return self._all_locations[index]
        except ValueError:
            return None
    
    def get_by_name(self, name: str) -> Set[Location]:
        """Get all locations with the given name"""
        indices = self._name_indices.get(name, [])
        return {self._all_locations[i] for i in indices}
    
    def get_by_coordinates(self, coordinates: Tuple[float, float], tolerance: float = 1e-6) -> List[Location]:
        """Get all locations at given coordinates"""
        # Exact match first
        if coordinates in self._coordinates_map:
            return [self._all_locations[self._location_ids.index(loc_id)] 
                   for loc_id in self._coordinates_map[coordinates]]

        # Try with tolerance
        matches = []
        for coord, loc_ids in self._coordinates_map.items():
            if (abs(coord[0] - coordinates[0]) < tolerance and 
                abs(coord[1] - coordinates[1]) < tolerance):
                matches.extend([self._all_locations[self._location_ids.index(loc_id)] 
                              for loc_id in loc_ids])
        return matches
    
    def get_all(self) -> List[Location]:
        """Get all locations"""
        return self._all_locations.copy()
    
    def clear(self) -> None:
        """Clear all locations"""
        self._location_ids.clear()
        self._coordinates_map.clear()
        self._location_names.clear()
        self._name_indices.clear()
        self._all_locations.clear()
        
    def __len__(self) -> int:
        return len(self._all_locations)
    
    def __iter__(self):
        return iter(self._all_locations)
    
    def __contains__(self, item) -> bool:
        if isinstance(item, Location):
            return item.id in self._location_ids
        elif isinstance(item, str):
            return item in self._location_ids
        elif isinstance(item, tuple) and len(item) == 2:
            return item in self._coordinates_map
        return False

