import { useState } from 'react';
import { ScheduleEntry } from '../types/models';
import ScheduleEditorModal from './ScheduleEditorModal';
import BaseModal, { ModalHeader, ModalContent, ModalFooter, ModalTitle } from './BaseModal';

interface ScheduleResolutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    missingSchedules: number[];
    onAutoCreate: () => void;
    onAddSchedule: (schedule: ScheduleEntry) => void;
}

export default function ScheduleResolutionModal({
    isOpen,
    onClose,
    missingSchedules,
    onAutoCreate,
    onAddSchedule
}: ScheduleResolutionModalProps) {
    const [editingFrequency, setEditingFrequency] = useState<number | null>(null);
    const [resolvedSchedules, setResolvedSchedules] = useState<Set<number>>(new Set());

    const handleCreateSchedule = (schedule: ScheduleEntry) => {
        onAddSchedule(schedule);
        setResolvedSchedules(prev => new Set([...prev, schedule.frequency]));
        setEditingFrequency(null);
        
        // If all schedules are created, close the resolution modal
        if (missingSchedules.length === resolvedSchedules.size + 1) {
            onClose();
        }
    };

    return (
        <>
            <BaseModal isOpen={isOpen} onClose={onClose} size="md">
                <ModalHeader>
                    <ModalTitle>Missing Schedules</ModalTitle>
                </ModalHeader>

                <ModalContent>
                    <div className="p-4 space-y-4">
                        <div className="text-sm text-gray-600">
                            The following schedules need to be created:
                        </div>
                        <div className="divide-y divide-gray-100">
                            {missingSchedules.map(frequency => {
                                const isResolved = resolvedSchedules.has(frequency);
                                return (
                                    <div key={frequency} className="py-2 first:pt-0 last:pb-0">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${
                                                isResolved ? 'bg-green-400' : 'bg-yellow-400'
                                            }`} />
                                            <span className="text-sm flex-1">{frequency} days frequency</span>
                                            {!isResolved && (
                                                <button
                                                    onClick={() => setEditingFrequency(frequency)}
                                                    className="px-3 py-1.5 text-xs rounded-lg transition-all bg-blue-50 hover:bg-blue-100 text-blue-600"
                                                >
                                                    Create Schedule
                                                </button>
                                            )}
                                            {isResolved && (
                                                <span className="text-xs text-green-600 px-2 py-1 bg-green-50 rounded-lg">
                                                    Created
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </ModalContent>

                <ModalFooter>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onAutoCreate}
                        className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600"
                    >
                        Create All Automatically
                    </button>
                </ModalFooter>
            </BaseModal>

            <ScheduleEditorModal
                isOpen={!!editingFrequency}
                onClose={() => setEditingFrequency(null)}
                onSave={handleCreateSchedule}
                defaultFrequency={editingFrequency}
            />
        </>
    );
}
