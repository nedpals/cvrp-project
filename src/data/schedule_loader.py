from pathlib import Path
import pandas as pd
from models.location import Location
from models.shared_models import ScheduleEntry
from models.location_registry import LocationRegistry
from uuid import uuid4

class ScheduleLoader:
    @staticmethod
    def load_schedule_data(schedule_entry: ScheduleEntry, base_path: Path) -> LocationRegistry:
        """Load location data from schedule-specific CSV file."""
        data_path = base_path / schedule_entry.file
        df = pd.read_csv(data_path)
        
        registry = LocationRegistry()
        for _, row in df.iterrows():
            location = Location(
                id=f"loc_{uuid4().hex[:8]}",
                name=row['name'],
                coordinates=(row['latitude'], row['longitude']),
                wco_amount=row['wco_amount'],
                disposal_schedule=row['disposal_schedule']
            )
            registry.add(location)
        
        return registry

    @classmethod
    def load_all_schedules(cls, schedule_entries, base_path: Path) -> LocationRegistry:
        """Load and combine location data from multiple schedules"""
        combined_registry = LocationRegistry()
        for schedule in schedule_entries:
            registry = cls.load_schedule_data(schedule, base_path)
            combined_registry = combined_registry + registry
        return combined_registry
