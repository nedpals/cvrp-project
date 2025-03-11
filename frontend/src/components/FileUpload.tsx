import { useState } from 'react';
import Papa from 'papaparse';
import { Location, RawLocation } from '../types/models';
import { ScheduleConfig } from '../types/config';

interface FileUploadProps {
    onLocationsUploaded: (locations: Location[]) => void;
    onConfigUploaded: (config: ScheduleConfig) => void;
}

interface CsvFile {
    name: string;
    locations: Location[];
    selected: boolean;
}

export default function FileUpload({ onLocationsUploaded, onConfigUploaded }: FileUploadProps) {
    const [csvFiles, setCsvFiles] = useState<CsvFile[]>([]);
    const [jsonError, setJsonError] = useState<string>();

    const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        Array.from(files).forEach(file => {
            Papa.parse<RawLocation>(file, {
                header: true,
                complete: (results) => {
                    try {
                        const locations: Location[] = results.data.map((row, index) => ({
                            id: `${file.name}_${index}`,
                            id_num: index,
                            name: row.name,
                            coordinates: [parseFloat(row.latitude), parseFloat(row.longitude)],
                            wco_amount: parseFloat(row.wco_amount),
                            disposal_schedule: parseFloat(row.disposal_schedule) || 7
                        }));

                        setCsvFiles(prev => [...prev, {
                            name: file.name,
                            locations,
                            selected: true
                        }]);
                        
                        // Upload all locations from all selected files
                        updateSelectedLocations([...csvFiles, {
                            name: file.name,
                            locations,
                            selected: true
                        }]);
                    } catch (error) {
                        console.error(`Error parsing ${file.name}:`, error);
                    }
                }
            });
        });
    };

    const updateSelectedLocations = (files: CsvFile[]) => {
        const selectedLocations = files
            .filter(file => file.selected)
            .flatMap(file => file.locations);
        onLocationsUploaded(selectedLocations);
    };

    const toggleFileSelection = (fileName: string) => {
        const updatedFiles = csvFiles.map(file => 
            file.name === fileName 
                ? { ...file, selected: !file.selected }
                : file
        );
        setCsvFiles(updatedFiles);
        updateSelectedLocations(updatedFiles);
    };

    const removeFile = (fileName: string) => {
        const updatedFiles = csvFiles.filter(file => file.name !== fileName);
        setCsvFiles(updatedFiles);
        updateSelectedLocations(updatedFiles);
    };

    const handleJsonUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const config = JSON.parse(text) as ScheduleConfig;
            onConfigUploaded(config);
            setJsonError(undefined);
        } catch (error) {
            setJsonError('Invalid JSON format');
            console.error(error);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload Location Files (CSV)
                </label>
                <input
                    type="file"
                    accept=".csv"
                    multiple
                    onChange={handleCsvUpload}
                    className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100"
                />
            </div>

            {csvFiles.length > 0 && (
                <div className="mt-2 space-y-2">
                    <h4 className="text-sm font-medium text-gray-700">Uploaded Files:</h4>
                    {csvFiles.map(file => (
                        <div key={file.name} className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={file.selected}
                                onChange={() => toggleFileSelection(file.name)}
                                className="rounded text-blue-500"
                            />
                            <span className="flex-1">{file.name}</span>
                            <span className="text-gray-500">
                                ({file.locations.length} locations)
                            </span>
                            <button
                                onClick={() => removeFile(file.name)}
                                className="text-red-500 hover:text-red-700"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload Schedule Config (JSON)
                </label>
                <input
                    type="file"
                    accept=".json"
                    onChange={handleJsonUpload}
                    className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100"
                />
                {jsonError && <p className="text-red-500 text-sm mt-1">{jsonError}</p>}
            </div>
        </div>
    );
}
