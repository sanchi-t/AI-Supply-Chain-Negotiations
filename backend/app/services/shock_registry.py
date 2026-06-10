from dataclasses import dataclass, replace
from datetime import datetime
from threading import Lock

from backend.app.models.run import utc_now


@dataclass(slots=True)
class PendingShock:
    shock_type: str
    multiplier: float
    headline: str
    consumed: bool
    queued_at: datetime


class ShockRegistry:
    def __init__(self) -> None:
        self._lock = Lock()
        self._pending_by_run_id: dict[str, PendingShock] = {}

    def register(self, run_id: str, shock: PendingShock) -> PendingShock:
        with self._lock:
            self._pending_by_run_id[run_id] = shock
            return shock

    def has_pending(self, run_id: str) -> bool:
        with self._lock:
            pending = self._pending_by_run_id.get(run_id)
            return pending is not None and not pending.consumed

    def consume(self, run_id: str) -> PendingShock | None:
        with self._lock:
            pending = self._pending_by_run_id.get(run_id)
            if pending is None or pending.consumed:
                return None

            consumed = replace(pending, consumed=True)
            self._pending_by_run_id[run_id] = consumed
            return consumed


SHOCK_PRESETS: dict[str, tuple[float, str]] = {
    "price_spike": (1.18, "Orange futures jump after processors warn of a sudden citrus input squeeze."),
    "supply_shortage": (1.26, "Regional grove shortage worsens as harvest yields miss distributor forecasts."),
    "demand_surge": (1.12, "Unexpected retail demand surge tightens near-term orange juice replenishment capacity."),
    "geopolitical": (1.21, "Geopolitical freight disruption hits cross-border citrus and packaging lanes."),
    "price_drop": (0.89, "Spot market prices drop after a surprise glut hits wholesale orange inventories."),
}


_registry = ShockRegistry()


def get_shock_registry() -> ShockRegistry:
    return _registry


def build_pending_shock(shock_type: str) -> PendingShock:
    if shock_type not in SHOCK_PRESETS:
        allowed = ", ".join(sorted(SHOCK_PRESETS))
        raise ValueError(f"Unsupported shock_type '{shock_type}'. Allowed values: {allowed}.")

    multiplier, headline = SHOCK_PRESETS[shock_type]
    return PendingShock(
        shock_type=shock_type,
        multiplier=multiplier,
        headline=headline,
        consumed=False,
        queued_at=utc_now(),
    )
