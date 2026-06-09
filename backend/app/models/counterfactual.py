from pydantic import BaseModel, Field

from backend.app.models.run import PhaseName


class CounterfactualTurningPoint(BaseModel):
    step_index: int
    phase: PhaseName
    round_number: int
    agent_id: str
    kind: str
    price: float | None = None
    note: str


class CounterfactualReplayResponse(BaseModel):
    run_id: str
    title: str
    currency: str
    turning_points: list[CounterfactualTurningPoint]


class CounterfactualBranchRunRequest(BaseModel):
    pivot_step_index: int = Field(..., ge=1)
    instruction: str = Field(..., min_length=3, max_length=1200)
    label: str | None = Field(default=None, max_length=120)


class CounterfactualBranchRunResponse(BaseModel):
    source_run_id: str
    pivot_step_index: int
    run_id: str
    status: str
    message: str
