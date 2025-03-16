import { useState, useEffect, useRef } from 'react';
import { ConfigRequest, SolverInfo, Location } from '../types/models';
import ScheduleLocationsTab from './ScheduleLocationsTab';
import { useSchedules } from '../hooks/useSchedules';
import { useVehicles } from '../hooks/useVehicles';
import { downloadConfigAsJson } from '../services/api';
import { useConfigStore } from '../stores/configStore';
import LocationEditorModal from './LocationEditorModal';

interface ConfigFormProps {
    onSubmit: (config: ConfigRequest) => void;
    solvers: SolverInfo[];
    defaultSolver?: string;
    locations: Location[];
    onAddLocation: (location: Location) => void;
    onRemoveLocation: (id: string) => void;
    isLoading?: boolean;
}

export default function ConfigForm({ 
    onSubmit, 
    solvers, 
    defaultSolver,
    locations,
    onAddLocation,
    onRemoveLocation,
    isLoading = false
}: ConfigFormProps) {
    const { vehicles, addVehicle, removeVehicle, updateVehicle, setVehicles } = useVehicles();
    const { schedules, setSchedules } = useSchedules();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [configError, setConfigError] = useState<string | null>(null);
    const [openSections, setOpenSections] = useState<Set<string>>(new Set([]));
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<Location | undefined>();

    const {
        depotLat,
        depotLng,
        solver,
        oneWayRoads,
        setDepotLat,
        setDepotLng,
        setSolver,
        addOneWayRoad,
        updateOneWayRoad,
        removeOneWayRoad,
    } = useConfigStore();

    useEffect(() => {
        if (defaultSolver && !solver) {
            setSolver(defaultSolver);
        }
    }, [defaultSolver, solver]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(getCurrentConfig());
    };

    const getCurrentConfig = (): ConfigRequest => {
        return {
            depot_location: [parseFloat(depotLat), parseFloat(depotLng)],
            vehicles: vehicles.map(v => ({ ...v, depot_location: [parseFloat(depotLat), parseFloat(depotLng)] })),
            schedules,
            one_way_roads: oneWayRoads,
            solver,
            allow_multiple_trips: true
        };
    };

    const handleConfigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        setConfigError(null);
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const config = JSON.parse(event.target?.result as string);
                
                // Update depot location
                if (config.depot_location && Array.isArray(config.depot_location) && config.depot_location.length === 2) {
                    setDepotLat(config.depot_location[0].toString());
                    setDepotLng(config.depot_location[1].toString());
                }
                
                // Update vehicles
                if (config.vehicles && Array.isArray(config.vehicles)) {
                    setVehicles(config.vehicles);
                }
                
                // Update schedules
                if (config.schedules && Array.isArray(config.schedules)) {
                    setSchedules(config.schedules);
                }
                
                // Update solver if it exists in our available solvers
                if (config.solver && solvers.some(s => s.id === config.solver)) {
                    setSolver(config.solver);
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
        downloadConfigAsJson(getCurrentConfig());
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
            onRemoveLocation(editingLocation.id);
        }
        onAddLocation(location);
        setEditingLocation(undefined);
    };

    return (
        <div className="space-y-2 h-full flex flex-col">
            {/* Route Configuration Card */}
            <form onSubmit={handleSubmit} className="bg-white/95 backdrop-blur shadow-lg rounded-xl border border-gray-200/50 overflow-hidden">
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
                                {configError}
                            </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-700">Depot Latitude</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={depotLat}
                                    onChange={(e) => setDepotLat(e.target.value)}
                                    className="w-full border border-gray-200 p-1.5 text-sm rounded-lg bg-white/80 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-700">Depot Longitude</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={depotLng}
                                    onChange={(e) => setDepotLng(e.target.value)}
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
                                {solvers.map(solver => (
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
                                {vehicles.map((vehicle, index) => (
                                    <div key={vehicle.id} className="flex gap-2 items-center p-2 rounded-lg bg-gray-50/80 border border-gray-100">
                                        <input
                                            type="text"
                                            value={vehicle.id}
                                            onChange={(e) => updateVehicle(index, 'id', e.target.value)}
                                            placeholder="ID"
                                            className="border border-gray-200 p-1.5 rounded-lg bg-white flex-1 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
                                        />
                                        <input
                                            type="number"
                                            value={vehicle.capacity}
                                            onChange={(e) => updateVehicle(index, 'capacity', parseInt(e.target.value))}
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
                                {oneWayRoads.map((road, roadIndex) => (
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
            <div className="bg-white/95 backdrop-blur shadow-lg rounded-xl border border-gray-200/50 overflow-hidden flex-1">
                <div className="px-3 py-2.5 border-b border-gray-50/80 bg-white shadow-sm">
                    <h2 className="text-sm font-medium text-gray-900">Locations & Schedules</h2>
                </div>
                <div className="p-3">
                    <ScheduleLocationsTab
                        schedules={schedules}
                        locations={locations}
                        onUpdateSchedules={setSchedules}
                        onAddLocation={onAddLocation}
                        onRemoveLocation={onRemoveLocation}
                        onEditLocation={(location) => {
                            setEditingLocation(location);
                            setIsLocationModalOpen(true);
                        }}
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
        </div>
    );
}
