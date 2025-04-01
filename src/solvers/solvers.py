from .or_tools_solver import ORToolsSolver
from .greedy_solver import GreedySolver
from .nearest_neighbor_solver import NearestNeighborSolver
from .basic_solver import BasicSolver

# Solver mapping
SOLVERS = {
    ORToolsSolver.id: ORToolsSolver,
    GreedySolver.id: GreedySolver,
    NearestNeighborSolver.id: NearestNeighborSolver,
    BasicSolver.id: BasicSolver,
}

DEFAULT_SOLVER_ID = BasicSolver.id