import { Location } from '../types/models';
import LocationForm from './LocationForm';

interface LocationsTabProps {
    locations: Location[];
    onAddLocation: (location: Location) => void;
    onRemoveLocation: (id: string) => void;
}

export default function LocationsTab({ locations, onAddLocation, onRemoveLocation }: LocationsTabProps) {
    return (
        <div className="space-y-4">
            <LocationForm onAddLocation={onAddLocation} />
            {locations.length > 0 && (
                <div className="space-y-2">
                    {locations.map((loc) => (
                        <div key={loc.id_num} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                            <div>
                                <div className="font-medium">{loc.name}</div>
                                <div className="text-sm text-gray-500">
                                    {loc.coordinates[0].toFixed(4)}, {loc.coordinates[1].toFixed(4)}
                                </div>
                                <div className="text-sm text-gray-500">
                                    {loc.wco_amount}L every {loc.disposal_schedule} days
                                </div>
                            </div>
                            <button
                                onClick={() => onRemoveLocation(loc.id)}
                                className="text-red-500 hover:text-red-700"
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
