from datetime import datetime

from pydantic import BaseModel

from backend.app.models.run import RunEvent, RunEventLog, RunRecord


class SimulationBatchLaunchResult(BaseModel):
    seed: int
    count: int
    runs: list[RunRecord]


class RunDetailExportArtifacts(BaseModel):
    summary_path: str | None = None
    event_log_path: str | None = None
    trace_path: str | None = None
    conversation_path: str | None = None


class RunDetailResponse(BaseModel):
    run: RunRecord
    event_log: RunEventLog | None = None
    trace_metadata: dict | None = None
    export_artifacts: RunDetailExportArtifacts | None = None
    derived: dict | None = None
    conversation: list[dict] | None = None


class RunShockRequest(BaseModel):
    shock_type: str


class RunShockResponse(BaseModel):
    run_id: str
    shock_type: str
    multiplier: float
    headline: str
    consumed: bool = False
    queued_at: datetime


class RunEventStreamPayload(BaseModel):
    type: str = "run_event"
    run_id: str
    event: RunEvent
