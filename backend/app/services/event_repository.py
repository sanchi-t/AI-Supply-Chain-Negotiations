from pathlib import Path

from backend.app.models.run import RunEventLog
from backend.app.services.json_store import ensure_directory, read_json, write_json


def get_run_event_log(events_dir: Path, run_id: str) -> RunEventLog | None:
    ensure_directory(events_dir)

    file_path = _event_log_path(events_dir, run_id)
    if not file_path.exists():
        return None

    return RunEventLog.model_validate(read_json(file_path))


def save_run_event_log(events_dir: Path, event_log: RunEventLog) -> None:
    write_json(_event_log_path(events_dir, event_log.run_id), event_log.model_dump(mode="json"))


def _event_log_path(events_dir: Path, run_id: str) -> Path:
    return events_dir / f"{run_id}.events.json"
