from backend.app.models.counterfactual import (
    CounterfactualReplayResponse,
    CounterfactualTurningPoint,
)
from backend.app.models.run import NegotiationStep, RunRecord
from backend.app.models.simulation_request import SimulationRunConfig


def build_counterfactual_replay(run: RunRecord) -> CounterfactualReplayResponse:
    return CounterfactualReplayResponse(
        run_id=run.id,
        title=run.title,
        currency=run.product_context.currency,
        turning_points=_build_turning_points(run),
    )


def build_branch_run_config(
    run: RunRecord,
    *,
    pivot_step_index: int,
    instruction: str,
    label: str | None = None,
) -> SimulationRunConfig:
    pivot_step = next((step for step in run.steps if step.index == pivot_step_index), None)
    if pivot_step is None:
        raise ValueError(f"Step {pivot_step_index} was not found in run {run.id}.")

    config = _base_run_config(run)
    branch_label = (label or f"Step {pivot_step_index} Branch").strip()
    branch_context = _build_branch_context(
        run=run,
        pivot_step=pivot_step,
        instruction=instruction.strip(),
    )
    return config.model_copy(
        update={
            "title": f"{run.title} Branch - {branch_label}",
            "demand_signal": (
                f"{config.demand_signal} Operator instruction after step {pivot_step_index}: "
                f"{instruction.strip()}"
            ),
            "branch_source_run_id": run.id,
            "branch_pivot_step_index": pivot_step_index,
            "branch_instruction": instruction.strip(),
            "branch_context": branch_context,
        }
    )


def _build_turning_points(run: RunRecord) -> list[CounterfactualTurningPoint]:
    return [
        CounterfactualTurningPoint(
            step_index=step.index,
            phase=step.phase,
            round_number=step.round_number,
            agent_id=step.agent_id,
            kind=step.kind,
            price=step.proposed_price,
            note=step.message,
        )
        for step in sorted(run.steps, key=lambda item: item.index)
    ]


def _base_run_config(run: RunRecord) -> SimulationRunConfig:
    supplier = _agent(run, "supplier")
    manufacturer = _agent(run, "manufacturer")
    retailer = _agent(run, "retailer")
    if supplier is None or manufacturer is None or retailer is None:
        raise ValueError("Run must include supplier, manufacturer, and retailer agents.")

    supplier_min_sell_price = supplier.reservation_prices.min_sell_price
    manufacturer_max_buy_price = manufacturer.reservation_prices.max_buy_price
    manufacturer_min_sell_price = manufacturer.reservation_prices.min_sell_price
    retailer_max_buy_price = retailer.reservation_prices.max_buy_price
    if (
        supplier_min_sell_price is None
        or manufacturer_max_buy_price is None
        or manufacturer_min_sell_price is None
        or retailer_max_buy_price is None
    ):
        raise ValueError("Run is missing reservation prices needed for a new version.")

    manufacturer_margin_floor = max(
        round(manufacturer_min_sell_price - manufacturer_max_buy_price, 2),
        0,
    )
    return SimulationRunConfig(
        title=run.title,
        product_name=run.product_context.product_name,
        product_category=run.product_context.product_category,
        market_region=run.product_context.market_region,
        baseline_unit_price=run.product_context.baseline_unit_price,
        target_quantity=run.product_context.target_quantity,
        currency=run.product_context.currency,
        demand_signal=run.product_context.demand_signal,
        supply_signal=run.product_context.supply_signal,
        max_rounds_per_negotiation=run.max_rounds_per_negotiation,
        supplier_min_sell_price=supplier_min_sell_price,
        manufacturer_max_buy_price=manufacturer_max_buy_price,
        manufacturer_min_sell_price=manufacturer_min_sell_price,
        retailer_max_buy_price=retailer_max_buy_price,
        manufacturer_margin_floor=manufacturer_margin_floor,
    )


def _build_branch_context(
    *,
    run: RunRecord,
    pivot_step: NegotiationStep,
    instruction: str,
) -> str:
    prior_steps = [
        step
        for step in sorted(run.steps, key=lambda item: item.index)
        if step.index <= pivot_step.index
    ][-8:]
    transcript = "\n".join(
        (
            f"Step {step.index} | {step.phase.value} | round {step.round_number} | "
            f"{step.agent_id} {step.kind}"
            f"{f' at {step.proposed_price:.2f}' if step.proposed_price is not None else ''}: "
            f"{step.message}"
        )
        for step in prior_steps
    )
    return (
        f"Source run: {run.id}\n"
        f"Branch pivot step: {pivot_step.index}\n"
        f"Pivot phase: {pivot_step.phase.value}\n"
        f"Pivot round: {pivot_step.round_number}\n"
        f"Pivot agent: {pivot_step.agent_id}\n"
        f"Pivot action: {pivot_step.kind}\n"
        f"Pivot price: {pivot_step.proposed_price if pivot_step.proposed_price is not None else 'n/a'}\n"
        f"Operator instruction for future decisions only: {instruction}\n"
        f"Recent original transcript before branch:\n{transcript}"
    )


def _agent(run: RunRecord, agent_id: str):
    return next((item for item in run.agents if item.id == agent_id), None)
