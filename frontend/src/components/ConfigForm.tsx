import { useState, useEffect, useRef } from 'react';
import { ConfigRequest, SolverInfo, Location } from '../types/models';
import TabCard from './TabCard';
import ScheduleLocationsTab from './ScheduleLocationsTab';
import { useSchedules } from '../hooks/useSchedules';
import { useVehicles } from '../hooks/useVehicles';
import { downloadConfigAsJson } from '../services/api';
import { useConfigStore } from '../stores/configStore';

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
    const [activeTab, setActiveTab] = useState('locations');

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
        if (defaultSolver && defaultSolver !== solver) {
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
            vehicles,
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

    const tabs = [
        {
            id: 'locations',
            label: 'Locations',
            content: (
                <ScheduleLocationsTab
                    schedules={schedules}
                    locations={locations}
                    onUpdateSchedules={setSchedules}
                    onAddLocation={onAddLocation}
                    onRemoveLocation={onRemoveLocation}
                />
            )
        },
        {
            id: 'vehicles',
            label: 'Vehicles',
            content: (
                <div className="space-y-2">
                    {vehicles.map((vehicle, index) => (
                        <div key={vehicle.id} className="flex gap-2 items-center">
                            <input
                                type="text"
                                value={vehicle.id}
                                onChange={(e) => updateVehicle(index, 'id', e.target.value)}
                                placeholder="ID"
                                className="border p-1.5 rounded bg-white/80 flex-1 text-sm"
                            />
                            <input
                                type="number"
                                value={vehicle.capacity}
                                onChange={(e) => updateVehicle(index, 'capacity', parseInt(e.target.value))}
                                placeholder="Capacity"
                                className="border p-1.5 rounded bg-white/80 w-20 text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => removeVehicle(index)}
                                className="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-600 focus:outline-none"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addVehicle}
                        className="w-full border border-blue-500 text-blue-500 py-1 px-2 rounded text-sm hover:bg-blue-50"
                    >
                        Add Vehicle
                    </button>
                </div>
            )
        },
        {
            id: 'one-way-roads',
            label: 'One-Way Roads',
            content: (
                <div className="space-y-2">
                    {oneWayRoads.map((road, roadIndex) => (
                        <div key={roadIndex} className="p-2 border rounded bg-white/80">
                            <div className="flex gap-2 items-center mb-2">
                                <span className="text-xs font-medium">From</span>
                                <input
                                    type="number"
                                    step="any"
                                    value={road[0][0]}
                                    onChange={(e) => handleUpdateOneWayRoad(roadIndex, 0, 0, e.target.value)}
                                    placeholder="Lat"
                                    className="border p-1.5 rounded bg-white/80 w-24 text-sm"
                                />
                                <input
                                    type="number"
                                    step="any"
                                    value={road[0][1]}
                                    onChange={(e) => handleUpdateOneWayRoad(roadIndex, 0, 1, e.target.value)}
                                    placeholder="Lng"
                                    className="border p-1.5 rounded bg-white/80 w-24 text-sm"
                                />
                            </div>
                            <div className="flex gap-2 items-center">
                                <span className="text-xs font-medium">To</span>
                                <input
                                    type="number"
                                    step="any"
                                    value={road[1][0]}
                                    onChange={(e) => handleUpdateOneWayRoad(roadIndex, 1, 0, e.target.value)}
                                    placeholder="Lat"
                                    className="border p-1.5 rounded bg-white/80 w-24 text-sm"
                                />
                                <input
                                    type="number"
                                    step="any"
                                    value={road[1][1]}
                                    onChange={(e) => handleUpdateOneWayRoad(roadIndex, 1, 1, e.target.value)}
                                    placeholder="Lng"
                                    className="border p-1.5 rounded bg-white/80 w-24 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleRemoveOneWayRoad(roadIndex)}
                                    className="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-600 focus:outline-none ml-auto"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={handleAddOneWayRoad}
                        className="w-full border border-blue-500 text-blue-500 py-1 px-2 rounded text-sm hover:bg-blue-50"
                    >
                        Add One-Way Road
                    </button>
                </div>
            )
        }
    ];

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div className="bg-white/95 backdrop-blur p-3 rounded-lg shadow-lg">
                <div className="flex flex-col space-y-2">
                    <div className="flex justify-between items-center">
                        <h2 className="text-base font-semibold text-gray-800">Route Configuration</h2>
                        <div className="flex space-x-2">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
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
                                className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100"
                            >
                                Export
                            </button>
                        </div>
                    </div>
                    
                    {configError && (
                        <div className="text-red-500 text-xs p-1.5 bg-red-50 rounded">
                            {configError}
                        </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Depot Latitude</label>
                            <input
                                type="number"
                                step="any"
                                value={depotLat}
                                onChange={(e) => setDepotLat(e.target.value)}
                                className="w-full border p-1.5 text-sm rounded bg-white/80"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Depot Longitude</label>
                            <input
                                type="number"
                                step="any"
                                value={depotLng}
                                onChange={(e) => setDepotLng(e.target.value)}
                                className="w-full border p-1.5 text-sm rounded bg-white/80"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Solver Algorithm</label>
                        <select
                            value={solver}
                            onChange={(e) => setSolver(e.target.value)}
                            className="w-full border p-1.5 text-sm rounded bg-white/80"
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
                        className={`w-full py-1.5 px-4 text-sm rounded transition-colors ${
                            isLoading 
                                ? 'bg-gray-400 text-white cursor-not-allowed' 
                                : locations.length === 0
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                    >
                        {isLoading ? 'Calculating...' : 'Generate Routes'}
                    </button>
                </div>
            </div>

            <TabCard
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
            />
        </form>
    );
}
