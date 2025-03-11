import { ReactNode } from 'react';

interface Tab {
    id: string;
    label: string;
    content: ReactNode;
}

interface TabCardProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
}

export default function TabCard({ tabs, activeTab, onTabChange }: TabCardProps) {
    return (
        <div className="bg-white/95 backdrop-blur rounded-lg shadow-lg overflow-hidden">
            <div className="flex border-b">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onTabChange(tab.id)}
                        className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                            activeTab === tab.id
                                ? 'bg-white text-blue-600 border-b-2 border-blue-500'
                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="p-3">
                {tabs.find(tab => tab.id === activeTab)?.content}
            </div>
        </div>
    );
}
