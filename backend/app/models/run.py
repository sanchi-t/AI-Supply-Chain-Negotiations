from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class RunStatus(StrEnum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class AgentRole(StrEnum):
    SUPPLIER = "supplier"
    MANUFACTURER = "manufacturer"
    RETAILER = "retailer"


class PhaseName(StrEnum):
    SUPPLIER_MANUFACTURER = "supplier_manufacturer"
    MANUFACTURER_RETAILER = "manufacturer_retailer"


class NegotiationStatus(StrEnum):
    OPEN = "open"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    TIMEOUT = "timeout"


class RunEventType(StrEnum):
    RUN_START = "run_start"
    RUN_END = "run_end"
    PHASE_START = "phase_start"
    PHASE_END = "phase_end"
    AGENT_TURN = "agent_turn"
    TOOL_CALL = "tool_call"
    MARKET_PRICE_CHECK = "market_price_check"
    MARKET_SHOCK = "market_shock"
    OPERATOR_INSTRUCTION = "operator_instruction"
    OFFER_MADE = "offer_made"
    OFFER_RECEIVED = "offer_received"
    ACCEPT = "accept"
    REJECT = "reject"
    TIMEOUT = "timeout"
    FINAL_OUTCOME = "final_outcome"


class ReservationPrices(BaseModel):
    min_sell_price: float | None = None
    max_buy_price: float | None = None


class Agent(BaseModel):
    id: str
    name: str
    role: AgentRole
    objective: str
    reservation_prices: ReservationPrices


class ProductMarketContext(BaseModel):
    product_name: str
    product_category: str
    market_region: str
    baseline_unit_price: float
    target_quantity: int
    currency: str = "USD"
    demand_signal: str
    supply_signal: str


class Phase(BaseModel):
    name: PhaseName
    label: str
    order: int
    description: str


class ToolCallEvent(BaseModel):
    id: str
    step_index: int
    agent_id: str
    tool_name: str
    arguments: dict[str, str | int | float | bool | None] = Field(default_factory=dict)
    result_summary: str
    created_at: datetime


class DeliveredMessage(BaseModel):
    type: str
    price: float | None = None
    note: str | None = None
    from_agent_id: str | None = None


class NegotiationStep(BaseModel):
    index: int
    phase: PhaseName
    negotiation_id: str
    round_number: int
    agent_id: str
    kind: str
    message: str
    outcome: str
    proposed_price: float | None = None
    delivered_message: DeliveredMessage | None = None
    created_at: datetime
    tool_calls: list[ToolCallEvent] = Field(default_factory=list)


class NegotiationRecord(BaseModel):
    id: str
    phase: PhaseName
    label: str
    seller_agent_id: str
    buyer_agent_id: str
    status: NegotiationStatus
    max_rounds: int
    quantity: int
    rounds_completed: int
    opening_seller_offer: float
    opening_buyer_offer: float
    final_price: float | None = None
    outcome_summary: str
    dependency_note: str | None = None


class DiagnosisSummary(BaseModel):
    outcome: str
    chain_effect: str
    key_risks: list[str] = Field(default_factory=list)
    key_signals: list[str] = Field(default_factory=list)
    suggested_next_actions: list[str] = Field(default_factory=list)


class RunEvent(BaseModel):
    run_id: str
    timestamp: datetime
    phase: PhaseName | None = None
    round: int | None = None
    agent: str | None = None
    event_type: RunEventType
    observed_market_price: float | None = None
    offer_price: float | None = None
    action: str | None = None
    status: str | None = None
    note: str | None = None
    reasoning_summary: str | None = None
    negotiation_id: str | None = None
    tool_name: str | None = None
    previous_market_price: float | None = None
    shock_type: str | None = None
    shock_multiplier: float | None = None
    shock_headline: str | None = None


class RunEventLog(BaseModel):
    run_id: str
    created_at: datetime
    updated_at: datetime
    events: list[RunEvent] = Field(default_factory=list)


class RunSummary(BaseModel):
    id: str
    title: str
    status: RunStatus
    created_at: datetime
    updated_at: datetime
    scenario: str
    agent_count: int
    step_count: int
    current_phase: PhaseName


class RunRecord(BaseModel):
    id: str
    title: str
    status: RunStatus
    scenario: str
    created_at: datetime
    updated_at: datetime
    product_context: ProductMarketContext
    agents: list[Agent]
    phases: list[Phase]
    steps: list[NegotiationStep]
    negotiations: list[NegotiationRecord]
    diagnosis: DiagnosisSummary
    max_rounds_per_negotiation: int
    notes: str
    tags: list[str] = Field(default_factory=list)

    def to_summary(self) -> RunSummary:
        current_phase = self.steps[-1].phase if self.steps else self.phases[0].name
        return RunSummary(
            id=self.id,
            title=self.title,
            status=self.status,
            created_at=self.created_at,
            updated_at=self.updated_at,
            scenario=self.scenario,
            agent_count=len(self.agents),
            step_count=len(self.steps),
            current_phase=current_phase,
        )


def utc_now() -> datetime:
    return datetime.now(UTC)
