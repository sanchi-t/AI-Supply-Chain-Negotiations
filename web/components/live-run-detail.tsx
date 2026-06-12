"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  ConversationMessage,
  NegotiationRecord,
  PhaseName,
  RunDetailResponse,
  RunEvent,
  RunRecord,
  RunEventStreamPayload,
  RunShockResponse,
  ShockType,
} from "../lib/api-types";
import { formatDateTime, formatLabel } from "../lib/format";


type LiveRunDetailProps = {
  initialDetail: RunDetailResponse;
};

type OfferTurnPoint = {
  turn: number;
  price: number;
  agentId: string;
};

type ReferenceLine = {
  label: string;
  value: number;
  tone: "market" | "seller" | "buyer" | "cost";
};

type ClosingMarker = {
  label: string;
  turn: number;
  price: number;
  status: string;
};

type NegotiationChartData = {
  title: string;
  sellerLabel: string;
  buyerLabel: string;
  sellerPoints: OfferTurnPoint[];
  buyerPoints: OfferTurnPoint[];
  references: ReferenceLine[];
  closingMarker: ClosingMarker | null;
};

type BeliefGapSample = {
  timestamp: string;
  phase: PhaseName | null;
  round: number | null;
  agent: string | null;
  observed_market_price: number;
  true_market_price: number;
  belief_gap: number;
};

type FeedItem =
  | {
      key: string;
      type: "message";
      timestamp: string;
      phase: PhaseName;
      speakerId: string;
      speakerName: string;
      speakerLabel: string;
      round: number;
      kind: string;
      priceLabel: string;
      body: string;
      isNew: boolean;
      sortRank: number;
      sortIndex: number;
    }
  | {
      key: string;
      type: "activity";
      timestamp: string;
      phase: PhaseName;
      speakerId: string;
      speakerName: string;
      speakerLabel: string;
      round: number;
      kind: string;
      priceLabel: string;
      body: string;
      sortRank: number;
      sortIndex: number;
    };

const CHAT_PHASES: PhaseName[] = [
  "supplier_manufacturer",
  "manufacturer_retailer",
];

