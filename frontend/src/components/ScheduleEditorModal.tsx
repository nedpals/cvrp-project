import { ScheduleEntry, SCHEDULE_TEMPLATES } from '../types/models';
import { useEffect, useState } from 'react';
import BaseModal, { ModalHeader, ModalContent, ModalFooter, ModalTitle } from './BaseModal';

interface ScheduleEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    schedule?: ScheduleEntry;
    onSave: (schedule: ScheduleEntry) => void;
    defaultFrequency?: number | null;
}

export default function ScheduleEditorModal({
    isOpen,
    onClose,
    schedule,
    onSave,
    defaultFrequency
}: ScheduleEditorModalProps) {
    const [formData, setFormData] = useState<Partial<ScheduleEntry>>(
        schedule || {
            name: '',
            frequency: 7
        }
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.frequency) return;

        const newSchedule: ScheduleEntry = {
            id: schedule?.id || `schedule_${Date.now()}`,
            file: schedule?.file || '',
            name: formData.name,
            frequency: formData.frequency
        };

        onSave(newSchedule);
        onClose();
    };

    useEffect(() => {
        if (!schedule && defaultFrequency) {
            setFormData({ ...formData, frequency: defaultFrequency });
        }
    }, [schedule, defaultFrequency]);

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} size="md">
            <form onSubmit={handleSubmit}>
                <ModalHeader>
                    <ModalTitle>{schedule ? 'Edit Schedule' : 'Add Schedule'}</ModalTitle>
                </ModalHeader>

                <ModalContent>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-700">Quick Templates</label>
                            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                                {SCHEDULE_TEMPLATES.map(template => (
                                    <button
                                        key={template.frequency}
                                        type="button"
                                        onClick={() => setFormData({
                                            ...formData,
                                            name: template.name,
                                            frequency: template.frequency
                                        })}
                                        className="shrink-0 px-3 py-1.5 text-xs rounded-lg transition-all bg-gray-50 hover:bg-gray-100 text-gray-700 flex items-center gap-1.5"
                                    >
                                        <span>{template.name.split(' ')[0]}</span>
                                        <span className="text-gray-400">({template.frequency}d)</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-700">Name</label>
                            <input
                                type="text"
                                value={formData.name || ''}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                className="w-full border border-gray-200 p-2 text-sm rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                required
                                placeholder="e.g. Weekly Collection"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-700">Frequency (days)</label>
                            <input
                                type="number"
                                min="1"
                                value={formData.frequency || ''}
                                onChange={(e) => setFormData({...formData, frequency: parseInt(e.target.value)})}
                                className="w-full border border-gray-200 p-2 text-sm rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                required
                                placeholder="Enter number of days"
                            />
                        </div>
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
            </form>
        </BaseModal>
    );
}
