from pathlib import Path

from backend.app.core.config import get_settings
from backend.app.models.run import RunRecord, RunSummary
from backend.app.services.json_store import ensure_directory, read_json, write_json


def list_run_summaries() -> list[RunSummary]:
    runs_dir = get_settings().runs_dir
    ensure_directory(runs_dir)

    summaries: list[RunSummary] = []
    for file_path in runs_dir.glob("*.json"):
        run = RunRecord.model_validate(read_json(file_path))
        summaries.append(run.to_summary())

    return sorted(summaries, key=lambda item: item.updated_at, reverse=True)


def get_run_record(run_id: str) -> RunRecord | None:
    runs_dir = get_settings().runs_dir
    ensure_directory(runs_dir)

    file_path = _run_path(run_id, runs_dir=runs_dir)
    if not file_path.exists():
        return None

    return RunRecord.model_validate(read_json(file_path))


def save_run_record(run: RunRecord) -> None:
    write_json(
        _run_path(run.id, runs_dir=get_settings().runs_dir),
        run.model_dump(mode="json"),
    )


def _run_path(run_id: str, *, runs_dir: Path) -> Path:
    return runs_dir / f"{run_id}.json"
