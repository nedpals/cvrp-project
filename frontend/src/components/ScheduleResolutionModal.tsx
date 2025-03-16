import { Dialog } from '@headlessui/react';

interface ScheduleResolutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    missingSchedules: number[];
    onAutoCreate: () => void;
    onManualCreate: () => void;
}

export default function ScheduleResolutionModal({
    isOpen,
    onClose,
    missingSchedules,
    onAutoCreate,
    onManualCreate
}: ScheduleResolutionModalProps) {
    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-[120]">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-md bg-white rounded-xl shadow-lg">
                    <div className="px-4 py-3 border-b border-gray-100">
                        <Dialog.Title className="text-lg font-medium">Missing Schedules</Dialog.Title>
                    </div>

                    <div className="p-4 space-y-4">
                        <div className="text-sm text-gray-600">
                            Some locations reference schedules that don't exist:
                        </div>
                        <div className="space-y-2">
                            {missingSchedules.map(frequency => (
                                <div key={frequency} className="flex items-center gap-2 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-yellow-400" />
                                    <span>{frequency} days frequency</span>
                                </div>
                            ))}
                        </div>
                        <div className="text-sm text-gray-600">
                            Would you like to automatically create these schedules or create them manually?
                        </div>
                    </div>

                    <div className="flex gap-2 justify-end p-4 border-t border-gray-100">
                        <button
                            onClick={onManualCreate}
                            className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                        >
                            Create Manually
                        </button>
                        <button
                            onClick={onAutoCreate}
                            className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600"
                        >
                            Create Automatically
                        </button>
                    </div>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
