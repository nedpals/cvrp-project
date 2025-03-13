from typing import List, Tuple
from pydantic import BaseModel
from models.shared_models import ScheduleEntry, Vehicle

class ConfigRequest(BaseModel):
    depot_location: Tuple[float, float]
    vehicles: List[Vehicle]
    schedules: List[ScheduleEntry]
    one_way_roads: List[List[Tuple[float, float]]]
    solver: str = "schedule"
    allow_multiple_trips: bool = True
