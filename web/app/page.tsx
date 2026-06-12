import Link from "next/link";

import { RunSeedForm } from "../components/run-seed-form";
import { getRuns } from "../lib/api";
import { formatDateTime, formatLabel } from "../lib/format";


const CHAIN_NODES = [
  {
    title: "Seller",
    symbol: "crate",
    tone: "leaf",
    metrics: [
      ["Offer Price", "$1.88/lb"],
      ["Margin", "18%"],
      ["Inventory", "High"],
    ],
  },
  {
    title: "Juicer",
    symbol: "tank",
    tone: "red",
    metrics: [
      ["Target Cost", "$1.72/lb"],
      ["Capacity", "85%"],
      ["Risk", "Medium"],
    ],
  },
  {
    title: "Retailer",
    symbol: "tag",
    tone: "orange",
    metrics: [
      ["Shelf Price", "$5.49"],
      ["Demand", "Strong"],
      ["Stock", "Low"],
    ],
  },
  {
    title: "Market",
    symbol: "board",
    tone: "yellow",
    metrics: [
      ["Forecast", "+12%"],
      ["Pressure", "Hot"],
      ["Volatility", "7%"],
    ],
  },
];

const MARKET_CONDITIONS = [
  ["Grove Yield", "87", "vine"],
  ["Juicing Cost", "42", "orange"],
  ["Retail Demand", "73", "red"],
  ["Freeze Risk", "28", "steel"],
  ["Competitor Pricing", "61", "charcoal"],
  ["Citrus Demand", "79", "leaf"],
];

function OrangeMark() {
  return (
    <span className="orange-mark" aria-hidden="true">
      <span className="orange-mark-leaves" />
      <span className="orange-mark-shine" />
    </span>
  );
}

function FlowGlyph({ symbol }: { symbol: string }) {
  return (
    <span className={`flow-glyph ${symbol}`} aria-hidden="true">
      <span />
    </span>
  );
}

export default async function HomePage() {
  const runsResult = await getRuns();
  const recentRuns = (runsResult.data ?? []).slice(0, 5);

  return (
    <main className="orange-dashboard">
      <section className="orange-command">
        <div className="orange-seed-field" aria-hidden="true" />
        <div className="orange-slice huge one" aria-hidden="true" />
        <div className="orange-slice huge two" aria-hidden="true" />

        <div className="command-copy">
          <div className="brand-lockup">
            <OrangeMark />
            <span>Orange Treaty</span>
          </div>
          <div className="eyebrow citrus-stamp">Citrus market negotiation</div>
          <h1>Run an Orange Supply Chain Negotiation</h1>
          <p>
            Seed the market, start the negotiation, and watch orange economics move
            from grove to juicer to shelf.
          </p>
          <div className="command-badges" aria-label="Simulation capabilities">
            <span className="orange-chip vine">Grove market feed</span>
            <span className="orange-chip red">Freeze shock ready</span>
            <span className="orange-chip yellow">Trace live</span>
          </div>
        </div>

        <aside className="simulation-console" aria-label="Launch simulation">
          <div className="console-header">
            <div>
              <div className="eyebrow">Launch Simulation Batch</div>
              <h2>Open the citrus desk</h2>
            </div>
          </div>
          <RunSeedForm mode="redirect" />
          <p className="console-note">
            Runs open in the analysis workspace with chat replay, price movement,
            belief divergence, and export logs.
          </p>
        </aside>
      </section>

      <section className="orange-grid">
        <article className="orange-panel supply-panel">
          <div className="panel-title-row">
            <div>
              <div className="eyebrow">Supply Chain Flow</div>
              <h2>Grove pressure, juice capacity, and deal movement</h2>
            </div>
            <span className="orange-chip vine">Grove to shelf</span>
          </div>

          <div className="supply-flow" aria-label="Seller to processor to retailer to market">
            {CHAIN_NODES.map((node, index) => (
              <div className="flow-step" key={node.title}>
                <article className={`flow-node ${node.tone}`}>
                  <div className="flow-node-head">
                    <FlowGlyph symbol={node.symbol} />
                    <h3>{node.title}</h3>
                  </div>
                  <dl className="metric-list">
                    {node.metrics.map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
                {index < CHAIN_NODES.length - 1 ? (
                  <div className="citrus-arrow" aria-hidden="true">
                    <span />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </article>

        <aside className="orange-panel pulse-panel">
          <div className="panel-title-row compact">
            <div>
              <div className="eyebrow">Negotiation Pulse</div>
              <h2>Batch pressure</h2>
            </div>
            <span className="orange-chip yellow">Live</span>
          </div>

          <div className="pulse-stat-grid">
            <div>
              <span>Phase</span>
              <strong>Juicing Cost</strong>
            </div>
            <div>
              <span>Round</span>
              <strong>2 of 4</strong>
            </div>
          </div>

          <div className="stance-stack">
            <div><span>Seller stance</span><b className="orange-chip red">Firm</b></div>
            <div><span>Manufacturer stance</span><b className="orange-chip vine">Flexible</b></div>
            <div><span>Retail demand</span><b className="orange-chip yellow">Rising</b></div>
          </div>

          <div className="offer-meter">
            <div><span>Current offer</span><strong>$1.88/lb</strong></div>
            <div className="juice-drip" aria-hidden="true" />
            <div><span>Counteroffer</span><strong>$1.81/lb</strong></div>
          </div>

          <div className="probability-meter">
            <div><span>Outcome probability</span><strong>68%</strong></div>
            <span className="meter-track"><span /></span>
          </div>
        </aside>
      </section>

      <section className="orange-grid lower-grid">
        <article className="orange-panel market-panel">
          <div className="panel-title-row">
            <div>
              <div className="eyebrow">Market Conditions</div>
              <h2>Orange weather, shelf heat, and pricing drag</h2>
            </div>
          </div>
          <div className="gauge-grid">
            {MARKET_CONDITIONS.map(([label, value, tone]) => (
              <div className={`orange-gauge ${tone}`} key={label}>
                <div className="gauge-top">
                  <span>{label}</span>
                  <strong>{value}%</strong>
                </div>
                <span className="gauge-track">
                  <span style={{ width: `${value}%` }} />
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="orange-panel recent-panel">
          <div className="panel-title-row">
            <div>
              <div className="eyebrow">Recent Runs</div>
              <h2>Stamped crate records</h2>
            </div>
            <Link className="button secondary crate-button" href="/runs">
              View Runs
            </Link>
          </div>

          <div className="recent-run-table">
            {recentRuns.length > 0 ? (
              recentRuns.map((run) => (
                <Link className="recent-run-row" href={`/runs/${run.id}`} key={run.id}>
                  <span className="run-id">{run.id.slice(0, 12)}</span>
                  <span>{run.scenario}</span>
                  <span className={run.status === "completed" ? "orange-chip vine" : run.status === "failed" ? "orange-chip red" : "orange-chip yellow"}>
                    {formatLabel(run.status)}
                  </span>
                  <span>{run.step_count} steps</span>
                  <span>{formatDateTime(run.updated_at)}</span>
                </Link>
              ))
            ) : (
              <div className="empty-crate">
                <OrangeMark />
                <h3>No oranges in the crate yet.</h3>
                <p>Run a simulation and the new record will appear here.</p>
              </div>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
