import { Dialog } from '@headlessui/react';
import { Location, ScheduleEntry } from '../types/models';
import { useState } from 'react';
import LocationEditorModal from './LocationEditorModal';
import ImportModal from './ImportModal';
import Papa from 'papaparse';

interface AddLocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddLocation: (location: Location) => void;
    schedules: ScheduleEntry[];
}

interface RawLocation {
    name: string;
    latitude: string;
    longitude: string;
    wco_amount: string;
    disposal_schedule?: string;
}

export default function AddLocationModal({
    isOpen,
    onClose,
    onAddLocation,
    schedules
}: AddLocationModalProps) {
    const [isLocationEditorOpen, setIsLocationEditorOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [previewLocations, setPreviewLocations] = useState<Location[]>([]);
    const [locationToEdit, setLocationToEdit] = useState<Location | null>(null);

    const handleFilesReceived = (files: File[]) => {
        files.forEach(file => {
            Papa.parse<RawLocation>(file, {
                header: true,
                complete: (results) => {
                    try {
                        const locations: Location[] = results.data
                            .filter(row => row.name && row.latitude && row.longitude)
                            .map((row, index) => ({
                                id: `${file.name}_${index}`,
                                id_num: index,
                                name: row.name,
                                coordinates: [parseFloat(row.latitude), parseFloat(row.longitude)],
                                wco_amount: parseFloat(row.wco_amount || '0'),
                                disposal_schedule: parseFloat(row.disposal_schedule || '7')
                            }));
                        setPreviewLocations(prev => [...prev, ...locations]);
                    } catch (error) {
                        console.error(`Error parsing ${file.name}:`, error);
                    }
                },
                error: (error) => {
                    console.error(`Error reading ${file.name}:`, error.message);
                }
            });
        });
    };

    const handleAddAll = () => {
        previewLocations.forEach(onAddLocation);
        setPreviewLocations([]);
        onClose();
    };

    const handleRemoveLocation = (id: string) => {
        setPreviewLocations(prev => prev.filter(loc => loc.id !== id));
    };

    const handleEditLocation = (editedLocation: Location) => {
        setPreviewLocations(prev => prev.map(loc => 
            loc.id === editedLocation.id ? editedLocation : loc
        ));
        setLocationToEdit(null);
    };

    return (
        <>
            <Dialog open={isOpen} onClose={onClose} className="relative z-[100]">
                <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
                
                <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
                    <Dialog.Panel className="w-full max-w-2xl bg-white rounded-xl shadow-lg flex flex-col max-h-[85vh] my-auto">
                        {/* Header */}
                        <div className="shrink-0 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                            <Dialog.Title className="text-lg font-medium">Add Locations</Dialog.Title>
                            <button
                                onClick={() => setIsImportModalOpen(true)}
                                className="px-4 py-2 text-sm rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
                            >
                                Import from CSV
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto min-h-0 p-4">
                            <div className="relative">
                                {/* Timeline line */}
                                <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />
                                
                                {/* Timeline items */}
                                <div className="space-y-3">
                                    {previewLocations.map((loc) => (
                                        <div key={loc.id} className="relative pl-8 group">
                                            {/* Timeline dot */}
                                            <div className="absolute left-[1px] w-4 h-4 rounded-full bg-white border-2 border-blue-500 mt-3 group-hover:bg-blue-50 transition-colors" />
                                            <div className="p-2 rounded-lg group-hover:bg-gray-50 transition-colors relative flex flex-col">
                                                <div className="font-medium text-sm flex items-center justify-between">
                                                    <span className="leading-6">{loc.name}</span>
                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => setLocationToEdit(loc)}
                                                            className="text-gray-400 hover:text-blue-500"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleRemoveLocation(loc.id)}
                                                            className="text-gray-400 hover:text-red-500"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {loc.coordinates[0]}, {loc.coordinates[1]} • {loc.wco_amount}L
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Add Location Button integrated with timeline */}
                                    <div className="relative pl-8 mt-3">
                                        <div className="absolute left-0 w-4 h-4 rounded-full bg-blue-50 border-2 border-blue-500 mt-3 flex items-center justify-center">
                                            <svg className="w-2 h-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
                                            </svg>
                                        </div>
                                        <div className="p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                            <button
                                                onClick={() => setIsLocationEditorOpen(true)}
                                                className="w-full text-left"
                                            >
                                                <div className="font-medium text-sm text-blue-500 group-hover:text-blue-600 leading-6">
                                                    Add Single Location
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    Manually add a new location to the list
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Empty State */}
                                {previewLocations.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">
                                        <p className="text-sm">No locations added yet</p>
                                        <p className="text-xs mt-1">Add a single location or import from CSV</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 flex gap-2 justify-end p-4 border-t border-gray-100">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            {previewLocations.length > 0 && (
                                <button
                                    onClick={handleAddAll}
                                    className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600"
                                >
                                    Add All {previewLocations.length} Locations
                                </button>
                            )}
                        </div>
                    </Dialog.Panel>
                </div>
            </Dialog>

            <LocationEditorModal
                isOpen={isLocationEditorOpen || !!locationToEdit}
                onClose={() => {
                    setIsLocationEditorOpen(false);
                    setLocationToEdit(null);
                }}
                onSave={(location) => {
                    if (locationToEdit) {
                        handleEditLocation({ ...location, id: locationToEdit.id });
                    } else {
                        setPreviewLocations(prev => [...prev, { ...location, id: `manual_${prev.length}` }]);
                    }
                    setIsLocationEditorOpen(false);
                }}
                schedules={schedules}
                location={locationToEdit ?? undefined}
            />

            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onComplete={handleFilesReceived}
            />
        </>
    );
}
