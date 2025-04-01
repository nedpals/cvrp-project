import { useState, useEffect, useRef } from 'react';
import { ConfigRequest, Location } from '../types/models';
import ScheduleLocationsTab from './ScheduleLocationsTab';
import { downloadConfigAsJson } from '../services/api';
import { useConfigStore } from '../stores/configStore';
import LocationEditorModal from './LocationEditorModal';
import BulkImportWrapper from './BulkImportWrapper';
import { useSolversList } from '../hooks/useSolvers';
import * as sd from 'simple-duration';

interface ConfigFormProps {
    onSubmit: (config: ConfigRequest) => void;
    defaultSolver?: string;
    isLoading?: boolean;
}

export default function ConfigForm({ 
    onSubmit, 
    defaultSolver,
    isLoading = false
}: ConfigFormProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [configError, setConfigError] = useState<string | null>(null);
    const [openSections, setOpenSections] = useState<Set<string>>(new Set([]));
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<Location | undefined>();
    const [currentSchedule, setCurrentSchedule] = useState<string | null>(null);
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
    const [humanMaxDailyTime, setHumanMaxDailyTime] = useState('8h');

    const { solvers, isLoading: isSolversLoading, error: solverListErr } = useSolversList();

    const {
        config,
        setSolver,
        setDepotLocation,
        addVehicle,
        removeVehicle,
        updateVehicle,
        addOneWayRoad,
        updateOneWayRoad,
        removeOneWayRoad,
        importConfig,
        loadDefaultConfig,
        setSchedules,
        addLocation,
        removeLocation,
    } = useConfigStore();

    const { 
        locations, 
        schedules, 
        settings: { 
            solver,
            vehicles,
            depot_location,
            max_daily_time,
            constraints: { one_way_roads }
        }
    } = config;

    useEffect(() => {
        loadDefaultConfig();
    }, []);

    useEffect(() => {
        // convert max_daily_time (in minutes) to seconds
        const maxDailyTimeInSeconds = max_daily_time * 60;
        setHumanMaxDailyTime(sd.stringify(maxDailyTimeInSeconds));
    }, [max_daily_time]);

    useEffect(() => {
        if (defaultSolver && !solver) {
            setSolver(defaultSolver);
        }
    }, [defaultSolver, solver]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!currentSchedule) {
            alert('Please select a schedule first.');
            return;
        }

        const currentScheduleEntry = schedules.find(s => s.id === currentSchedule);
        const selectedSchedules = currentScheduleEntry ? [currentScheduleEntry] : [];

        onSubmit({
            ...config,
            settings: {
                ...config.settings,
                max_daily_time: sd.parse(humanMaxDailyTime) / 60, // convert seconds to minutes
            },
            schedules: selectedSchedules,
        });
    };

    const handleConfigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        setConfigError(null);
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const config = JSON.parse(event.target?.result as string) as ConfigRequest;
                importConfig(config);

                if (config.schedules.length > 0) {
                    setCurrentSchedule(config.schedules[0].id);
                }
                
                // Reset file input
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            } catch (error) {
                console.error('Error parsing config file:', error);
                setConfigError('Invalid JSON format');
            }
        };
        
        reader.readAsText(file);
    };

    const handleExportConfig = () => {
        downloadConfigAsJson(config);
    };

    const handleAddOneWayRoad = () => {
        addOneWayRoad();
    };

    const handleUpdateOneWayRoad = (index: number, pointIndex: number, coordIndex: number, value: string) => {
        updateOneWayRoad(index, pointIndex, coordIndex, value);
    };

    const handleRemoveOneWayRoad = (index: number) => {
        removeOneWayRoad(index);
    };

    const toggleSection = (section: string) => {
        const newSections = new Set(openSections);
        if (newSections.has(section)) {
            newSections.delete(section);
        } else {
            newSections.add(section);
        }
        setOpenSections(newSections);
    };

    const handleLocationSave = (location: Location) => {
        if (editingLocation) {
            // If editing, remove old location and add updated one
            removeLocation(editingLocation.id);
        }
        addLocation(location);
        setEditingLocation(undefined);
    };

    const handleAutoCreateSchedules = (frequencies: number[]) => {
        const newSchedules = frequencies.map(frequency => ({
            id: `schedule_${frequency}`,
            file: `schedule_${frequency}.csv`,
            name: `${frequency} Days`,
            collection_time_minutes: 15,
            frequency
        }));
        setSchedules([...schedules, ...newSchedules]);
    };

    return (
        <div className="h-full flex flex-col">
            {/* Route Configuration Card */}
            <form onSubmit={handleSubmit} className="bg-white/95 backdrop-blur shadow-lg rounded-xl border border-gray-200/50 overflow-hidden flex-shrink-0">
                <div className="px-3 py-2.5 border-b border-gray-50/80 bg-white sticky top-0 z-0 shadow-sm flex justify-between items-center">
                    <h2 className="text-sm font-medium text-gray-900">Route Configuration</h2>
                    <div className="flex gap-1.5">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs px-3 py-1.5 rounded-lg transition-all bg-gray-100 hover:bg-gray-200 text-gray-700"
                        >
                            Import
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            onChange={handleConfigUpload}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={handleExportConfig}
                            className="text-xs px-3 py-1.5 rounded-lg transition-all bg-blue-50 hover:bg-blue-100 text-blue-600"
                        >
                            Export
                        </button>
                    </div>
                </div>
                
                <div className="divide-y divide-gray-100">
                    <div className="p-3 space-y-3">
                        {configError && (
                            <div className="text-red-500 text-xs p-2 bg-red-50 rounded-lg border border-red-100">
                                Failed to load default config: {configError}
                            </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-700">Depot Latitude</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={depot_location[0]}
                                    onChange={(e) => setDepotLocation(e.target.valueAsNumber, depot_location[1])}
                                    className="w-full border border-gray-200 p-1.5 text-sm rounded-lg bg-white/80 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-700">Depot Longitude</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={depot_location[1]}
                                    onChange={(e) => setDepotLocation(depot_location[0], e.target.valueAsNumber)}
                                    className="w-full border border-gray-200 p-1.5 text-sm rounded-lg bg-white/80 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-700">Solver Algorithm</label>
                            <select
                                value={solver}
                                onChange={(e) => setSolver(e.target.value)}
                                className="w-full border border-gray-200 p-1.5 text-sm rounded-lg bg-white/80 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow disabled:bg-gray-100 disabled:text-gray-500"
                            >
                                {isSolversLoading ? (
                                    <option value="" disabled>Loading...</option>
                                ) : solverListErr ? (
                                    <option value="" disabled>Error loading solvers</option>
                                ) : solvers.map(solver => (
                                    <option key={solver.id} value={solver.id} title={solver.description}>
                                        {solver.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || locations.length === 0}
                            className={`w-full py-2 text-sm rounded-lg transition-all ${
                                isLoading 
                                    ? 'bg-gray-400 text-white cursor-not-allowed' 
                                    : locations.length === 0
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm hover:shadow'
                            }`}
                        >
                            {isLoading ? 'Calculating...' : 'Generate Routes'}
                        </button>
                    </div>

                    {/* Time Constraints Section */}
                    <div className="border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => toggleSection('timeConstraints')}
                            className="w-full px-3 py-2.5 flex justify-between items-center hover:bg-gray-50"
                        >
                            <span className="text-sm font-medium text-gray-900">Time Constraints</span>
                            <svg
                                className={`w-5 h-5 text-gray-500 transition-transform ${
                                    openSections.has('timeConstraints') ? 'rotate-180' : ''
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {openSections.has('timeConstraints') && (
                            <div className="p-3 space-y-2 bg-gray-50/50">
                                <div className="p-2 rounded-lg bg-gray-50/80 border border-gray-100">
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-medium text-gray-700">
                                                Maximum daily time
                                                <span className="ml-1 text-gray-400 hover:text-gray-600 cursor-help" title="The maximum amount of time a vehicle can operate in a single day, including driving time and collection time at each stop.">
                                                    ⓘ
                                                </span>
                                            </label>
                                            <span className="text-xs text-gray-500" title="Supported units: y (years), d (days), h (hours), m (minutes), s (seconds)">
                                                Supported format: 8h, 1d, 30m
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            value={humanMaxDailyTime}
                                            onChange={(e) => setHumanMaxDailyTime(e.target.value)}
                                            placeholder="e.g., 8h, 1d, 8h 30m"
                                            title="Examples: 8h (8 hours), 1d (1 day), 8h 30m (8 hours and 30 minutes). This limits how long each vehicle can work per day."
                                            className="w-full border border-gray-200 p-1.5 text-sm rounded-lg bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
                                        />
                                        <div className="text-xs text-gray-500 space-y-1">
                                            <p>Combine units with spaces: 8h 30m, 1d 4h</p>
                                            <p>This is the total working time limit for each vehicle per day, including both driving and collection time at stops.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Vehicles Section */}
                    <div className="border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => toggleSection('vehicles')}
                            className="w-full px-3 py-2.5 flex justify-between items-center hover:bg-gray-50"
                        >
                            <span className="text-sm font-medium text-gray-900">Vehicles</span>
                            <svg
                                className={`w-5 h-5 text-gray-500 transition-transform ${
                                    openSections.has('vehicles') ? 'rotate-180' : ''
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {openSections.has('vehicles') && (
                            <div className="p-3 space-y-2 bg-gray-50/50">
                                <div className="p-2 rounded-lg bg-gray-50/80 border border-gray-100">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-700">Average Speed (km/h)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            step="1"
                                            value={config.settings.average_speed_kph}
                                            onChange={(e) => useConfigStore.getState().updateSettings({
                                                ...config.settings,
                                                average_speed_kph: e.target.valueAsNumber || 30
                                            })}
                                            placeholder="Enter average speed"
                                            className="w-full border border-gray-200 p-1.5 text-sm rounded-lg bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
                                        />
                                    </div>
                                </div>
                                {vehicles.map((vehicle, index) => (
                                    <div key={vehicle.id} className="flex gap-2 items-center p-2 rounded-lg bg-gray-50/80 border border-gray-100">
                                        <input
                                            type="text"
                                            value={vehicle.id}
                                            onChange={(e) => updateVehicle({ ...vehicle, id: e.target.value })}
                                            placeholder="ID"
                                            className="border border-gray-200 p-1.5 rounded-lg bg-white flex-1 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
                                        />
                                        <input
                                            type="number"
                                            value={vehicle.capacity}
                                            onChange={(e) => updateVehicle({ ...vehicle, capacity: parseInt(e.target.value) })}
                                            placeholder="Capacity"
                                            className="border border-gray-200 p-1.5 rounded-lg bg-white w-24 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeVehicle(index)}
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addVehicle}
                                    className="w-full py-2 text-sm rounded-lg transition-all border border-blue-500 text-blue-500 hover:bg-blue-50"
                                >
                                    Add Vehicle
                                </button>
                            </div>
                        )}
                    </div>

                    {/* One-Way Roads Section */}
                    <div className="border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => toggleSection('oneWayRoads')}
                            className="w-full px-3 py-2.5 flex justify-between items-center hover:bg-gray-50"
                        >
                            <span className="text-sm font-medium text-gray-900">One-Way Roads</span>
                            <svg
                                className={`w-5 h-5 text-gray-500 transition-transform ${
                                    openSections.has('oneWayRoads') ? 'rotate-180' : ''
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {openSections.has('oneWayRoads') && (
                            <div className="p-3 space-y-2 bg-gray-50/50">
                                {one_way_roads.map((road, roadIndex) => (
                                    <div key={roadIndex} className="p-2 rounded-lg bg-gray-50/80 border border-gray-100 space-y-2">
                                        <div className="flex gap-2 items-center">
                                            <span className="text-xs font-medium text-gray-600 w-10">From</span>
                                            <input
                                                type="number"
                                                step="any"
                                                value={road[0][0]}
                                                onChange={(e) => handleUpdateOneWayRoad(roadIndex, 0, 0, e.target.value)}
                                                placeholder="Lat"
                                                className="border border-gray-200 p-1.5 rounded-lg bg-white flex-1 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
                                            />
                                            <input
                                                type="number"
                                                step="any"
                                                value={road[0][1]}
                                                onChange={(e) => handleUpdateOneWayRoad(roadIndex, 0, 1, e.target.value)}
                                                placeholder="Lng"
                                                className="border border-gray-200 p-1.5 rounded-lg bg-white flex-1 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
                                            />
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <span className="text-xs font-medium text-gray-600 w-10">To</span>
                                            <input
                                                type="number"
                                                step="any"
                                                value={road[1][0]}
                                                onChange={(e) => handleUpdateOneWayRoad(roadIndex, 1, 0, e.target.value)}
                                                placeholder="Lat"
                                                className="border border-gray-200 p-1.5 rounded-lg bg-white flex-1 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
                                            />
                                            <input
                                                type="number"
                                                step="any"
                                                value={road[1][1]}
                                                onChange={(e) => handleUpdateOneWayRoad(roadIndex, 1, 1, e.target.value)}
                                                placeholder="Lng"
                                                className="border border-gray-200 p-1.5 rounded-lg bg-white flex-1 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveOneWayRoad(roadIndex)}
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleAddOneWayRoad}
                                    className="w-full py-2 text-sm rounded-lg transition-all border border-blue-500 text-blue-500 hover:bg-blue-50"
                                >
                                    Add One-Way Road
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </form>

            {/* Locations/Schedules Card */}
            <div className="bg-white/95 backdrop-blur shadow-lg rounded-xl border border-gray-200/50 overflow-hidden mt-3 flex flex-col flex-1 min-h-0">
                <div className="px-3 py-2.5 border-b border-gray-50/80 bg-white shadow-sm flex-shrink-0 flex justify-between items-center">
                    <h2 className="text-sm font-medium text-gray-900">Schedules</h2>
                    <button
                        onClick={() => setIsBulkImportOpen(true)}
                        className="text-xs px-3 py-1.5 rounded-lg transition-all bg-blue-50 hover:bg-blue-100 text-blue-600"
                    >
                        Bulk Import
                    </button>
                </div>
                <div className="flex-1 overflow-auto">
                    <ScheduleLocationsTab
                        schedules={schedules}
                        locations={locations}
                        onUpdateSchedules={setSchedules}
                        onAddLocation={addLocation}
                        onRemoveLocation={removeLocation}
                        onEditLocation={(location) => {
                            setEditingLocation(location);
                            setIsLocationModalOpen(true);
                        }}
                        currentSchedule={currentSchedule}
                        onScheduleChange={setCurrentSchedule}
                    />
                </div>
            </div>

            <LocationEditorModal
                isOpen={isLocationModalOpen}
                onClose={() => {
                    setIsLocationModalOpen(false);
                    setEditingLocation(undefined);
                }}
                location={editingLocation}
                onSave={handleLocationSave}
                schedules={schedules}
            />

            <BulkImportWrapper
                isOpen={isBulkImportOpen}
                onClose={() => setIsBulkImportOpen(false)}
                onAddLocation={addLocation}
                schedules={schedules}
                onAddSchedules={handleAutoCreateSchedules}
            />
        </div>
    );
}
