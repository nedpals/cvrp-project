import { useState } from 'react';
import { ScheduleEntry, Location, FREQUENCY_PRESETS } from '../types/models';
import Papa from 'papaparse';

interface ScheduleLocationsTabProps {
    schedules: ScheduleEntry[];
    locations: Location[];
    onUpdateSchedules: (schedules: ScheduleEntry[]) => void;
    onAddLocation: (location: Location) => void;
    onRemoveLocation: (locationId: string) => void;
    onEditLocation?: (location: Location) => void;
}

interface RawLocation {
    name: string;
    latitude: string;
    longitude: string;
    wco_amount: string;
    disposal_schedule?: string;
}

export default function ScheduleLocationsTab({
    schedules,
    locations,
    onUpdateSchedules,
    onAddLocation,
    onRemoveLocation,
    onEditLocation
}: ScheduleLocationsTabProps) {
    const [currentSchedule, setCurrentSchedule] = useState<string | null>(schedules[0]?.id || null);

    const handleScheduleToggle = (scheduleId: string) => {
        setCurrentSchedule(scheduleId);
    };

    const [uploadError, setUploadError] = useState<string>();

    const updateSchedule = (index: number, field: keyof ScheduleEntry, value: unknown) => {
        const updatedSchedules = [...schedules];
        updatedSchedules[index] = { ...updatedSchedules[index], [field]: value };
        onUpdateSchedules(updatedSchedules);
    };

    const removeSchedule = (index: number) => {
        const schedule = schedules[index];
        const remainingSchedules = schedules.filter((_, i) => i !== index);
        onUpdateSchedules(remainingSchedules);
        
        // If current schedule was removed, select the first available schedule
        if (schedule.id === currentSchedule && remainingSchedules.length > 0) {
            setCurrentSchedule(remainingSchedules[0].id);
        }
    };

    const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        Array.from(files).forEach(file => {
            Papa.parse<RawLocation>(file, {
                header: true,
                complete: (results) => {
                    try {
                        const newLocations: Location[] = results.data.map((row, index) => ({
                            id: `${file.name}_${index}`,
                            id_num: index,
                            name: row.name,
                            coordinates: [parseFloat(row.latitude), parseFloat(row.longitude)],
                            wco_amount: parseFloat(row.wco_amount),
                            disposal_schedule: parseFloat(row.disposal_schedule || '7')
                        }));

                        // Auto-add all parsed locations
                        newLocations.forEach(onAddLocation);
                        setUploadError(undefined);
                    } catch (error) {
                        setUploadError(`Error parsing ${file.name}: ${error}`);
                        console.error(error);
                    }
                },
                error: (error) => {
                    setUploadError(`Error reading ${file.name}: ${error.message}`);
                }
            });
        });
        
        // Clear the input
        event.target.value = '';
    };

    // Filter locations for the current schedule
    const scheduleLocations = locations.filter(loc => {
        const schedule = schedules.find(s => s.id === currentSchedule);
        return schedule && loc.disposal_schedule === schedule.frequency;
    });

    // Get current schedule details
    const activeSchedule = schedules.find(s => s.id === currentSchedule);

    return (
        <div className="space-y-3">
            {/* Schedule Selection - remove the "+ New" button */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {schedules.map((schedule) => (
                    <button
                        key={schedule.id}
                        onClick={() => handleScheduleToggle(schedule.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                            currentSchedule === schedule.id
                                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600 ring-offset-2'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:shadow-sm'
                        }`}
                    >
                        {schedule.name} ({schedule.frequency}d)
                    </button>
                ))}
            </div>
            
            {/* Active Schedule Options */}
            {activeSchedule && (
                <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <input
                        type="text"
                        value={activeSchedule.name}
                        onChange={(e) => {
                            const index = schedules.findIndex(s => s.id === currentSchedule);
                            updateSchedule(index, 'name', e.target.value);
                        }}
                        className="flex-1 border border-gray-200 p-1.5 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
                        placeholder="Schedule Name"
                    />
                    <select
                        value={activeSchedule.frequency}
                        onChange={(e) => {
                            const index = schedules.findIndex(s => s.id === currentSchedule);
                            updateSchedule(index, 'frequency', parseInt(e.target.value));
                        }}
                        className="border border-gray-200 p-1.5 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
                    >
                        {FREQUENCY_PRESETS.filter(p => p.value > 0).map(preset => (
                            <option key={preset.value} value={preset.value}>
                                {preset.label}
                            </option>
                        ))}
                    </select>
                    {schedules.length > 1 && (
                        <button
                            onClick={() => {
                                const index = schedules.findIndex(s => s.id === currentSchedule);
                                removeSchedule(index);
                            }}
                            className="p-1.5 rounded-lg transition-colors hover:bg-red-50 text-red-500 hover:text-red-600"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            )}

            {/* CSV Upload */}
            <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Import Locations (CSV)
                </label>
                <input
                    type="file"
                    accept=".csv"
                    multiple
                    onChange={handleCsvUpload}
                    className="w-full text-xs text-gray-500
                        file:mr-2 file:py-1.5 file:px-3
                        file:rounded-lg file:border-0
                        file:text-xs file:font-medium
                        file:bg-blue-50 file:text-blue-600
                        hover:file:bg-blue-100
                        file:transition-colors"
                />
                {uploadError && (
                    <div className="mt-1.5 text-xs p-2 bg-red-50 rounded-lg border border-red-100 text-red-500">
                        {uploadError}
                    </div>
                )}
            </div>

            {/* Locations List */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100 flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-900">Locations</span>
                    <span className="text-xs text-gray-500">{scheduleLocations.length} total</span>
                </div>
                {scheduleLocations.length > 0 ? (
                    <div className="divide-y divide-gray-50 max-h-[calc(100vh-24rem)] overflow-y-auto">
                        {scheduleLocations.map((loc) => (
                            <div key={loc.id_num} 
                                 className="flex items-start justify-between p-2.5 hover:bg-gray-50/50 transition-colors">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-medium border border-blue-100">
                                            {loc.id_num + 1}
                                        </div>
                                        <div className="truncate">
                                            <div className="font-medium text-gray-900 text-xs truncate">
                                                {loc.name}
                                            </div>
                                            <div className="text-[10px] text-gray-500">
                                                {loc.coordinates[0].toFixed(4)}, {loc.coordinates[1].toFixed(4)} • {loc.wco_amount}L
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onRemoveLocation(loc.id)}
                                    className="ml-2 p-1 rounded-lg transition-colors hover:bg-red-50 text-red-400 hover:text-red-500"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => onEditLocation?.(loc)}
                                    className="text-xs px-2 py-1 rounded transition-all bg-gray-100 hover:bg-gray-200 text-gray-700"
                                >
                                    Edit
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center p-4 text-gray-500 text-sm bg-gray-50">
                        No locations in this schedule
                    </div>
                )}
            </div>
        </div>
    );
}
