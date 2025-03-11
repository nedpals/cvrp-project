from pydantic import BaseModel
from typing import List, Tuple
from models.shared_models import (
    ScheduleEntry as SharedScheduleEntry
)

class VisualizationConfig(BaseModel):
    zoom_level: int
    path_weight: int
    path_opacity: float

class VehicleConfig(BaseModel):
    id: str
    capacity: float

class ScheduleConfig(BaseModel):
    schedules: List[SharedScheduleEntry]
    vehicles: List[VehicleConfig]
    depot_location: Tuple[float, float]
    one_way_roads: List[Tuple[Tuple[float, float], Tuple[float, float]]]
    visualization: VisualizationConfig

    @classmethod
    def from_dict(cls, data: dict) -> 'ScheduleConfig':
        schedules = [SharedScheduleEntry(**s) for s in data['schedules']]
        vehicles = [VehicleConfig(**v) for v in data['vehicles']]
        visualization = VisualizationConfig(**data['visualization'])
        
        return cls(
            schedules=schedules,
            vehicles=vehicles,
            depot_location=tuple(data['depot_location']),
            one_way_roads=[tuple(map(tuple, road)) for road in data['one_way_roads']],
            visualization=visualization
        )
