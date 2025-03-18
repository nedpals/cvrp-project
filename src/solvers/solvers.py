from .or_tools_solver import ORToolsSolver
from .greedy_solver import GreedySolver
from .nearest_neighbor_solver import NearestNeighborSolver
from .basic_solver import BasicSolver

# Solver mapping
SOLVERS = {
    'ortools': ORToolsSolver,
    'greedy': GreedySolver,
    'nearest': NearestNeighborSolver,
    'schedule': BasicSolver
}