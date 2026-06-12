from contextlib import contextmanager

from backend.app.models.run import (
    Agent,
    AgentRole,
    NegotiationStep,
    NegotiationStatus,
    PhaseName,
    ReservationPrices,
    RunEventType,
    utc_now,
)
from backend.app.services.simulation_service import (
    RunEventCollector,
    _build_seeded_requests,
    _coerce_price,
    _simulate_negotiation,
)


class FakeOpenAI:
    def __init__(self, decisions):
        self._decisions = list(decisions)

    def decide_action(self, *_args, **_kwargs):
        return self._decisions.pop(0)


class FakeObservation:
    def update(self, **_kwargs):
        return None


class FakeLangfuse:
    @contextmanager
    def start_tool(self, **_kwargs):
        yield FakeObservation()

    @contextmanager
    def start_span(self, **_kwargs):
        yield FakeObservation()


def test_seed_builds_three_distinct_scenario_types():
    requests = _build_seeded_requests(42)

    assert len(requests) == 3
    assert [request.title.rsplit(" Seed ", 1)[0] for request in requests] == [
        "Orange Harvest Pricing Run",
        "Orange Harvest Pricing Run",
        "Orange Harvest Pricing Run",
    ]
    assert {request.market_region for request in requests} == {"California"}
    assert {request.product_name for request in requests} == {"Orange Juice"}
    assert all(request.target_quantity > 0 for request in requests)
    assert len({request.target_quantity for request in requests}) > 1
    assert all(request.max_rounds_per_negotiation <= 15 for request in requests)
    assert _build_seeded_requests(42) == requests


def test_coerce_price_handles_numeric_and_invalid_values():
    assert _coerce_price("2.345") == 2.35
    assert _coerce_price(4) == 4.0
    assert _coerce_price(None) is None
    assert _coerce_price("not-a-price") is None


def test_negotiation_accepts_offer_with_fake_decisions():
    supplier = Agent(
        id="supplier",
        name="Supplier",
        role=AgentRole.SUPPLIER,
        objective="Sell above floor.",
        reservation_prices=ReservationPrices(min_sell_price=2.0),
    )
    manufacturer = Agent(
        id="manufacturer",
        name="Manufacturer",
        role=AgentRole.MANUFACTURER,
        objective="Buy below ceiling.",
        reservation_prices=ReservationPrices(max_buy_price=3.0),
    )
    collector = RunEventCollector(run_id="run-test", created_at=utc_now())

    result = _simulate_negotiation(
        phase=PhaseName.SUPPLIER_MANUFACTURER,
        label="Supplier to Manufacturer",
        product_name="Orange Juice",
        scenario_context={"demand_signal": "Test demand.", "supply_signal": "Test supply."},
        reference_market_price=2.5,
        openai_wrapper=FakeOpenAI(
            [
                {
                    "action": "make_offer",
                    "price": 2.4,
                    "note": "We can supply at 2.40.",
                    "reason": "The offer clears our floor.",
                },
                {
                    "action": "accept_offer",
                    "price": None,
                    "note": "Accepted.",
                    "reason": "The offer is below our ceiling.",
                },
            ]
        ),
        langfuse_wrapper=FakeLangfuse(),
        run_id="run-test",
        event_collector=collector,
        seller=supplier,
        buyer=manufacturer,
        min_sell_price=2.0,
        max_buy_price=3.0,
        quantity=1000,
        max_rounds=2,
        step_index_start=1,
        dependency_note="Test negotiation.",
    )

    assert result.record.status == NegotiationStatus.ACCEPTED
    assert result.record.final_price == 2.4
    assert [step.kind for step in result.steps] == ["offer", "accept"]
    assert any(event.event_type == RunEventType.ACCEPT for event in collector.events)


def test_negotiation_resumes_after_existing_steps():
    supplier = Agent(
        id="supplier",
        name="Supplier",
        role=AgentRole.SUPPLIER,
        objective="Sell above floor.",
        reservation_prices=ReservationPrices(min_sell_price=2.0),
    )
    manufacturer = Agent(
        id="manufacturer",
        name="Manufacturer",
        role=AgentRole.MANUFACTURER,
        objective="Buy below ceiling.",
        reservation_prices=ReservationPrices(max_buy_price=3.0),
    )
    now = utc_now()
    existing_step = NegotiationStep(
        index=1,
        phase=PhaseName.SUPPLIER_MANUFACTURER,
        negotiation_id="neg-existing",
        round_number=1,
        agent_id="supplier",
        kind="offer",
        message="Opening at 2.40.",
        outcome="Offer made.",
        proposed_price=2.4,
        delivered_message=None,
        created_at=now,
    )
    collector = RunEventCollector(run_id="run-branch", created_at=now)

    result = _simulate_negotiation(
        phase=PhaseName.SUPPLIER_MANUFACTURER,
        label="Supplier to Manufacturer",
        product_name="Orange Juice",
        scenario_context={
            "operator_instruction": "Manufacturer should accept the current offer.",
        },
        reference_market_price=2.5,
        openai_wrapper=FakeOpenAI(
            [
                {
                    "action": "accept_offer",
                    "price": None,
                    "note": "Accepted.",
                    "reason": "The offer is workable.",
                },
            ]
        ),
        langfuse_wrapper=FakeLangfuse(),
        run_id="run-branch",
        event_collector=collector,
        seller=supplier,
        buyer=manufacturer,
        min_sell_price=2.0,
        max_buy_price=3.0,
        quantity=1000,
        max_rounds=2,
        step_index_start=2,
        dependency_note="Branch continuation.",
        negotiation_id="neg-existing",
        existing_steps=[existing_step],
        resume_turn_index=1,
        initial_delivered_message={
            "type": "offer",
            "price": 2.4,
            "note": "Opening at 2.40.",
            "from_agent_id": "supplier",
        },
        initial_seller_last_offer=2.4,
    )

    assert [step.index for step in result.steps] == [1, 2]
    assert result.steps[0].message == "Opening at 2.40."
    assert result.steps[1].kind == "accept"
    assert result.record.id == "neg-existing"
    assert result.record.final_price == 2.4
