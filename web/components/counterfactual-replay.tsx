"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  CounterfactualBranchRunResponse,
  CounterfactualReplayResponse,
  CounterfactualTurningPoint,
} from "../lib/api-types";
import { formatLabel } from "../lib/format";


type CounterfactualReplayProps = {
  replay: CounterfactualReplayResponse;
};


export function CounterfactualReplay({ replay }: CounterfactualReplayProps) {
  const router = useRouter();
  const supplierManufacturerSteps = replay.turning_points.filter(
    (point) => point.phase === "supplier_manufacturer",
  );
  const manufacturerRetailerSteps = replay.turning_points.filter(
    (point) => point.phase === "manufacturer_retailer",
  );
  const [branchPivotIndex, setBranchPivotIndex] = useState<number | null>(null);
  const [branchInstruction, setBranchInstruction] = useState("");
  const [branchState, setBranchState] = useState<{
    loading: boolean;
    error: string | null;
    result: CounterfactualBranchRunResponse | null;
  }>({
    loading: false,
    error: null,
    result: null,
  });

  async function handleRunBranch() {
    if (branchPivotIndex === null && branchInstruction.trim().length < 3) {
      setBranchState({
        loading: false,
        error: "Choose a step and add an instruction before starting a new version.",
        result: null,
      });
      return;
    }

    if (branchPivotIndex === null) {
      setBranchState({
        loading: false,
        error: "Choose the step where the new version should start.",
        result: null,
      });
      return;
    }

    if (branchInstruction.trim().length < 3) {
      setBranchState({
        loading: false,
        error: "Add an instruction for what should happen after the selected step.",
        result: null,
      });
      return;
    }

    setBranchState({ loading: true, error: null, result: null });
    try {
      const response = await fetch(`/api/runs/${replay.run_id}/counterfactual/branch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pivot_step_index: branchPivotIndex,
          instruction: branchInstruction.trim(),
          label: `Step ${branchPivotIndex}`,
        }),
      });
      const payload = (await response.json()) as {
        data: CounterfactualBranchRunResponse | null;
        error: string | null;
      };

      if (!response.ok || !payload.data) {
        setBranchState({
          loading: false,
          error: payload.error ?? "Unable to start the new version.",
          result: null,
        });
        return;
      }

      setBranchState({ loading: false, error: null, result: payload.data });
      router.push(`/runs/${payload.data.run_id}`);
    } catch {
      setBranchState({
        loading: false,
        error: "Unable to start the new version.",
        result: null,
      });
    }
  }

  return (
    <main className="counterfactual-page">
      <section className="hero counterfactual-hero">
        <div>
          <h1>Start from a specific moment</h1>
          <p>
            Choose one step from the original run, then tell the next run what should
            happen after that point. The original run stays unchanged.
          </p>
        </div>
      </section>

      <section className="panel replay-branch-panel">
        <div className="branch-control">
          <div>
            <div className="eyebrow">New Version</div>
            <h2>{userText(replay.title)}</h2>
            <p>
              The new run copies the original steps through your selected step. Your
              instruction is only used for decisions after that moment.
            </p>
          </div>
          <label className="field branch-field">
            <span>Instruction After This Step</span>
            <textarea
              onChange={(event) => {
                setBranchInstruction(event.target.value);
                setBranchState({ loading: false, error: null, result: null });
              }}
              placeholder="Example: The manufacturer should make a smaller discount and explain that margins are tight."
              value={branchInstruction}
            />
          </label>
          <div className="comparison-column">
            <div className="eyebrow">What Gets Sent</div>
            <p>
              {branchInstruction.trim() || "Type the instruction you want future decisions to follow."}
            </p>
          </div>
          <button
            className="button primary"
            disabled={branchState.loading}
            onClick={handleRunBranch}
            type="button"
          >
            {branchState.loading ? "Starting..." : "Start New Version"}
          </button>
        </div>

        {branchState.error ? <p className="inline-error">{branchState.error}</p> : null}
        {branchState.result ? (
          <div className="inline-success branch-success">
            {userText(branchState.result.message)}{" "}
            <a href={`/runs/${branchState.result.run_id}`}>
              View New Run
            </a>
          </div>
        ) : null}

        <div className="turning-point-groups">
          {replay.turning_points.length > 0 ? (
            <>
              <StepGroup
                currency={replay.currency}
                isSelected={(point) => branchPivotIndex === point.step_index}
                onSelect={(point) => {
                  setBranchPivotIndex(point.step_index);
                  setBranchState({ loading: false, error: null, result: null });
                }}
                steps={supplierManufacturerSteps}
                title="Supplier to Manufacturer"
              />
              <StepGroup
                currency={replay.currency}
                isSelected={(point) => branchPivotIndex === point.step_index}
                onSelect={(point) => {
                  setBranchPivotIndex(point.step_index);
                  setBranchState({ loading: false, error: null, result: null });
                }}
                steps={manufacturerRetailerSteps}
                title="Manufacturer to Retailer"
              />
            </>
          ) : (
            <div className="empty-state">
              <h2>No steps are available yet</h2>
              <p>The original run has no recorded steps.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}


function StepGroup({
  currency,
  isSelected,
  onSelect,
  steps,
  title,
}: {
  currency: string;
  isSelected: (point: CounterfactualTurningPoint) => boolean;
  onSelect: (point: CounterfactualTurningPoint) => void;
  steps: CounterfactualTurningPoint[];
  title: string;
}) {
  return (
    <section className="turning-point-group">
      <div className="section-heading compact">
        <div>
          <div className="eyebrow">Steps</div>
          <h3>{title}</h3>
        </div>
        <span className="badge">{steps.length} steps</span>
      </div>
      <div className="turning-point-list">
        {steps.length > 0 ? (
          steps.map((point) => (
            <BranchableStep
              currency={currency}
              isSelected={isSelected(point)}
              key={point.step_index}
              onSelect={() => onSelect(point)}
              point={point}
            />
          ))
        ) : (
          <div className="empty-state compact">
            <p>No steps recorded for this part of the deal.</p>
          </div>
        )}
      </div>
    </section>
  );
}


function BranchableStep({
  currency,
  isSelected,
  onSelect,
  point,
}: {
  currency: string;
  isSelected: boolean;
  onSelect: () => void;
  point: CounterfactualTurningPoint;
}) {
  return (
    <article className={isSelected ? "turning-point selected" : "turning-point"}>
      <div className="turning-point-head">
        <span className="badge">Step {point.step_index}</span>
        <strong>
          {formatLabel(point.agent_id)} {formatLabel(point.kind)}
        </strong>
      </div>
      <p>{userText(point.note)}</p>
      <div className="run-meta">
        <span>{formatLabel(point.phase)}</span>
        <span>Round {point.round_number}</span>
        <span>{formatMoney(point.price, currency)}</span>
      </div>
      <div className="hero-actions branch-step-actions">
        <button className="button secondary" onClick={onSelect} type="button">
          {isSelected ? "Selected" : "Start From This Step"}
        </button>
      </div>
    </article>
  );
}


function formatMoney(value: number | null, currency: string): string {
  if (value === null) {
    return "No price";
  }
  return `${value.toFixed(2)} ${currency}`;
}


function userText(value: string): string {
  return value
    .replace(/counterfactual/gi, "what-if change")
    .replace(/\bAI\b/g, "")
    .replace(/LLM-generated/gi, "generated")
    .replace(/\brerun\b/gi, "new version")
    .replace(/\bupstream\b/gi, "first deal")
    .replace(/\bdownstream\b/gi, "second deal")
    .replace(/\bagents?\b/gi, "participants")
    .replace(/\s{2,}/g, " ")
    .trim();
}
