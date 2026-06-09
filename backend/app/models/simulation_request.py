from pydantic import BaseModel, Field


class SimulationSeedRequest(BaseModel):
    seed: int = Field(..., ge=0)


class SimulationRunConfig(BaseModel):
    title: str = Field(..., min_length=1)
    product_name: str = Field(..., min_length=1)
    product_category: str = Field(..., min_length=1)
    market_region: str = Field(..., min_length=1)
    baseline_unit_price: float = Field(..., gt=0)
    target_quantity: int = Field(..., gt=0)
    currency: str = Field(..., min_length=1)
    demand_signal: str = Field(..., min_length=1)
    supply_signal: str = Field(..., min_length=1)
    max_rounds_per_negotiation: int = Field(..., ge=1, le=15)
    supplier_min_sell_price: float = Field(..., gt=0)
    manufacturer_max_buy_price: float = Field(..., gt=0)
    manufacturer_min_sell_price: float = Field(..., gt=0)
    retailer_max_buy_price: float = Field(..., gt=0)
    manufacturer_margin_floor: float = Field(..., ge=0)
    branch_source_run_id: str | None = None
    branch_pivot_step_index: int | None = Field(default=None, ge=1)
    branch_instruction: str | None = None
    branch_context: str | None = None
