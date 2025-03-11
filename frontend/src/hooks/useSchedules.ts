import { useState } from 'react';
import { ScheduleEntry } from '../types/models';

export function useSchedules() {
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([
    { id: 's1', name: 'Default', frequency: 7, file: 'default.json' }
  ]);
  
  const addSchedule = () => {
    const newSchedule: ScheduleEntry = {
      id: `s${schedules.length + 1}`,
      name: `Schedule ${schedules.length + 1}`,
      frequency: 7,
      file: 'schedule.json'
    };
    setSchedules([...schedules, newSchedule]);
    return newSchedule;
  };
  
  const updateSchedule = (id: string, updates: Partial<ScheduleEntry>) => {
    setSchedules(prev => 
      prev.map(schedule => schedule.id === id ? { ...schedule, ...updates } : schedule)
    );
  };
  
  const removeSchedule = (id: string) => {
    setSchedules(prev => prev.filter(schedule => schedule.id !== id));
  };
  
  return {
    schedules,
    addSchedule,
    updateSchedule,
    removeSchedule,
    setSchedules
  };
}
