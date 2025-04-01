from pydantic import BaseModel, Field
from typing import List, Tuple, Optional
from utils import MAX_DAILY_TIME
from models.shared_models import (
    Location,
    RouteConstraints,
    ScheduleEntry as SharedScheduleEntry
)

class MapConfig(BaseModel):
    center: Optional[Tuple[float, float]]
    zoom_level: int
    path_weight: int
    path_opacity: float

class VehicleConfig(BaseModel):
    id: str
    capacity: float

class SolveConfig(BaseModel):
    solver: Optional[str] = 'schedule'
    vehicles: List['VehicleConfig']
    depot_location: Tuple[float, float]
    constraints: 'RouteConstraints'
    max_daily_time: Optional[int] = Field(default=MAX_DAILY_TIME, gt=0, description="Max daily time in minutes")
    average_speed_kph: float = 30.0  # Default city speed

class Config(BaseModel):
    map: MapConfig
    schedules: List[SharedScheduleEntry] = Field(default_factory=list)
    locations: List[Location] = Field(default_factory=list)
    settings: SolveConfig