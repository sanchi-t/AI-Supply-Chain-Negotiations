from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.core.config import get_settings
from backend.app.main import app
from backend.app.models.run import (
    Agent,
    AgentRole,
    DeliveredMessage,
    DiagnosisSummary,
    NegotiationRecord,
    NegotiationStatus,
    NegotiationStep,
    Phase,
    PhaseName,
    ProductMarketContext,
    ReservationPrices,
    RunRecord,
    RunStatus,
    utc_now,
)
from backend.app.services.counterfactual_service import build_branch_run_config
from backend.app.services.event_repository import get_run_event_log
from backend.app.services.run_repository import get_run_record, save_run_record


def _configure_storage(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "")
    monkeypatch.setenv("AI_PROVIDER", "openai")  # use openai so empty key triggers 503 in tests
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "")
    monkeypatch.setenv("A2A_RUNS_DIR", str(tmp_path / "runs"))
    monkeypatch.setenv("A2A_EVENTS_DIR", str(tmp_path / "events"))
    monkeypatch.setenv("A2A_EXPORTS_DIR", str(tmp_path / "exports"))
    get_settings.cache_clear()


def test_health_and_empty_runs(monkeypatch, tmp_path):
    _configure_storage(monkeypatch, tmp_path)
    client = TestClient(app)

    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/runs").json() == []


def test_simulation_run_requires_openai_without_creating_runs(monkeypatch, tmp_path):
    _configure_storage(monkeypatch, tmp_path)
    client = TestClient(app)

    response = client.post("/simulation/run", json={"seed": 42})

    assert response.status_code == 503
    assert response.json()["detail"] == "OPENAI_API_KEY is not configured."
    assert not list((tmp_path / "runs").glob("*.json"))


