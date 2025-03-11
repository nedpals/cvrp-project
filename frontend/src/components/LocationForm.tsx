import { useState } from 'react';
import { Location } from '../types/models';

interface LocationFormProps {
    onAddLocation: (location: Location) => void;
    defaultFrequency?: number;
}

export default function LocationForm({ onAddLocation, defaultFrequency = 7 }: LocationFormProps) {
    const [name, setName] = useState('');
    const [lat, setLat] = useState('');
    const [lng, setLng] = useState('');
    const [wcoAmount, setWcoAmount] = useState('');
    const [isCollapsed, setIsCollapsed] = useState(true);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAddLocation({
            id: Math.random().toString(36).substr(2, 9),
            id_num: Math.max(0, Math.min(999, Math.floor(Math.random() * 1000))),
            name,
            coordinates: [parseFloat(lat), parseFloat(lng)],
            wco_amount: parseFloat(wcoAmount),
            disposal_schedule: defaultFrequency
        });
        setName('');
        setLat('');
        setLng('');
        setWcoAmount('');
        setIsCollapsed(true);
    };

    return (
        <div className="bg-white/95 backdrop-blur rounded-md border border-gray-200">
            <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-full flex justify-between items-center p-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
                <span>Add New Location</span>
                <span className="text-lg">{isCollapsed ? '+' : '−'}</span>
            </button>
            
            {!isCollapsed && (
                <form onSubmit={handleSubmit} className="p-2 pt-0 border-t border-gray-100">
                    <div className="space-y-2">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Location Name"
                            className="w-full border p-1.5 rounded bg-white/80 text-sm"
                            required
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="number"
                                step="any"
                                value={lat}
                                onChange={(e) => setLat(e.target.value)}
                                placeholder="Latitude"
                                className="border p-1.5 rounded bg-white/80 text-sm"
                                required
                            />
                            <input
                                type="number"
                                step="any"
                                value={lng}
                                onChange={(e) => setLng(e.target.value)}
                                placeholder="Longitude"
                                className="border p-1.5 rounded bg-white/80 text-sm"
                                required
                            />
                        </div>
                        <input
                            type="number"
                            step="any"
                            value={wcoAmount}
                            onChange={(e) => setWcoAmount(e.target.value)}
                            placeholder="WCO Amount (L)"
                            className="w-full border p-1.5 rounded bg-white/80 text-sm"
                            required
                        />
                        <button
                            type="submit"
                            className="w-full bg-green-500 text-white py-1.5 px-4 rounded text-sm hover:bg-green-600"
                        >
                            Add Location
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
