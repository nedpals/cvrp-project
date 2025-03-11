import { useState } from 'react';
import { ScheduleEntry, Location, FREQUENCY_PRESETS } from '../types/models';
import LocationForm from './LocationForm';
import Papa from 'papaparse';
import { useFilterStore } from '../stores/filterStore';
import { useOptimizeRoutes } from '../hooks/useOptimizeRoutes';

interface ScheduleLocationsTabProps {
    schedules: ScheduleEntry[];
    locations: Location[];
    onUpdateSchedules: (schedules: ScheduleEntry[]) => void;
    onAddLocation: (location: Location) => void;
    onRemoveLocation: (locationId: string) => void;
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
    onRemoveLocation
}: ScheduleLocationsTabProps) {
    const { setActiveSchedule, activeSchedule } = useFilterStore();
    const { switchToSchedule } = useOptimizeRoutes();

    const handleScheduleToggle = async (scheduleId: string, isEnabled: boolean) => {
        const updatedSchedules = schedules.map(schedule => 
            schedule.id === scheduleId ? { ...schedule, enabled: isEnabled } : schedule
        );
        onUpdateSchedules(updatedSchedules);

        if (isEnabled) {
            setActiveSchedule(scheduleId);
            await switchToSchedule(scheduleId);
        }
    };

    const [uploadError, setUploadError] = useState<string>();

    const addSchedule = () => {
        const newSchedule: ScheduleEntry = {
            id: `s${schedules.length + 1}`,
            name: `Schedule ${schedules.length + 1}`,
            frequency: 7,
            file: 'schedule.json'
        };
        onUpdateSchedules([...schedules, newSchedule]);
        setActiveSchedule(newSchedule.id);
    };

    const updateSchedule = (index: number, field: keyof ScheduleEntry, value: unknown) => {
        const updatedSchedules = [...schedules];
        updatedSchedules[index] = { ...updatedSchedules[index], [field]: value };
        onUpdateSchedules(updatedSchedules);
    };

    const removeSchedule = (index: number) => {
        const schedule = schedules[index];
        const remainingSchedules = schedules.filter((_, i) => i !== index);
        onUpdateSchedules(remainingSchedules);
        
        // If active schedule was removed, select the first available schedule
        if (schedule.id === activeSchedule && remainingSchedules.length > 0) {
            setActiveSchedule(remainingSchedules[0].id);
        }
    };

    const handleAddLocation = (location: Location) => {
        const schedule = schedules.find(s => s.id === activeSchedule);
        if (schedule) {
            onAddLocation({
                ...location,
                disposal_schedule: schedule.frequency
            });
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

    // Filter locations for the active schedule
    const scheduleLocations = locations.filter(loc => {
        const schedule = schedules.find(s => s.id === activeSchedule);
        return schedule && loc.disposal_schedule === schedule.frequency;
    });

    // Get current schedule frequency
    const currentSchedule = schedules.find(s => s.id === activeSchedule);

    return (
        <div className="space-y-3">
            {/* Schedule Selection */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 scrollbar-hide">
                {schedules.map((schedule) => (
                    <button
                        key={schedule.id}
                        onClick={() => handleScheduleToggle(schedule.id, true)}
                        className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                            activeSchedule === schedule.id
                                ? 'bg-blue-100 text-blue-700 font-medium'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        {schedule.name} ({schedule.frequency}d)
                    </button>
                ))}
                <button
                    onClick={addSchedule}
                    className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 whitespace-nowrap"
                >
                    + New
                </button>
            </div>
            
            {/* Active Schedule Options */}
            {currentSchedule && (
                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-md">
                    <input
                        type="text"
                        value={currentSchedule.name}
                        onChange={(e) => {
                            const index = schedules.findIndex(s => s.id === activeSchedule);
                            updateSchedule(index, 'name', e.target.value);
                        }}
                        className="flex-1 border p-1 rounded text-xs"
                        placeholder="Schedule Name"
                    />
                    <select
                        value={currentSchedule.frequency}
                        onChange={(e) => {
                            const index = schedules.findIndex(s => s.id === activeSchedule);
                            updateSchedule(index, 'frequency', parseInt(e.target.value));
                        }}
                        className="border p-1 rounded text-xs bg-white"
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
                                const index = schedules.findIndex(s => s.id === activeSchedule);
                                removeSchedule(index);
                            }}
                            className="bg-red-100 text-red-700 rounded p-1 text-xs hover:bg-red-200"
                        >
                            ×
                        </button>
                    )}
                </div>
            )}

            {/* CSV Upload */}
            <div className="bg-gray-50 p-2 rounded text-xs">
                <label className="block font-medium text-gray-700 mb-1">
                    Bulk Import Locations (CSV)
                </label>
                <input
                    type="file"
                    accept=".csv"
                    multiple
                    onChange={handleCsvUpload}
                    className="w-full text-xs text-gray-500
                        file:mr-2 file:py-1 file:px-2
                        file:rounded file:border-0
                        file:text-xs file:font-medium
                        file:bg-blue-50 file:text-blue-700"
                />
                {uploadError && (
                    <p className="text-red-500 text-xs mt-1">{uploadError}</p>
                )}
            </div>

            {/* Location Form */}
            <LocationForm 
                onAddLocation={handleAddLocation}
                defaultFrequency={currentSchedule?.frequency}
            />

            {/* Locations List */}
            {scheduleLocations.length > 0 ? (
                <div>
                    <div className="flex justify-between text-xs text-gray-500 font-medium mb-1">
                        <span>Locations ({scheduleLocations.length})</span>
                        <span>Actions</span>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                        {scheduleLocations.map((loc) => (
                            <div key={loc.id_num} className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded text-xs">
                                <div>
                                    <div className="font-medium">{loc.name}</div>
                                    <div className="text-gray-500">
                                        {loc.coordinates[0].toFixed(4)}, {loc.coordinates[1].toFixed(4)} | {loc.wco_amount}L
                                    </div>
                                </div>
                                <button
                                    onClick={() => onRemoveLocation(loc.id)}
                                    className="text-red-500 hover:text-red-700 ml-2"
                                    title="Remove location"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="text-center p-3 text-gray-500 text-sm bg-gray-50 rounded">
                    No locations in this schedule
                </div>
            )}
        </div>
    );
}
