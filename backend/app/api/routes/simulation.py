from fastapi import APIRouter, HTTPException

from backend.app.models.simulation import SimulationBatchLaunchResult
from backend.app.models.simulation_request import SimulationRunConfig, SimulationSeedRequest
from backend.app.services.simulation_service import (
    SimulationExecutionError,
    launch_configured_simulation,
    launch_seeded_simulations,
)


router = APIRouter(prefix="/simulation", tags=["simulation"])


@router.post("/run", response_model=SimulationBatchLaunchResult)
def run_simulation(
    payload: SimulationSeedRequest,
) -> SimulationBatchLaunchResult:
    try:
        return launch_seeded_simulations(payload)
    except SimulationExecutionError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/run/custom", response_model=SimulationBatchLaunchResult)
def run_custom_simulation(
    payload: SimulationRunConfig,
) -> SimulationBatchLaunchResult:
    try:
        run = launch_configured_simulation(payload)
        return SimulationBatchLaunchResult(seed=0, count=1, runs=[run])
    except SimulationExecutionError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