def test_custom_simulation_run_launches_one_configured_run(monkeypatch, tmp_path):
    _configure_storage(monkeypatch, tmp_path)

    class FakeStatusClient:
        def __init__(self, *_args, **_kwargs):
            pass

        def get_status(self):
            return True, True, "Ready."

    class FakeThread:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

        def start(self):
            return None

    monkeypatch.setattr(
        "backend.app.services.simulation_service.get_ai_client",
        lambda _settings: FakeStatusClient(),
    )
    monkeypatch.setattr("backend.app.services.simulation_service.Thread", FakeThread)
    client = TestClient(app)

    response = client.post(
        "/simulation/run/custom",
        json={
            "title": "Custom Orange Negotiation",
            "product_name": "Orange Juice",
            "product_category": "beverages",
            "market_region": "California",
            "baseline_unit_price": 2.75,
            "target_quantity": 1000,
            "currency": "USD",
            "demand_signal": "Retail buyers want stable pricing.",
            "supply_signal": "Sellers are watching input costs.",
            "max_rounds_per_negotiation": 15,
            "supplier_min_sell_price": 2.35,
            "manufacturer_max_buy_price": 2.95,
            "manufacturer_min_sell_price": 3.25,
            "retailer_max_buy_price": 3.85,
            "manufacturer_margin_floor": 0.3,
        },
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["count"] == 1
    run = payload["runs"][0]
    assert run["title"] == "Custom Orange Negotiation"
    assert run["product_context"]["market_region"] == "California"
    assert run["product_context"]["target_quantity"] == 1000
    assert run["max_rounds_per_negotiation"] == 15


def test_custom_simulation_run_caps_rounds_at_fifteen(monkeypatch, tmp_path):
    _configure_storage(monkeypatch, tmp_path)
    client = TestClient(app)

    response = client.post(
        "/simulation/run/custom",
        json={
            "title": "Invalid Custom Orange Negotiation",
            "product_name": "Orange Juice",
            "product_category": "beverages",
            "market_region": "California",
            "baseline_unit_price": 2.75,
            "target_quantity": 1000,
            "currency": "USD",
            "demand_signal": "Retail buyers want stable pricing.",
            "supply_signal": "Sellers are watching input costs.",
            "max_rounds_per_negotiation": 16,
            "supplier_min_sell_price": 2.35,
            "manufacturer_max_buy_price": 2.95,
            "manufacturer_min_sell_price": 3.25,
            "retailer_max_buy_price": 3.85,
            "manufacturer_margin_floor": 0.3,
        },
    )

    assert response.status_code == 422


def test_counterfactual_replay_is_read_only(monkeypatch, tmp_path):
    _configure_storage(monkeypatch, tmp_path)
    run = _sample_completed_run()
    save_run_record(run)
    before_files = sorted((tmp_path / "runs").glob("*.json"))
    client = TestClient(app)

    response = client.get(f"/runs/{run.id}/counterfactual")
    payload = response.json()

    assert response.status_code == 200
    assert payload["run_id"] == run.id
    assert payload["title"] == run.title
    assert payload["currency"] == "USD"
    assert "baseline" not in payload
    assert "scenarios" not in payload
    assert [point["step_index"] for point in payload["turning_points"]] == [1, 2, 3, 4]
    assert sorted((tmp_path / "runs").glob("*.json")) == before_files


def test_counterfactual_scenario_rerun_route_was_removed(monkeypatch, tmp_path):
    _configure_storage(monkeypatch, tmp_path)
    run = _sample_completed_run()
    save_run_record(run)
    client = TestClient(app)

    response = client.post(
        f"/runs/{run.id}/counterfactual/run",
        json={"scenario_id": "one_more_round"},
    )

    assert response.status_code == 404


def test_branch_config_uses_pivot_and_instruction():
    run = _sample_completed_run()

    config = build_branch_run_config(
        run,
        pivot_step_index=3,
        instruction="Have the manufacturer hold price but offer faster delivery.",
        label="Faster Delivery",
    )

    assert config.title == "Counterfactual Test Run Branch - Faster Delivery"
    assert config.branch_source_run_id == run.id
    assert config.branch_pivot_step_index == 3
    assert config.branch_instruction == "Have the manufacturer hold price but offer faster delivery."
    assert "Step 3" in config.branch_context
    assert "Opening at 3.10." in config.branch_context


def test_branch_endpoint_requires_click_and_openai(monkeypatch, tmp_path):
    _configure_storage(monkeypatch, tmp_path)
    run = _sample_completed_run()
    save_run_record(run)
    before_files = sorted((tmp_path / "runs").glob("*.json"))
    client = TestClient(app)

    response = client.post(
        f"/runs/{run.id}/counterfactual/branch",
        json={
            "pivot_step_index": 3,
            "instruction": "Have the manufacturer hold price but offer faster delivery.",
            "label": "Faster Delivery",
        },
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "OPENAI_API_KEY is not configured."
    assert sorted((tmp_path / "runs").glob("*.json")) == before_files


def test_branch_endpoint_copies_history_through_pivot(monkeypatch, tmp_path):
    _configure_storage(monkeypatch, tmp_path)
    run = _sample_completed_run()
    save_run_record(run)

    class FakeStatusClient:
        def __init__(self, *_args, **_kwargs):
            pass

        def get_status(self):
            return True, True, "Ready."

    class FakeThread:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

        def start(self):
            return None

    monkeypatch.setattr(
        "backend.app.services.simulation_service.get_ai_client",
        lambda _settings: FakeStatusClient(),
    )
    monkeypatch.setattr("backend.app.services.simulation_service.Thread", FakeThread)
    client = TestClient(app)

    response = client.post(
        f"/runs/{run.id}/counterfactual/branch",
        json={
            "pivot_step_index": 3,
            "instruction": "Have the manufacturer hold price but offer faster delivery.",
            "label": "Faster Delivery",
        },
    )
    payload = response.json()

    assert response.status_code == 200
    branch = get_run_record(payload["run_id"])
    assert branch is not None
    assert [step.model_dump() for step in branch.steps] == [
        step.model_dump() for step in run.steps[:3]
    ]
    assert branch.negotiations == [run.negotiations[0]]
    assert branch.status == RunStatus.RUNNING
    assert "Operator instruction" in branch.diagnosis.key_signals[1]
    assert "faster delivery" in branch.diagnosis.key_signals[1]
    event_log = get_run_event_log(get_settings().events_dir, payload["run_id"])
    assert event_log is not None
    operator_events = [
        event for event in event_log.events if event.event_type == "operator_instruction"
    ]
    assert len(operator_events) == 1
    assert operator_events[0].phase == run.steps[2].phase
    assert operator_events[0].round == run.steps[2].round_number
    assert operator_events[0].note == "Have the manufacturer hold price but offer faster delivery."


def test_branch_endpoint_rejects_unknown_pivot(monkeypatch, tmp_path):
    _configure_storage(monkeypatch, tmp_path)
    run = _sample_completed_run()
    save_run_record(run)
    client = TestClient(app)

    response = client.post(
        f"/runs/{run.id}/counterfactual/branch",
        json={
            "pivot_step_index": 999,
            "instruction": "Try an impossible branch.",
        },
    )

    assert response.status_code == 400
    assert "Step 999 was not found" in response.json()["detail"]


def _sample_completed_run() -> RunRecord:
    now = utc_now()
    return RunRecord(
        id="run-counterfactual-test",
        title="Counterfactual Test Run",
        status=RunStatus.COMPLETED,
        scenario="Orange Juice in California.",
        created_at=now,
        updated_at=now,
        product_context=ProductMarketContext(
            product_name="Orange Juice",
            product_category="condiments",
            market_region="California",
            baseline_unit_price=2.5,
            target_quantity=1000,
            currency="USD",
            demand_signal="Steady demand.",
            supply_signal="Tight supply.",
        ),
        agents=[
            Agent(
                id="supplier",
                name="Supplier",
                role=AgentRole.SUPPLIER,
                objective="Sell above floor.",
                reservation_prices=ReservationPrices(min_sell_price=2.1),
            ),
            Agent(
                id="manufacturer",
                name="Manufacturer",
                role=AgentRole.MANUFACTURER,
                objective="Protect margin.",
                reservation_prices=ReservationPrices(min_sell_price=2.8, max_buy_price=2.6),
            ),
            Agent(
                id="retailer",
                name="Retailer",
                role=AgentRole.RETAILER,
                objective="Buy below ceiling.",
                reservation_prices=ReservationPrices(max_buy_price=3.3),
            ),
        ],
        phases=[
            Phase(
                name=PhaseName.SUPPLIER_MANUFACTURER,
                label="Supplier to Manufacturer",
                order=1,
                description="Upstream negotiation.",
            ),
            Phase(
                name=PhaseName.MANUFACTURER_RETAILER,
                label="Manufacturer to Retailer",
                order=2,
                description="Downstream negotiation.",
            ),
        ],
        steps=[
            NegotiationStep(
                index=1,
                phase=PhaseName.SUPPLIER_MANUFACTURER,
                negotiation_id="neg-up",
                round_number=1,
                agent_id="supplier",
                kind="offer",
                message="Opening at 2.55.",
                outcome="Offer made.",
                proposed_price=2.55,
                delivered_message=None,
                created_at=now,
            ),
            NegotiationStep(
                index=2,
                phase=PhaseName.SUPPLIER_MANUFACTURER,
                negotiation_id="neg-up",
                round_number=1,
                agent_id="manufacturer",
                kind="accept",
                message="Accepted.",
                outcome="Accepted.",
                proposed_price=2.4,
                delivered_message=DeliveredMessage(
                    type="offer",
                    price=2.4,
                    note="Final upstream offer.",
                    from_agent_id="supplier",
                ),
                created_at=now,
            ),
            NegotiationStep(
                index=3,
                phase=PhaseName.MANUFACTURER_RETAILER,
                negotiation_id="neg-down",
                round_number=1,
                agent_id="manufacturer",
                kind="offer",
                message="Opening at 3.10.",
                outcome="Offer made.",
                proposed_price=3.1,
                delivered_message=None,
                created_at=now,
            ),
            NegotiationStep(
                index=4,
                phase=PhaseName.MANUFACTURER_RETAILER,
                negotiation_id="neg-down",
                round_number=1,
                agent_id="retailer",
                kind="accept",
                message="Accepted.",
                outcome="Accepted.",
                proposed_price=3.1,
                delivered_message=DeliveredMessage(
                    type="offer",
                    price=3.1,
                    note="Final downstream offer.",
                    from_agent_id="manufacturer",
                ),
                created_at=now,
            ),
        ],
        negotiations=[
            NegotiationRecord(
                id="neg-up",
                phase=PhaseName.SUPPLIER_MANUFACTURER,
                label="Supplier to Manufacturer",
                seller_agent_id="supplier",
                buyer_agent_id="manufacturer",
                status=NegotiationStatus.ACCEPTED,
                max_rounds=4,
                quantity=1000,
                rounds_completed=1,
                opening_seller_offer=2.55,
                opening_buyer_offer=2.4,
                final_price=2.4,
                outcome_summary="Supplier to Manufacturer accepted at 2.40.",
                dependency_note="Upstream deal.",
            ),
            NegotiationRecord(
                id="neg-down",
                phase=PhaseName.MANUFACTURER_RETAILER,
                label="Manufacturer to Retailer",
                seller_agent_id="manufacturer",
                buyer_agent_id="retailer",
                status=NegotiationStatus.ACCEPTED,
                max_rounds=4,
                quantity=1000,
                rounds_completed=1,
                opening_seller_offer=3.1,
                opening_buyer_offer=3.1,
                final_price=3.1,
                outcome_summary="Manufacturer to Retailer accepted at 3.10.",
                dependency_note="Downstream deal.",
            ),
        ],
        diagnosis=DiagnosisSummary(
            outcome="Both deals accepted.",
            chain_effect="Manufacturer margin is preserved.",
            key_risks=[],
            key_signals=[],
            suggested_next_actions=[],
        ),
        max_rounds_per_negotiation=4,
        notes="Test run.",
        tags=["test"],
    )
