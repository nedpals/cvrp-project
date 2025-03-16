import { Location, ScheduleEntry } from '../types/models';
import ImportModal from './ImportModal';
import ScheduleResolutionModal from './ScheduleResolutionModal';
import Papa from 'papaparse';
import { useState } from 'react';

interface BulkImportWrapperProps {
    isOpen: boolean;
    onClose: () => void;
    onAddLocation: (location: Location) => void;
    fixedSchedule?: ScheduleEntry;
    schedules: ScheduleEntry[];
    onAddSchedules?: (frequencies: number[]) => void;
}

interface RawLocation {
    name: string;
    latitude: string;
    longitude: string;
    wco_amount: string;
    disposal_schedule?: string;
}

export default function BulkImportWrapper({
    isOpen,
    onClose,
    onAddLocation,
    fixedSchedule,
    schedules,
    onAddSchedules
}: BulkImportWrapperProps) {
    const [pendingLocations, setPendingLocations] = useState<Location[]>([]);
    const [missingSchedules, setMissingSchedules] = useState<number[]>([]);
    const [showScheduleModal, setShowScheduleModal] = useState(false);

    const processPendingLocations = () => {
        pendingLocations.forEach(onAddLocation);
        setPendingLocations([]);
        onClose();
    };

    const findMissingSchedules = (locations: Location[]): number[] => {
        const existingFrequencies = new Set(schedules.map(s => s.frequency));
        const requiredFrequencies = new Set(locations.map(l => l.disposal_schedule));
        return Array.from(requiredFrequencies).filter(freq => !existingFrequencies.has(freq));
    };

    const handleFilesReceived = (files: File[]) => {
        const allLocations: Location[] = [];

        const processAllFiles = async () => {
            for (const file of files) {
                if (file.name.endsWith('.csv')) {
                    await new Promise<void>((resolve) => {
                        Papa.parse<RawLocation>(file, {
                            header: true,
                            complete: (results) => {
                                try {
                                    const locations = results.data
                                        .filter(row => row.name && row.latitude && row.longitude)
                                        .map((row, index) => ({
                                            id: `${file.name}_${index}`,
                                            id_num: index,
                                            name: row.name,
                                            coordinates: [parseFloat(row.latitude), parseFloat(row.longitude)] as [number, number],
                                            wco_amount: parseFloat(row.wco_amount || '0'),
                                            disposal_schedule: fixedSchedule?.frequency ?? parseFloat(row.disposal_schedule || '7')
                                        }));
                                    allLocations.push(...locations);
                                    resolve();
                                } catch (error) {
                                    console.error(`Error parsing ${file.name}:`, error);
                                    resolve();
                                }
                            },
                            error: () => resolve()
                        });
                    });
                } else if (file.name.endsWith('.json')) {
                    const text = await file.text();
                    try {
                        const jsonData = JSON.parse(text);
                        const locations = Array.isArray(jsonData) ? jsonData : [jsonData];
                        allLocations.push(...locations);
                    } catch (error) {
                        console.error(`Error parsing JSON from ${file.name}:`, error);
                    }
                }
            }

            const missing = findMissingSchedules(allLocations);
            if (missing.length > 0) {
                setMissingSchedules(missing);
                setPendingLocations(allLocations);
                setShowScheduleModal(true);
            } else {
                allLocations.forEach(onAddLocation);
                onClose();
            }
        };

        processAllFiles();
    };

    const handleAutoCreateSchedules = () => {
        onAddSchedules?.(missingSchedules);
        processPendingLocations();
        setShowScheduleModal(false);
    };

    const handleAddSchedule = (schedule: ScheduleEntry) => {
        onAddSchedules?.([schedule.frequency]);
    };

    return (
        <>
            <ImportModal
                isOpen={isOpen}
                onClose={onClose}
                onComplete={handleFilesReceived}
            />
            
            <ScheduleResolutionModal
                isOpen={showScheduleModal}
                onClose={() => setShowScheduleModal(false)}
                missingSchedules={missingSchedules}
                onAutoCreate={handleAutoCreateSchedules}
                onAddSchedule={handleAddSchedule}
            />
        </>
    );
}
