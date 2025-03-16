import { Dialog } from '@headlessui/react';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (files: File[]) => void;
}

export default function ImportModal({ isOpen, onClose, onComplete }: ImportModalProps) {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        setSelectedFiles(prev => [...prev, ...acceptedFiles]);
    }, []);

    const handleComplete = () => {
        onComplete(selectedFiles);
        setSelectedFiles([]);
        onClose();
    };

    const handleClearFiles = () => {
        setSelectedFiles([]);
    };

    const handleRemoveFile = (file: File) => {
        setSelectedFiles(prev => prev.filter(f => f !== file));
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/json': ['.json']
        },
        multiple: true
    });

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-[110]">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-md bg-white rounded-xl shadow-lg">
                    <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                        <Dialog.Title className="text-lg font-medium">Import Locations</Dialog.Title>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                            ×
                        </button>
                    </div>

                    <div className="p-4 space-y-4">
                        <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}>
                            <input {...getInputProps()} />
                            <div className="space-y-2">
                                <svg 
                                    className="w-12 h-12 mx-auto text-gray-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.5}
                                        d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                </svg>
                                <div className="text-sm text-gray-600">
                                    {isDragActive ? (
                                        <p>Drop the CSV file here</p>
                                    ) : (
                                        <p>Drag & drop a CSV file here, or click to select</p>
                                    )}
                                </div>
                                <div className="text-xs text-gray-500">
                                    .csv and .json files are supported
                                </div>
                            </div>
                        </div>

                        {selectedFiles.length > 0 && (
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center">
                                    <span className="text-sm font-medium text-gray-700">
                                        Selected Files ({selectedFiles.length})
                                    </span>
                                </div>
                                <div className="max-h-[200px] overflow-y-auto divide-y divide-gray-100">
                                    {selectedFiles.map((file) => (
                                        <div key={file.name} className="px-4 py-2 flex justify-between items-center hover:bg-gray-50">
                                            <div>
                                                <div className="font-medium text-sm">{file.name}</div>
                                                <div className="text-xs text-gray-500">
                                                    {(file.size / 1024).toFixed(1)} KB
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveFile(file)}
                                                className="px-2 py-1 text-xs rounded-lg text-red-600 hover:bg-red-50"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 justify-end pt-2 p-4">
                        <button
                            onClick={handleClearFiles}
                            className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                        >
                            Clear All
                        </button>
                        <button
                            onClick={handleComplete}
                            disabled={selectedFiles.length === 0}
                            className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                            Import Files
                        </button>
                    </div>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
