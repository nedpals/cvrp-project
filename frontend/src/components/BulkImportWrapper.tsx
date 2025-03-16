import { Location, ScheduleEntry } from '../types/models';
import ImportModal from './ImportModal';
import Papa from 'papaparse';

interface BulkImportWrapperProps {
    isOpen: boolean;
    onClose: () => void;
    onAddLocation: (location: Location) => void;
    fixedSchedule?: ScheduleEntry;
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
    fixedSchedule
}: BulkImportWrapperProps) {
    const processLocations = (rawLocations: RawLocation[], filePrefix: string) => {
        try {
            const locations: Location[] = rawLocations
                .filter(row => row.name && row.latitude && row.longitude)
                .map((row, index) => ({
                    id: `${filePrefix}_${index}`,
                    id_num: index,
                    name: row.name,
                    coordinates: [parseFloat(row.latitude), parseFloat(row.longitude)],
                    wco_amount: parseFloat(row.wco_amount || '0'),
                    disposal_schedule: fixedSchedule?.frequency ?? parseFloat(row.disposal_schedule || '7')
                }));
            locations.forEach(onAddLocation);
        } catch (error) {
            console.error(`Error processing locations from ${filePrefix}:`, error);
        }
    };

    const handleFilesReceived = (files: File[]) => {
        files.forEach(file => {
            if (file.name.endsWith('.csv')) {
                Papa.parse<RawLocation>(file, {
                    header: true,
                    complete: (results) => {
                        processLocations(results.data, file.name);
                    },
                    error: (error) => {
                        console.error(`Error reading ${file.name}:`, error.message);
                    }
                });
            } else if (file.name.endsWith('.json')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const jsonData = JSON.parse(event.target?.result as string);
                        const locations = Array.isArray(jsonData) ? jsonData : [jsonData];
                        processLocations(locations, file.name);
                    } catch (error) {
                        console.error(`Error parsing JSON from ${file.name}:`, error);
                    }
                };
                reader.readAsText(file);
            }
        });
        onClose();
    };

    return (
        <ImportModal
            isOpen={isOpen}
            onClose={onClose}
            onComplete={handleFilesReceived}
        />
    );
}
