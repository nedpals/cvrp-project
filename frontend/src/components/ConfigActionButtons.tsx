import { useRef } from 'react';
import { ConfigRequest } from '../types/models';
import { downloadConfigAsJson } from '../services/api';

interface ConfigActionButtonsProps {
  config: ConfigRequest;
  onConfigImport: (config: ConfigRequest) => void;
  isGenerating: boolean;
  canGenerate: boolean;
  onGenerateRoutes: () => void;
}

export default function ConfigActionButtons({
  config,
  onConfigImport,
  isGenerating,
  canGenerate,
  onGenerateRoutes
}: ConfigActionButtonsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleConfigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const configData = JSON.parse(event.target?.result as string);
        onConfigImport(configData);
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Error parsing config file:', error);
        alert('Invalid JSON format');
      }
    };
    
    reader.readAsText(file);
  };

  return (
    <div className="flex items-center gap-2 justify-between">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-xs bg-gray-100 text-gray-700 px-2 py-1.5 rounded hover:bg-gray-200"
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
          onClick={() => downloadConfigAsJson(config)}
          className="text-xs bg-blue-50 text-blue-600 px-2 py-1.5 rounded hover:bg-blue-100"
        >
          Export
        </button>
      </div>
      
      <button
        type="button"
        onClick={onGenerateRoutes}
        disabled={isGenerating || !canGenerate}
        className={`py-1.5 px-4 text-sm rounded transition-colors ${
          isGenerating 
            ? 'bg-gray-400 text-white cursor-not-allowed' 
            : !canGenerate
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        {isGenerating ? 'Calculating...' : 'Generate Routes'}
      </button>
    </div>
  );
}
