from typing import List, Tuple
from models.shared_models import ScheduleEntry as SharedScheduleEntry
from models.config import VehicleConfig
from pydantic import BaseModel

class LocationRequest(BaseModel):
    id: str
    id_num: str
    name: str
    coordinates: Tuple[float, float]
    wco_amount: float
    disposal_schedule: int

class ConfigRequest(BaseModel):
    depot_location: Tuple[float, float]
    vehicles: List[VehicleConfig]
    schedules: List[SharedScheduleEntry]
    one_way_roads: List[List[Tuple[float, float]]]
    solver: str = "schedule"
    allow_multiple_trips: bool = True
