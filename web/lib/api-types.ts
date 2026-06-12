export type RunStatus = "running" | "completed" | "failed";

export type AgentRole = "supplier" | "manufacturer" | "retailer";

export type PhaseName =
  | "supplier_manufacturer"
  | "manufacturer_retailer";

export type HealthResponse = {
  status: string;
};

export type SimulationSeedRequest = {
  seed: number;
};

export type SimulationRunConfig = {
  title: string;
  product_name: string;
  product_category: string;
  market_region: string;
  baseline_unit_price: number;
  target_quantity: number;
  currency: string;
  demand_signal: string;
  supply_signal: string;
  max_rounds_per_negotiation: number;
  supplier_min_sell_price: number;
  manufacturer_max_buy_price: number;
  manufacturer_min_sell_price: number;
  retailer_max_buy_price: number;
  manufacturer_margin_floor: number;
};

export type SimulationBatchResult = {
  seed: number;
  count: number;
  runs: RunRecord[];
};

export type SimulationBatchLaunchResult = {
  seed: number;
  count: number;
  runs: RunRecord[];
};

export type Agent = {
  id: string;
  name: string;
  role: AgentRole;
  objective: string;
  reservation_prices: {
    min_sell_price: number | null;
    max_buy_price: number | null;
  };
};

export type Phase = {
  name: PhaseName;
  label: string;
  order: number;
  description: string;
};

export type NegotiationStatus = "open" | "accepted" | "rejected" | "timeout";

export type ToolCallEvent = {
  id: string;
  step_index: number;
  agent_id: string;
  tool_name: string;
  arguments: Record<string, string | number | boolean | null>;
  result_summary: string;
  created_at: string;
};

export type RunEventType =
  | "run_start"
  | "run_end"
  | "phase_start"
  | "phase_end"
  | "agent_turn"
  | "tool_call"
  | "market_price_check"
  | "market_shock"
  | "operator_instruction"
  | "offer_made"
  | "offer_received"
  | "accept"
  | "reject"
  | "timeout"
  | "final_outcome";

export type RunEvent = {
  run_id: string;
  timestamp: string;
  phase: PhaseName | null;
  round: number | null;
  agent: string | null;
  event_type: RunEventType;
  observed_market_price: number | null;
  offer_price: number | null;
  action: string | null;
  status: string | null;
  note: string | null;
  reasoning_summary: string | null;
  negotiation_id: string | null;
  tool_name: string | null;
  previous_market_price: number | null;
  shock_type: ShockType | null;
  shock_multiplier: number | null;
  shock_headline: string | null;
};

export type RunEventLog = {
  run_id: string;
  created_at: string;
  updated_at: string;
  events: RunEvent[];
};

export type NegotiationStep = {
  index: number;
  phase: PhaseName;
  negotiation_id: string;
  round_number: number;
  agent_id: string;
  kind: string;
  message: string;
  outcome: string;
  proposed_price: number | null;
  delivered_message: DeliveredMessage | null;
  created_at: string;
  tool_calls: ToolCallEvent[];
};

export type DeliveredMessage = {
  type: string;
  price: number | null;
  note: string | null;
  from_agent_id: string | null;
};

export type ShockType =
  | "price_spike"
  | "supply_shortage"
  | "demand_surge"
  | "geopolitical"
  | "price_drop";

export type DiagnosisSummary = {
  outcome: string;
  chain_effect: string;
  key_risks: string[];
  key_signals: string[];
  suggested_next_actions: string[];
};

export type ProductMarketContext = {
  product_name: string;
  product_category: string;
  market_region: string;
  baseline_unit_price: number;
  target_quantity: number;
  currency: string;
  demand_signal: string;
  supply_signal: string;
};

export type NegotiationRecord = {
  id: string;
  phase: PhaseName;
  label: string;
  seller_agent_id: string;
  buyer_agent_id: string;
  status: NegotiationStatus;
  max_rounds: number;
  quantity: number;
  rounds_completed: number;
  opening_seller_offer: number;
  opening_buyer_offer: number;
  final_price: number | null;
  outcome_summary: string;
  dependency_note: string | null;
};

export type RunSummary = {
  id: string;
  title: string;
  status: RunStatus;
  created_at: string;
  updated_at: string;
  scenario: string;
  agent_count: number;
  step_count: number;
  current_phase: PhaseName;
};

export type RunRecord = {
  id: string;
  title: string;
  status: RunStatus;
  scenario: string;
  created_at: string;
  updated_at: string;
  product_context: ProductMarketContext;
  agents: Agent[];
  phases: Phase[];
  steps: NegotiationStep[];
  negotiations: NegotiationRecord[];
  diagnosis: DiagnosisSummary;
  max_rounds_per_negotiation: number;
  notes: string;
  tags: string[];
};

export type RunDetailExportArtifacts = {
  summary_path: string | null;
  event_log_path: string | null;
  trace_path: string | null;
  conversation_path: string | null;
};

export type ConversationMessage = {
  index: number;
  timestamp: string;
  phase: PhaseName;
  round: number;
  speaker_id: string;
  speaker_name: string;
  speaker_role: AgentRole | null;
  kind: string;
  message: string;
  outcome: string;
  offer_price: number | null;
  delivered_message: DeliveredMessage | null;
  currency: string;
};

export type RunDetailResponse = {
  run: RunRecord;
  event_log: RunEventLog | null;
  trace_metadata: Record<string, unknown> | null;
  export_artifacts: RunDetailExportArtifacts | null;
  derived: Record<string, unknown> | null;
  conversation: ConversationMessage[] | null;
};

export type RunShockRequest = {
  shock_type: ShockType;
};

export type RunShockResponse = {
  run_id: string;
  shock_type: ShockType;
  multiplier: number;
  headline: string;
  consumed: boolean;
  queued_at: string;
};

export type RunEventStreamPayload = {
  type: "run_event";
  run_id: string;
  event: RunEvent;
};

export type CounterfactualTurningPoint = {
  step_index: number;
  phase: PhaseName;
  round_number: number;
  agent_id: string;
  kind: string;
  price: number | null;
  note: string;
};

export type CounterfactualReplayResponse = {
  run_id: string;
  title: string;
  currency: string;
  turning_points: CounterfactualTurningPoint[];
};

export type CounterfactualBranchRunRequest = {
  pivot_step_index: number;
  instruction: string;
  label: string | null;
};

export type CounterfactualBranchRunResponse = {
  source_run_id: string;
  pivot_step_index: number;
  run_id: string;
  status: string;
  message: string;
};
