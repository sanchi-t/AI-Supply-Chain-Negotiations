from pathlib import Path
from typing import Any

from backend.app.services.json_store import ensure_directory, read_json, write_json


def save_simulation_export_bundle(
    exports_dir: Path,
    run_id: str,
    *,
    summary_payload: dict[str, Any],
    event_log_payload: dict[str, Any],
    trace_payload: dict[str, Any],
    conversation_payload: dict[str, Any],
) -> dict[str, Path]:
    export_dir = exports_dir / run_id
    ensure_directory(export_dir)

    summary_path = export_dir / "summary.json"
    event_log_path = export_dir / "event-log.json"
    trace_path = export_dir / "trace-metadata.json"
    conversation_path = export_dir / "conversation.json"

    write_json(summary_path, summary_payload)
    write_json(event_log_path, event_log_payload)
    write_json(trace_path, trace_payload)
    write_json(conversation_path, conversation_payload)

    return {
        "summary": summary_path,
        "event_log": event_log_path,
        "trace": trace_path,
        "conversation": conversation_path,
    }


def get_simulation_export_bundle(exports_dir: Path, run_id: str) -> dict[str, Any] | None:
    export_dir = exports_dir / run_id
    if not export_dir.exists():
        return None

    summary_path = export_dir / "summary.json"
    event_log_path = export_dir / "event-log.json"
    trace_path = export_dir / "trace-metadata.json"
    conversation_path = export_dir / "conversation.json"

    return {
        "paths": {
            "summary_path": str(summary_path) if summary_path.exists() else None,
            "event_log_path": str(event_log_path) if event_log_path.exists() else None,
            "trace_path": str(trace_path) if trace_path.exists() else None,
            "conversation_path": str(conversation_path) if conversation_path.exists() else None,
        },
        "summary": read_json(summary_path) if summary_path.exists() else None,
        "trace_metadata": read_json(trace_path) if trace_path.exists() else None,
        "conversation": read_json(conversation_path) if conversation_path.exists() else None,
    }