export function LiveRunDetail({ initialDetail }: LiveRunDetailProps) {
  const [detail, setDetail] = useState(initialDetail);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [highlightedMessageIndex, setHighlightedMessageIndex] = useState<number | null>(null);
  const [selectedShockType, setSelectedShockType] = useState<ShockType>("price_spike");
  const [shockRequestState, setShockRequestState] = useState<"idle" | "sending" | "queued" | "error">("idle");
  const [shockFeedback, setShockFeedback] = useState<string | null>(null);
  const [streamedEvents, setStreamedEvents] = useState<RunEvent[]>([]);
  const previousMessageCount = useRef(initialDetail.conversation?.length ?? 0);

  useEffect(() => {
    setDetail(initialDetail);
    setRefreshError(null);
    setIsRefreshing(false);
    setHighlightedMessageIndex(null);
    setStreamedEvents([]);
    setShockRequestState("idle");
    setShockFeedback(null);
    previousMessageCount.current = initialDetail.conversation?.length ?? 0;
  }, [initialDetail]);

  useEffect(() => {
    if (detail.run.status !== "running") {
      return undefined;
    }

    const eventSource = new EventSource(`/api/runs/${detail.run.id}/events`);
    const handleRunEvent = (rawEvent: MessageEvent<string>) => {
      const payload = JSON.parse(rawEvent.data) as RunEventStreamPayload;
      setStreamedEvents((currentEvents) => {
        if (
          currentEvents.some((event) => getRunEventKey(event) === getRunEventKey(payload.event))
        ) {
          return currentEvents;
        }

        return [...currentEvents, payload.event];
      });
    };

    eventSource.addEventListener("run-event", handleRunEvent as EventListener);
    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.removeEventListener("run-event", handleRunEvent as EventListener);
      eventSource.close();
    };
  }, [detail.run.id, detail.run.status]);

  useEffect(() => {
    if (detail.run.status !== "running") {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      try {
        setIsRefreshing(true);
        const response = await fetch(`/api/runs/${detail.run.id}/detail`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          data: RunDetailResponse | null;
          error: string | null;
        };

        if (!response.ok || !payload.data) {
          setRefreshError(payload.error ?? "Unable to refresh live run detail.");
          setIsRefreshing(false);
          return;
        }

        const nextConversationCount = payload.data.conversation?.length ?? 0;
        if (nextConversationCount > previousMessageCount.current) {
          const latestMessage = payload.data.conversation?.[nextConversationCount - 1];
          setHighlightedMessageIndex(latestMessage?.index ?? null);
          window.setTimeout(() => setHighlightedMessageIndex(null), 2200);
        }
        previousMessageCount.current = nextConversationCount;
        setDetail(payload.data);
        setRefreshError(null);
      } catch {
        setRefreshError("Unable to refresh live run detail.");
      } finally {
        setIsRefreshing(false);
      }
    }, 1800);

    return () => window.clearInterval(intervalId);
  }, [detail.run.id, detail.run.status]);

  const run = detail.run;
  const conversation = detail.conversation ?? [];
  const eventLog = detail.event_log?.events ?? [];
  const allEvents = dedupeRunEvents([...eventLog, ...streamedEvents]);
  const beliefSamples =
    normalizeBeliefSamples(detail.derived?.belief_gap_samples).length > 0
      ? normalizeBeliefSamples(detail.derived?.belief_gap_samples)
      : buildBeliefSamplesFromEvents(allEvents, run.product_context.baseline_unit_price);
  const averageBeliefGap =
    typeof detail.derived?.average_belief_gap === "number"
      ? detail.derived.average_belief_gap
      : beliefSamples.length > 0
        ? roundMoney(
            beliefSamples.reduce((sum, sample) => sum + sample.belief_gap, 0) /
              beliefSamples.length,
          )
        : null;
  const manufacturerMargin =
    typeof detail.derived?.manufacturer_margin_after_first_deal === "number"
      ? detail.derived.manufacturer_margin_after_first_deal
      : deriveMarginFromNegotiations(run.negotiations);
  const suspectedFailureType =
    typeof detail.derived?.suspected_failure_type === "string"
      ? detail.derived.suspected_failure_type
      : null;
  const whereRunFailed = detail.derived?.where_run_failed as
    | { phase?: string; round?: number; agent?: string; note?: string }
    | undefined;

  const negotiationByPhase = new Map(
    run.negotiations.map((negotiation) => [negotiation.phase, negotiation]),
  );
  const chatColumns = CHAT_PHASES.map((phase) => {
    const negotiation = negotiationByPhase.get(phase);
    const phaseMessages = conversation.filter((message) => message.phase === phase);
    return {
      phase,
      negotiation,
      label: negotiation?.label ?? formatLabel(phase),
      messages: phaseMessages,
      feedItems: buildPhoneFeedItems({
        phase,
        messages: phaseMessages,
        events: allEvents,
        currency: run.product_context.currency,
        highlightedMessageIndex,
      }),
    };
  });

  const supplierManufacturerChart = buildNegotiationChartData(run, "supplier_manufacturer");
  const manufacturerRetailerChart = buildNegotiationChartData(run, "manufacturer_retailer");
  const beliefComparison = buildBeliefComparison(beliefSamples);
  const totalMarginValue =
    typeof manufacturerMargin === "number"
      ? roundMoney(manufacturerMargin * run.product_context.target_quantity)
      : null;
  const transcriptMessages = [...conversation].sort((left, right) => left.index - right.index);
  const orderedEvents = [...allEvents].reverse();
  const liveStatusLabel = isRefreshing ? "Syncing" : "Live";
  const isRunLive = run.status === "running";
  const runStatusBadgeClassName =
    run.status === "completed"
      ? "badge leaf"
      : run.status === "failed"
        ? "badge danger"
        : "badge pulse";

  async function handleShockInject() {
    setShockRequestState("sending");
    setShockFeedback(null);

    try {
      const response = await fetch(`/api/runs/${run.id}/shock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shock_type: selectedShockType }),
      });
      const payload = (await response.json()) as {
        data: RunShockResponse | null;
        error: string | null;
      };

      if (!response.ok || !payload.data) {
        setShockRequestState("error");
        setShockFeedback(payload.error ?? "Unable to queue the market shock.");
        return;
      }

      setShockRequestState("queued");
      setShockFeedback(`Queued: ${payload.data.headline}`);
    } catch {
      setShockRequestState("error");
      setShockFeedback("Unable to queue the market shock.");
    }
  }

  function handleDownloadLog() {
    const payload = buildRunLogText({
      run,
      messages: transcriptMessages,
      events: orderedEvents,
      suspectedFailureType,
      whereRunFailed,
    });
    const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${run.id}-log.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <main className="detail-layout live-detail">
      <section className="detail-shell">
        <aside className="detail-sidebar-stack">
          <article className="shock-control-card">
            <div className="eyebrow">Operator Shock</div>
            <h2>Inject Market Event</h2>
            <p>
              Queue a disruption for the next market-price check. The agents will be warned
              before the next live decision turn.
            </p>
            <label className="field">
              <span>Shock Type</span>
              <select
                className="run-selector"
                disabled={!isRunLive || shockRequestState === "sending"}
                onChange={(event) => {
                  setSelectedShockType(event.target.value as ShockType);
                  setShockRequestState("idle");
                  setShockFeedback(null);
                }}
                value={selectedShockType}
              >
                <option value="price_spike">Price Spike</option>
                <option value="supply_shortage">Supply Shortage</option>
                <option value="demand_surge">Demand Surge</option>
                <option value="geopolitical">Geopolitical Event</option>
                <option value="price_drop">Price Drop</option>
              </select>
            </label>
            <button
              className="button primary"
              disabled={!isRunLive || shockRequestState === "sending"}
              onClick={handleShockInject}
              type="button"
            >
              {shockRequestState === "sending" ? "Sending..." : "Inject Event"}
            </button>
            {shockRequestState === "queued" ? (
              <p className="inline-success">✓ Queued</p>
            ) : null}
            {shockRequestState === "error" && shockFeedback ? (
              <p className="inline-error">{shockFeedback}</p>
            ) : null}
            {shockRequestState === "queued" && shockFeedback ? (
              <p className="muted-copy">{shockFeedback}</p>
            ) : null}
            {!isRunLive ? (
              <p className="muted-copy">Shock injection unlocks only while this run is live.</p>
            ) : null}
          </article>

          <article className="detail-summary-panel">
            <div className="eyebrow">Run Detail</div>
            <h1>{run.title}</h1>
            <p>{run.scenario}</p>

            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">Status</span>
                <span className={runStatusBadgeClassName}>
                  {formatLabel(run.status)}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Created</span>
                <span>{formatDateTime(run.created_at)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Product</span>
                <span>{run.product_context.product_name}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Market</span>
                <span>{run.product_context.market_region}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Quantity</span>
                <span>{run.product_context.target_quantity}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Baseline Price</span>
                <span>{formatCurrency(run.product_context.baseline_unit_price, run.product_context.currency)}</span>
              </div>
            </div>

            <div className="hero-actions">
              <Link className="button secondary" href={`/runs/${run.id}/replay`}>
                Start From A Step
              </Link>
              {run.status === "running" ? (
                <span className="badge leaf">{liveStatusLabel}</span>
              ) : null}
            </div>
            {refreshError ? <p className="inline-error">{refreshError}</p> : null}
          </article>
        </aside>

        <div className="detail-main-stack">
          <div className="detail-main-center">
          <section className="detail-top-grid">
            <section className="panel chat-panel">
          <div className="section-heading">
            <div>
              <div className="eyebrow">1. Chats Between The Agents</div>
              <h2>Negotiations in parallel phone views</h2>
            </div>
            {run.status === "running" ? (
              <span className="text-link">Updates every 1.8s</span>
            ) : null}
          </div>
          <div className="phone-grid">
            {chatColumns.map((column) => (
              <article className="phone-card" key={column.phase}>
                <div className="phone-topbar">
                  <div>
                    <div className="eyebrow">{column.label}</div>
                    <strong>Messages</strong>
                  </div>
                  <span className={`badge ${column.negotiation?.status === "accepted" ? "leaf" : ""}`}>
                    {column.negotiation
                      ? formatLabel(column.negotiation.status)
                      : run.status === "running"
                        ? "Live"
                        : "Not Run"}
                  </span>
                </div>
                <div className="phone-frame">
                  <div className="phone-header">
                    <span>9:41</span>
                    <span>{column.label}</span>
                    <span>{column.messages.length} messages</span>
                  </div>
                  <div className="phone-thread">
                    {column.feedItems.length > 0 ? (
                      column.feedItems.map((item) => {
                        const isOutgoing = isOutgoingMessage(column.phase, item.speakerId);
                        const bubbleTone =
                          item.speakerId === "market_desk" || item.kind === "system_notice"
                            ? "system-notice"
                            : item.type === "activity" && item.kind === "market_shock"
                            ? "shock-bar"
                            : item.type === "activity" && item.kind === "operator_instruction"
                            ? "shock-bar"
                            : item.type === "activity"
                            ? `activity ${isOutgoing ? "outgoing" : "incoming"}`
                            : isOutgoing
                              ? "outgoing"
                              : "incoming";

                        return (
                          <article
                            className={`iphone-bubble ${bubbleTone} ${
                              item.type === "message" && item.isNew ? "is-new" : ""
                            }`}
                            key={item.key}
                          >
                            <span className="bubble-speaker">{item.speakerLabel}</span>
                            <p>{item.body}</p>
                            <div className="bubble-meta">
                              <span>Round {item.round}</span>
                              <span>{formatLabel(item.kind)}</span>
                              <span>{item.priceLabel}</span>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <div className="phase-empty">
                        {run.status === "running"
                          ? "Waiting for the first live message."
                          : "No transcript is available for this negotiation."}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
            </section>

            <div className="chart-stack">
              <section className="panel compact-panel">
            <div className="section-heading">
              <div>
                <div className="eyebrow">2. Supplier Vs Manufacturer Price Chart</div>
                <h2>Upstream price movement</h2>
              </div>
            </div>
            <PriceChart
              currency={run.product_context.currency}
              data={supplierManufacturerChart}
              compact
            />
              </section>

              <section className="panel compact-panel">
            <div className="section-heading">
              <div>
                <div className="eyebrow">3. Manufacturer Vs Retailer Price Chart</div>
                <h2>Downstream price movement</h2>
              </div>
            </div>
            <PriceChart
              currency={run.product_context.currency}
              data={manufacturerRetailerChart}
              compact
            />
              </section>
            </div>
          </section>

          <section className="panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">4. Belief Comparison Panel</div>
            <h2>Observed market vs true market</h2>
          </div>
        </div>
        <div className="belief-grid">
          <div className="card">
            <div className="eyebrow">Market Anchor</div>
            <h3>{formatCurrency(run.product_context.baseline_unit_price, run.product_context.currency)}</h3>
            <p>True baseline unit price for the run.</p>
            <div className="run-meta">
              <span>
                Average gap:{" "}
                {typeof averageBeliefGap === "number"
                  ? formatSignedCurrency(averageBeliefGap, run.product_context.currency)
                  : "n/a"}
              </span>
              <span>{beliefSamples.length} samples</span>
            </div>
          </div>
          {beliefComparison.length > 0 ? (
            beliefComparison.map((item) => (
              <div className="card" key={item.agent}>
                <div className="eyebrow">{formatLabel(item.agent)}</div>
                <h3>{formatCurrency(item.observed, run.product_context.currency)}</h3>
                <p>{item.summary}</p>
                <div className="run-meta">
                  <span>
                    Gap: {formatSignedCurrency(item.gap, run.product_context.currency)}
                  </span>
                  <span>{item.phaseLabel}</span>
                  <span>{item.roundLabel}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="card">
              <div className="eyebrow">Beliefs</div>
              <h3>No samples recorded</h3>
              <p>No market-check events have been persisted yet.</p>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">5. Cascade / Margin Card</div>
            <h2>How the upstream deal propagated</h2>
          </div>
        </div>
        <div className="detail-columns two-up">
          <div className="card">
            <div className="eyebrow">Price Cascade</div>
            <h3>{run.diagnosis.chain_effect}</h3>
            <div className="detail-grid cascade-grid">
              <div className="detail-item">
                <span className="summary-label">Supplier → Manufacturer</span>
                <span>
                  {formatNegotiationPrice(
                    negotiationByPhase.get("supplier_manufacturer"),
                    run.product_context.currency,
                  )}
                </span>
              </div>
              <div className="detail-item">
                <span className="summary-label">Manufacturer → Retailer</span>
                <span>
                  {formatNegotiationPrice(
                    negotiationByPhase.get("manufacturer_retailer"),
                    run.product_context.currency,
                  )}
                </span>
              </div>
              <div className="detail-item">
                <span className="summary-label">Quantity</span>
                <span>{run.product_context.target_quantity}</span>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="eyebrow">Margin Snapshot</div>
            <h3>
              {typeof manufacturerMargin === "number"
                ? formatCurrency(manufacturerMargin, run.product_context.currency)
                : "n/a"}
            </h3>
            <p>
              Manufacturer margin after the upstream deal and before downstream
              quantity expansion.
            </p>
            <div className="run-meta">
              <span>
                Total spread:{" "}
                {totalMarginValue !== null
                  ? formatCurrency(totalMarginValue, run.product_context.currency)
                  : "n/a"}
              </span>
              <span>
                Outcome: {formatLabel(negotiationByPhase.get("manufacturer_retailer")?.status ?? "open")}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">6. Diagnosis Card</div>
            <h2>Run interpretation</h2>
          </div>
        </div>
        <div className="detail-columns two-up">
          <div className="card">
            <div className="eyebrow">Outcome</div>
            <h3>{run.diagnosis.outcome}</h3>
            <p>{whereRunFailed?.note ?? "No explicit failure point was inferred for this run."}</p>
            <div className="run-meta">
              <span>
                Failure type:{" "}
                {suspectedFailureType ? formatLabel(suspectedFailureType) : "None"}
              </span>
              <span>
                Phase: {whereRunFailed?.phase ? formatLabel(whereRunFailed.phase) : "n/a"}
              </span>
              <span>Round: {whereRunFailed?.round ?? "n/a"}</span>
            </div>
          </div>
          <div className="card">
            <div className="eyebrow">Signals</div>
            <h3>Risks and next actions</h3>
            <div className="diagnosis-columns">
              <div>
                <strong>Key risks</strong>
                <ul className="plain-list">
                  {run.diagnosis.key_risks.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>Key signals</strong>
                <ul className="plain-list">
                  {run.diagnosis.key_signals.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>Next actions</strong>
                <ul className="plain-list">
                  {run.diagnosis.suggested_next_actions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">7. Download Log</div>
            <h2>Export full execution record</h2>
          </div>
        </div>
        <div className="detail-columns two-up">
          <div className="card">
            <div className="eyebrow">TXT Export</div>
            <h3>Transcript, event log, diagnosis</h3>
            <p>
              Download a plain-text run log with the full transcript, structured event
              timeline, diagnosis, and pricing context.
            </p>
            <div className="run-meta">
              <span>{transcriptMessages.length} transcript messages</span>
              <span>{orderedEvents.length} events</span>
              <span>{run.id}</span>
            </div>
            <div className="hero-actions">
              <button className="button primary" onClick={handleDownloadLog} type="button">
                Download Log
              </button>
            </div>
          </div>
        </div>
      </section>
          </div>
        </div>
      </section>
    </main>
  );
}

function buildNegotiationChartData(
  run: RunRecord,
  phase: PhaseName,
): NegotiationChartData {
  const negotiation = run.negotiations.find((item) => item.phase === phase);
  const phaseSteps = run.steps
    .filter((step) => step.phase === phase)
    .sort((left, right) => left.index - right.index);
  const offerSteps = phaseSteps.filter(
    (step) => step.kind === "offer" && step.proposed_price !== null,
  );
  const sellerAgentId = negotiation?.seller_agent_id ?? (phase === "supplier_manufacturer" ? "supplier" : "manufacturer");
  const buyerAgentId = negotiation?.buyer_agent_id ?? (phase === "supplier_manufacturer" ? "manufacturer" : "retailer");

  const indexedOffers = offerSteps.map((step, index) => ({
    turn: index + 1,
    price: step.proposed_price ?? 0,
    agentId: step.agent_id,
  }));

  const sellerPoints = indexedOffers.filter((point) => point.agentId === sellerAgentId);
  const buyerPoints = indexedOffers.filter((point) => point.agentId === buyerAgentId);
  const supplier = run.agents.find((agent) => agent.id === "supplier");
  const manufacturer = run.agents.find((agent) => agent.id === "manufacturer");
  const retailer = run.agents.find((agent) => agent.id === "retailer");
  const upstreamNegotiation = run.negotiations.find(
    (item) => item.phase === "supplier_manufacturer",
  );

  const references: ReferenceLine[] = [
    {
      label: "True market price",
      value: run.product_context.baseline_unit_price,
      tone: "market",
    },
  ];

  if (phase === "supplier_manufacturer") {
    if (supplier?.reservation_prices.min_sell_price !== null && supplier?.reservation_prices.min_sell_price !== undefined) {
      references.push({
        label: "Supplier reservation price",
        value: supplier.reservation_prices.min_sell_price,
        tone: "seller",
      });
    }
    if (manufacturer?.reservation_prices.max_buy_price !== null && manufacturer?.reservation_prices.max_buy_price !== undefined) {
      references.push({
        label: "Manufacturer reservation price",
        value: manufacturer.reservation_prices.max_buy_price,
        tone: "buyer",
      });
    }
  } else {
    if (manufacturer?.reservation_prices.min_sell_price !== null && manufacturer?.reservation_prices.min_sell_price !== undefined) {
      references.push({
        label: "Manufacturer reservation price",
        value: manufacturer.reservation_prices.min_sell_price,
        tone: "seller",
      });
    }
    if (retailer?.reservation_prices.max_buy_price !== null && retailer?.reservation_prices.max_buy_price !== undefined) {
      references.push({
        label: "Retailer reservation price",
        value: retailer.reservation_prices.max_buy_price,
        tone: "buyer",
      });
    }
    if (upstreamNegotiation?.final_price !== null && upstreamNegotiation?.final_price !== undefined) {
      references.push({
        label: "Manufacturer upstream cost",
        value: upstreamNegotiation.final_price,
        tone: "cost",
      });
    }
  }

  const lastOffer = indexedOffers[indexedOffers.length - 1] ?? null;
  let closingMarker: ClosingMarker | null = null;
  if (negotiation?.status === "accepted" && negotiation.final_price !== null) {
    closingMarker = {
      label: "Accepted price",
      turn: lastOffer?.turn ?? 1,
      price: negotiation.final_price,
      status: negotiation.status,
    };
  } else if (lastOffer) {
    closingMarker = {
      label: "Last offer",
      turn: lastOffer.turn,
      price: lastOffer.price,
      status: negotiation?.status ?? "open",
    };
  }

  return {
    title:
      phase === "supplier_manufacturer"
        ? "supplier vs manufacturer"
        : "manufacturer vs retailer",
    sellerLabel: formatLabel(sellerAgentId),
    buyerLabel: formatLabel(buyerAgentId),
    sellerPoints,
    buyerPoints,
    references,
    closingMarker,
  };
}

function normalizeBeliefSamples(value: unknown): BeliefGapSample[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const sample = item as {
      timestamp?: unknown;
      phase?: unknown;
      round?: unknown;
      agent?: unknown;
      observed_market_price?: unknown;
      true_market_price?: unknown;
      belief_gap?: unknown;
    };

    if (
      !item ||
      typeof item !== "object" ||
      typeof sample.observed_market_price !== "number" ||
      typeof sample.true_market_price !== "number" ||
      typeof sample.belief_gap !== "number"
    ) {
      return [];
    }

    return [
      {
        timestamp: typeof sample.timestamp === "string" ? sample.timestamp : "",
        phase:
          sample.phase === "supplier_manufacturer" || sample.phase === "manufacturer_retailer"
            ? sample.phase
            : null,
        round: typeof sample.round === "number" ? sample.round : null,
        agent: typeof sample.agent === "string" ? sample.agent : null,
        observed_market_price: sample.observed_market_price,
        true_market_price: sample.true_market_price,
        belief_gap: sample.belief_gap,
      },
    ];
  });
}

function buildBeliefSamplesFromEvents(events: RunEvent[], trueMarketPrice: number): BeliefGapSample[] {
  return events
    .filter(
      (event) =>
        event.event_type === "market_price_check" &&
        event.observed_market_price !== null,
    )
    .map((event, index) => ({
      timestamp: event.timestamp,
      phase: event.phase,
      round: event.round,
      agent: event.agent,
      observed_market_price: event.observed_market_price ?? trueMarketPrice,
      true_market_price: trueMarketPrice,
      belief_gap: roundMoney((event.observed_market_price ?? trueMarketPrice) - trueMarketPrice),
    }));
}

function getRunEventKey(event: RunEvent): string {
  return [
    event.timestamp,
    event.event_type,
    event.agent ?? "system",
    event.phase ?? "run",
    event.round ?? "na",
    event.shock_headline ?? "none",
    event.offer_price ?? "na",
    event.observed_market_price ?? "na",
  ].join(":");
}

function dedupeRunEvents(events: RunEvent[]): RunEvent[] {
  const unique = new Map<string, RunEvent>();

  for (const event of events) {
    unique.set(getRunEventKey(event), event);
  }

  return Array.from(unique.values()).sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );
}

function buildPhoneFeedItems({
  phase,
  messages,
  events,
  currency,
  highlightedMessageIndex,
}: {
  phase: PhaseName;
  messages: ConversationMessage[];
  events: RunEvent[];
  currency: string;
  highlightedMessageIndex: number | null;
}): FeedItem[] {
  const messageItems: FeedItem[] = messages
    .filter((message) => message.speaker_id !== "market_desk" && message.kind !== "system_notice")
    .map((message) => ({
      key: `message:${message.index}`,
      type: "message",
      timestamp: message.timestamp,
      phase: message.phase,
      speakerId: message.speaker_id,
      speakerName: message.speaker_name,
      speakerLabel: message.speaker_name,
      round: message.round,
      kind: message.kind,
      priceLabel:
        message.offer_price !== null
          ? formatCurrency(message.offer_price, message.currency)
          : "No price",
      body: message.message,
      isNew: highlightedMessageIndex === message.index,
      sortRank: 40,
      sortIndex: message.index,
    }));

  const activityItems: FeedItem[] = events
    .filter((event) => event.phase === phase)
    .filter(
      (event) =>
        event.event_type === "market_shock" ||
        event.event_type === "operator_instruction" ||
        (event.event_type === "agent_turn" && Boolean(event.reasoning_summary)) ||
        (event.event_type === "tool_call" &&
          (event.action === "review_state" || event.action === "check_market_price")),
    )
    .map((event, index) => ({
      key: `activity:${getRunEventKey(event)}`,
      type: "activity",
      timestamp: event.timestamp,
      phase,
      speakerId: event.agent ?? "system",
      speakerName: getEventSpeakerName(event),
      speakerLabel:
        event.event_type === "market_shock"
          ? "Market Shock"
          : event.event_type === "operator_instruction"
          ? "Operator Instruction"
          : event.event_type === "agent_turn" && event.reasoning_summary
          ? `${getEventSpeakerName(event)} (Thinking)`
          : getEventSpeakerName(event),
      round: event.round ?? 0,
      kind:
        event.event_type === "market_shock"
          ? "market_shock"
          : event.event_type === "operator_instruction"
          ? "operator_instruction"
          : event.event_type === "agent_turn"
          ? "thinking"
          : event.action === "check_market_price"
            ? "market_check"
            : "review_state",
      priceLabel:
        event.event_type === "market_shock"
          ? "Injected event"
          : event.event_type === "operator_instruction"
          ? "New direction"
          : event.offer_price !== null
          ? formatCurrency(event.offer_price, currency)
          : event.observed_market_price !== null
            ? formatCurrency(event.observed_market_price, currency)
            : "In progress",
      body: describeActivityEvent(event, currency),
      sortRank: getActivitySortRank(event),
      sortIndex: index,
    }));

  return [...messageItems, ...activityItems].sort(compareFeedItems);
}

function compareFeedItems(left: FeedItem, right: FeedItem): number {
  const timestampDelta = new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
  if (timestampDelta !== 0) {
    return timestampDelta;
  }

  const rankDelta = left.sortRank - right.sortRank;
  if (rankDelta !== 0) {
    return rankDelta;
  }

  return left.sortIndex - right.sortIndex;
}

function getActivitySortRank(event: RunEvent): number {
  if (event.action === "review_state") {
    return 10;
  }
  if (event.action === "check_market_price") {
    return 20;
  }
  if (event.event_type === "market_shock" || event.event_type === "operator_instruction") {
    return 25;
  }
  if (event.event_type === "agent_turn") {
    return 30;
  }

  return 35;
}

function getEventSpeakerName(event: RunEvent): string {
  if (event.agent === "supplier") {
    return "Supplier";
  }
  if (event.agent === "manufacturer") {
    return "Manufacturer";
  }
  if (event.agent === "retailer") {
    return "Retailer";
  }

  return "System";
}

function describeActivityEvent(event: RunEvent, currency: string): string {
  if (
    event.event_type === "market_shock" &&
    event.previous_market_price !== null &&
    event.observed_market_price !== null
  ) {
    const changePercent = roundMoney(
      ((event.observed_market_price - event.previous_market_price) / event.previous_market_price) *
        100,
    );
    return `${event.shock_headline ?? event.note ?? "Market disruption detected."} ${formatCurrency(
      event.previous_market_price,
      currency,
    )} to ${formatCurrency(event.observed_market_price, currency)} (${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}%).`;
  }

  if (event.event_type === "operator_instruction") {
    return event.note ?? "Apply this instruction to the next decisions in this run.";
  }

  if (event.event_type === "agent_turn" && event.reasoning_summary) {
    return event.reasoning_summary;
  }

  if (event.action === "review_state") {
    return "Reviewing the negotiation state, prior offers, and pending message before deciding.";
  }

  if (event.action === "check_market_price") {
    if (
      event.previous_market_price !== null &&
      event.observed_market_price !== null &&
      event.shock_type
    ) {
      return (
        event.shock_headline ??
        `Market moved from ${formatCurrency(event.previous_market_price, currency)} to ${formatCurrency(
          event.observed_market_price,
          currency,
        )}.`
      );
    }

    return (
      event.note ??
      (event.observed_market_price !== null
        ? `Checking market reference price at ${formatCurrency(event.observed_market_price, currency)}.`
        : "Checking market reference price.")
    );
  }

  return event.note ?? "Working through the current negotiation step.";
}

function buildRunLogText({
  run,
  messages,
  events,
  suspectedFailureType,
  whereRunFailed,
}: {
  run: RunRecord;
  messages: RunDetailResponse["conversation"] extends infer T
    ? T extends Array<infer U>
      ? U[]
      : never
    : never;
  events: RunEvent[];
  suspectedFailureType: string | null;
  whereRunFailed:
    | { phase?: string; round?: number; agent?: string; note?: string }
    | undefined;
}): string {
  const header = [
    `Run ID: ${run.id}`,
    `Title: ${run.title}`,
    `Status: ${run.status}`,
    `Created: ${run.created_at}`,
    `Updated: ${run.updated_at}`,
    `Product: ${run.product_context.product_name}`,
    `Market: ${run.product_context.market_region}`,
    `Quantity: ${run.product_context.target_quantity}`,
    `Baseline Price: ${formatCurrency(run.product_context.baseline_unit_price, run.product_context.currency)}`,
    `Failure Type: ${suspectedFailureType ?? "none"}`,
    `Failure Point: ${
      whereRunFailed
        ? `${whereRunFailed.phase ?? "n/a"} | round ${whereRunFailed.round ?? "n/a"} | ${whereRunFailed.agent ?? "n/a"}`
        : "none"
    }`,
    "",
    "Diagnosis",
    `Outcome: ${run.diagnosis.outcome}`,
    `Chain Effect: ${run.diagnosis.chain_effect}`,
    `Key Risks: ${run.diagnosis.key_risks.join(" | ") || "none"}`,
    `Key Signals: ${run.diagnosis.key_signals.join(" | ") || "none"}`,
    `Next Actions: ${run.diagnosis.suggested_next_actions.join(" | ") || "none"}`,
    "",
    "Transcript",
  ];

  const transcriptLines = messages.length
    ? messages.map(
        (message) =>
          `[${message.timestamp}] ${message.speaker_name} | ${message.phase} | round ${message.round} | ${message.kind} | ${
            message.offer_price !== null
              ? formatCurrency(message.offer_price, message.currency)
              : "No price"
          }\n${message.message}`,
      )
    : ["No transcript available."];

  const eventLines = [
    "",
    "Event Log",
    ...(events.length
      ? events.map(
          (event) =>
            `[${event.timestamp}] ${event.event_type} | ${event.phase ?? "run"} | round ${
              event.round ?? "n/a"
            } | ${event.agent ?? "system"} | offer ${
              event.offer_price !== null
                ? formatCurrency(event.offer_price, run.product_context.currency)
                : "n/a"
            } | market ${
              event.observed_market_price !== null
                ? formatCurrency(event.observed_market_price, run.product_context.currency)
                : "n/a"
            }\n${event.note ?? "No additional note recorded."}${
              event.reasoning_summary ? `\nReasoning: ${event.reasoning_summary}` : ""
            }`,
        )
      : ["No event log available."]),
  ];

  return [...header, ...transcriptLines, ...eventLines].join("\n\n");
}

function buildBeliefComparison(samples: BeliefGapSample[]) {
  const latestByAgent = new Map<string, BeliefGapSample>();

  for (const sample of samples) {
    if (!sample.agent) {
      continue;
    }

    latestByAgent.set(sample.agent, sample);
  }

  return Array.from(latestByAgent.entries()).map(([agent, sample]) => ({
    agent,
    observed: sample.observed_market_price,
    gap: sample.belief_gap,
    phaseLabel: sample.phase ? formatLabel(sample.phase) : "Unknown phase",
    roundLabel: sample.round ? `Round ${sample.round}` : "No round",
    summary:
      sample.belief_gap > 0
        ? "This agent priced the market above the baseline."
        : sample.belief_gap < 0
          ? "This agent priced the market below the baseline."
          : "This agent matched the baseline exactly.",
  }));
}

function deriveMarginFromNegotiations(negotiations: NegotiationRecord[]): number | null {
  const first = negotiations.find((item) => item.phase === "supplier_manufacturer");
  const second = negotiations.find((item) => item.phase === "manufacturer_retailer");

  if (!first?.final_price || !second?.final_price) {
    return null;
  }

  return roundMoney(second.final_price - first.final_price);
}

function isOutgoingMessage(phase: PhaseName, speakerId: string): boolean {
  if (phase === "supplier_manufacturer") {
    return speakerId === "manufacturer";
  }

  return speakerId === "retailer";
}

function formatCurrency(value: number, currency: string): string {
  return `${roundMoney(value).toFixed(2)} ${currency}`;
}

function formatSignedCurrency(value: number, currency: string): string {
  const rounded = roundMoney(value).toFixed(2);
  return `${value > 0 ? "+" : ""}${rounded} ${currency}`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatNegotiationPrice(
  negotiation: NegotiationRecord | undefined,
  currency: string,
): string {
  if (!negotiation || negotiation.final_price === null) {
    return "No final price";
  }

  return formatCurrency(negotiation.final_price, currency);
}

function PriceChart({
  currency,
  data,
  compact = false,
}: {
  currency: string;
  data: NegotiationChartData;
  compact?: boolean;
}) {
  const chartPoints = [...data.sellerPoints, ...data.buyerPoints];
  const fallbackReference = data.references[0]?.value ?? 0;
  const values = [
    ...chartPoints.map((point) => point.price),
    ...data.references.map((reference) => reference.value),
    ...(data.closingMarker ? [data.closingMarker.price] : []),
    fallbackReference,
  ];
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  const width = 680;
  const height = compact ? 170 : 240;
  const padding = compact ? 22 : 28;
  const maxTurn = Math.max(
    ...chartPoints.map((point) => point.turn),
    data.closingMarker?.turn ?? 1,
    1,
  );

  function getX(turn: number): number {
    return maxTurn === 1
      ? width / 2
      : padding + ((turn - 1) * (width - padding * 2)) / (maxTurn - 1);
  }

  function getY(price: number): number {
    return (
      height -
      padding -
      ((price - minValue) / range) * (height - padding * 2)
    );
  }

  function buildPath(points: OfferTurnPoint[]): string {
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${getX(point.turn)} ${getY(point.price)}`)
      .join(" ");
  }

  return (
    <div className={`chart-card ${compact ? "compact" : ""}`}>
      <div className="chart-summary">
        <div>
          <div className="eyebrow">{data.title}</div>
          <h3>{chartPoints.length} offer points</h3>
        </div>
        <div className="run-meta">
          <span>X-axis: Turn number</span>
          <span>Y-axis: Price</span>
          <span>
            Range: {formatCurrency(minValue, currency)} to {formatCurrency(maxValue, currency)}
          </span>
        </div>
      </div>
      <div className="chart-shell">
        <svg
          aria-label={`${data.title} price chart`}
          className="price-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
        >
          {data.references.map((reference) => (
            <line
              key={reference.label}
              className={`chart-reference ${reference.tone}`}
              x1={padding}
              x2={width - padding}
              y1={getY(reference.value)}
              y2={getY(reference.value)}
            />
          ))}
          {data.sellerPoints.length > 0 ? (
            <path className="chart-line seller" d={buildPath(data.sellerPoints)} />
          ) : null}
          {data.buyerPoints.length > 0 ? (
            <path className="chart-line buyer" d={buildPath(data.buyerPoints)} />
          ) : null}
          {data.sellerPoints.map((point) => (
            <circle
              className="chart-dot seller"
              cx={getX(point.turn)}
              cy={getY(point.price)}
              key={`seller-${point.turn}-${point.price}`}
              r="4.5"
            />
          ))}
          {data.buyerPoints.map((point) => (
            <circle
              className="chart-dot buyer"
              cx={getX(point.turn)}
              cy={getY(point.price)}
              key={`buyer-${point.turn}-${point.price}`}
              r="4.5"
            />
          ))}
          {Array.from({ length: maxTurn }, (_, index) => index + 1).map((turn) => (
            <text
              className="chart-label"
              key={`turn-${turn}`}
              x={getX(turn)}
              y={height - 8}
              textAnchor="middle"
            >
              {turn}
            </text>
          ))}
          {data.closingMarker ? (
            <g>
              <circle
                className="chart-marker"
                cx={getX(data.closingMarker.turn)}
                cy={getY(data.closingMarker.price)}
                r="7"
              />
              <text
                className="chart-marker-label"
                x={getX(data.closingMarker.turn)}
                y={getY(data.closingMarker.price) - 10}
                textAnchor="middle"
              >
                {data.closingMarker.label}
              </text>
            </g>
          ) : null}
        </svg>
      </div>
      <div className="chart-legend">
        <div className="chart-legend-group">
          <span className="chart-chip seller">{data.sellerLabel} offers</span>
          <span className="chart-chip buyer">{data.buyerLabel} offers</span>
        </div>
        <div className="chart-reference-list">
          {data.references.map((reference) => (
            <span className={`chart-chip ${reference.tone}`} key={reference.label}>
              {reference.label}: {formatCurrency(reference.value, currency)}
            </span>
          ))}
          {data.closingMarker ? (
            <span className="chart-chip marker">
              {data.closingMarker.label}: {formatCurrency(data.closingMarker.price, currency)}
            </span>
          ) : null}
        </div>
      </div>
      {chartPoints.length === 0 ? (
        <div className="phase-empty">No offer prices were recorded for this phase.</div>
      ) : null}
    </div>
  );
}
