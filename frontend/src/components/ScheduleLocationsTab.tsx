import { useState, useEffect } from 'react';
import { ScheduleEntry, Location } from '../types/models';
import ScheduleEditorModal from './ScheduleEditorModal';
import AddLocationModal from './AddLocationModal';

interface ScheduleLocationsTabProps {
    schedules: ScheduleEntry[];
    locations: Location[];
    onUpdateSchedules: (schedules: ScheduleEntry[]) => void;
    onAddLocation: (location: Location) => void;
    onRemoveLocation: (locationId: string) => void;
    onEditLocation?: (location?: Location) => void;
    currentSchedule?: string | null;
    onScheduleChange?: (scheduleId: string | null) => void;
}

export default function ScheduleLocationsTab({
    schedules,
    locations,
    onUpdateSchedules,
    onAddLocation,
    onRemoveLocation,
    onEditLocation,
    currentSchedule: externalCurrentSchedule,
    onScheduleChange
}: ScheduleLocationsTabProps) {
    const [internalCurrentSchedule, setInternalCurrentSchedule] = useState<string | null>(
        externalCurrentSchedule || schedules[0]?.id || null
    );

    // Update internal state when external state changes
    useEffect(() => {
        if (externalCurrentSchedule !== undefined) {
            setInternalCurrentSchedule(externalCurrentSchedule);
        }
    }, [externalCurrentSchedule]);

    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isAddLocationModalOpen, setIsAddLocationModalOpen] = useState(false);
    const [scheduleToEdit, setScheduleToEdit] = useState<ScheduleEntry | undefined>();

    // Use external or internal state
    const currentSchedule = externalCurrentSchedule ?? internalCurrentSchedule;

    const handleScheduleToggle = (scheduleId: string) => {
        if (onScheduleChange) {
            onScheduleChange(scheduleId);
        } else {
            setInternalCurrentSchedule(scheduleId);
        }
    };

    const handleSaveSchedule = (schedule: ScheduleEntry) => {
        if (scheduleToEdit) {
            const index = schedules.findIndex(s => s.id === scheduleToEdit.id);
            const updatedSchedules = [...schedules];
            updatedSchedules[index] = schedule;
            onUpdateSchedules(updatedSchedules);
        } else {
            onUpdateSchedules([...schedules, schedule]);
        }
    };

    // Filter locations for the current schedule
    const scheduleLocations = locations.filter(loc => {
        const schedule = schedules.find(s => s.id === currentSchedule);
        return schedule && loc.disposal_schedule === schedule.frequency;
    });

    return (
        <div className="space-y-3">
            {/* Schedule Selection */}
            <div className="flex items-center gap-2 px-3 pt-3">
                <select
                    value={currentSchedule || ''}
                    onChange={(e) => handleScheduleToggle(e.target.value)}
                    disabled={schedules.length === 0}
                    className="flex-1 border border-gray-200 p-2 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                >
                    {schedules.length === 0 ? <option value="">Select Schedule</option> : null}
                    {schedules.map((schedule) => (
                        <option key={schedule.id} value={schedule.id}>
                            {schedule.name} ({schedule.frequency}d)
                        </option>
                    ))}
                </select>
                <button
                    onClick={() => {
                        const schedule = schedules.find(s => s.id === currentSchedule);
                        setScheduleToEdit(schedule);
                        setIsScheduleModalOpen(true);
                    }}
                    className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                    disabled={!currentSchedule}
                >
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                </button>
                <button
                    onClick={() => {
                        setScheduleToEdit(undefined);
                        setIsScheduleModalOpen(true);
                    }}
                    className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                >
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                </button>
            </div>

            <ScheduleEditorModal
                isOpen={isScheduleModalOpen}
                onClose={() => {
                    setIsScheduleModalOpen(false);
                    setScheduleToEdit(undefined);
                }}
                schedule={scheduleToEdit}
                onSave={handleSaveSchedule}
            />

            {/* Locations List */}
            <div className="bg-white rounded-lg overflow-hidden flex flex-col h-[400px]">
                <div className="px-3 py-2 border-y border-gray-100 flex justify-between items-center">
                    <div className="flex justify-between items-center w-full">
                        <p className="text-xs font-medium text-gray-900">
                            Locations
                            <span className="text-xs text-gray-500 ml-2">{scheduleLocations.length} total</span>
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsAddLocationModalOpen(true)}
                                className="text-xs px-3 py-1.5 rounded-lg transition-all bg-blue-50 hover:bg-blue-100 text-blue-600"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </div>
                {scheduleLocations.length > 0 ? (
                    <div className="divide-y divide-gray-50 overflow-y-auto flex-1 pb-3">
                        {scheduleLocations.map((loc) => (
                            <div key={loc.id_num} 
                                 className="flex items-start justify-between p-2.5 hover:bg-gray-50/50 transition-colors">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-medium border border-blue-100 flex-shrink-0">
                                            {loc.id_num + 1}
                                        </div>
                                        <div className="space-y-1 min-w-0">
                                            <div className="font-medium text-gray-900 text-xs truncate max-w-full">
                                                {loc.name}
                                            </div>
                                            <div className="text-[10px] text-gray-500 truncate">
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

            <AddLocationModal
                isOpen={isAddLocationModalOpen}
                onClose={() => setIsAddLocationModalOpen(false)}
                onAddLocation={onAddLocation}
                schedules={schedules}
                fixedSchedule={schedules.find(s => s.id === currentSchedule)}
            />
        </div>
    );
}
