import { Location, ScheduleEntry } from '../types/models';
import { useState, useRef, useMemo, useEffect } from 'react';
import Map from './Map';
import { MapData, MapRef } from '../types/map';
import { useConfigStore } from '../stores/configStore';
import BaseModal, { ModalHeader, ModalContent, ModalFooter, ModalTitle } from './BaseModal';

interface LocationEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    location?: Location;
    onSave: (location: Location) => void;
    schedules: ScheduleEntry[];
    fixedSchedule?: ScheduleEntry;
}

export default function LocationEditorModal({
    isOpen,
    onClose,
    location,
    onSave,
    schedules,
    fixedSchedule
}: LocationEditorModalProps) {
    const { config: { settings: { depot_location } } } = useConfigStore();
    const defaultFormData = {
        name: '',
        coordinates: depot_location,
        wco_amount: 0,
        disposal_schedule: fixedSchedule?.frequency ?? 7
    };

    const [formData, setFormData] = useState<Partial<Location>>(location || defaultFormData);

    useEffect(() => {
        // Reset form when modal opens/closes
        if (isOpen) {
            if (location) {
                // Editing mode: populate with location data
                setFormData(location);
            } else {
                // Adding mode: reset to default values
                setFormData(defaultFormData);
            }
        }
    }, [isOpen, location, depot_location, fixedSchedule]);

    const mapRef = useRef<MapRef>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.coordinates) return;

        const newLocation: Location = {
            id: location?.id || `loc_${Date.now()}`,
            id_num: location?.id_num || Date.now(),
            name: formData.name,
            coordinates: formData.coordinates,
            wco_amount: formData.wco_amount || 0,
            disposal_schedule: formData.disposal_schedule || 7
        };

        onSave(newLocation);
        onClose();
    };

    const handleMapClick = (lat: number, lng: number) => {
        setFormData({
            ...formData,
            coordinates: [lat, lng]
        });
        mapRef.current?.zoomTo([lat, lng], 16);
    };

    const mapData = useMemo((): MapData => ({
        markers: formData.coordinates ? [{
            id: 'new-location',
            position: formData.coordinates,
            color: 'blue'
        }] : []
    }), [formData.coordinates]);

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} size="6xl">
            <ModalHeader>
                <ModalTitle>{location ? 'Edit Location' : 'Add Location'}</ModalTitle>
            </ModalHeader>
            
            <ModalContent>
                <div className="flex gap-4">
                    <div className="w-[600px] rounded-lg overflow-hidden border border-gray-200">
                        <Map
                            ref={mapRef}
                            center={formData.coordinates || depot_location}
                            config={{
                                zoom_level: 12,
                                path_weight: 3,
                                path_opacity: 0.6
                            }}
                            data={mapData}
                            onClick={handleMapClick}
                        />
                    </div>

                    <form onSubmit={handleSubmit} className="flex-1 space-y-4">
                        <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-700">Name</label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    className="w-full border border-gray-200 p-2 text-sm rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    required
                                    placeholder="e.g. Restaurant ABC"
                                    title="Enter a unique name for this location"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-gray-700">Coordinates</label>
                                    <div className="text-[10px] text-gray-500">Click map or enter manually</div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="number"
                                        step="any"
                                        value={formData.coordinates?.[0] || ''}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            coordinates: [parseFloat(e.target.value), formData.coordinates?.[1] || 0]
                                        })}
                                        className="w-full border border-gray-200 p-2 text-sm rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        required
                                        placeholder="Latitude"
                                    />
                                    <input
                                        type="number"
                                        step="any"
                                        value={formData.coordinates?.[1] || ''}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            coordinates: [formData.coordinates?.[0] || 0, parseFloat(e.target.value)]
                                        })}
                                        className="w-full border border-gray-200 p-2 text-sm rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        required
                                        placeholder="Longitude"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-700">WCO Amount</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={formData.wco_amount || ''}
                                        onChange={(e) => setFormData({...formData, wco_amount: parseInt(e.target.value)})}
                                        className="w-full border border-gray-200 p-2 text-sm rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 pr-8"
                                        required
                                        min="0"
                                        placeholder="e.g. 100"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">L</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-700">Collection Schedule</label>
                                {fixedSchedule ? (
                                    <div className="w-full border border-gray-200 p-2 text-sm rounded-lg bg-gray-50 text-gray-700">
                                        {fixedSchedule.name} ({fixedSchedule.frequency} days)
                                    </div>
                                ) : (
                                    <select
                                        value={formData.disposal_schedule || ''}
                                        onChange={(e) => setFormData({...formData, disposal_schedule: parseInt(e.target.value)})}
                                        className="w-full border border-gray-200 p-2 text-sm rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        required
                                    >
                                        <option value="">Select a schedule</option>
                                        {schedules.map(schedule => (
                                            <option key={schedule.id} value={schedule.frequency}>
                                                {schedule.name} ({schedule.frequency} days)
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>
                    </form>
                </div>
            </ModalContent>

            <ModalFooter>
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600"
                >
                    Save
                </button>
            </ModalFooter>
        </BaseModal>
    );
}
