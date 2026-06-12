"use client";

import { useEffect, useMemo, useState } from "react";

import { ErrorState } from "./error-state";
import { RunSeedForm } from "./run-seed-form";
import { RunsWorkspace } from "./runs-workspace";
import {
  PhaseName,
  RunRecord,
  RunSummary,
  SimulationBatchLaunchResult,
} from "../lib/api-types";


type RunsPageShellProps = {
  initialRuns: RunSummary[];
  initialActiveRunIds: string[];
  initialSelectedRunId: string | null;
  error: string | null;
};

function toRunSummary(run: RunRecord): RunSummary {
  const latestNegotiationPhase = run.negotiations.at(-1)?.phase;
  const latestStepPhase = run.steps.at(-1)?.phase;

  return {
    id: run.id,
    title: run.title,
    status: run.status,
    created_at: run.created_at,
    updated_at: run.updated_at,
    scenario: run.scenario,
    agent_count: run.agents.length,
    step_count: run.steps.length,
    current_phase:
      latestStepPhase ??
      latestNegotiationPhase ??
      run.phases[0]?.name ??
      ("supplier_manufacturer" satisfies PhaseName),
  };
}


export function RunsPageShell({
  initialRuns,
  initialActiveRunIds,
  initialSelectedRunId,
  error,
}: RunsPageShellProps) {
  const [runs, setRuns] = useState(initialRuns);
  const [activeRunIds, setActiveRunIds] = useState(initialActiveRunIds);
  const [selectedRunId, setSelectedRunId] = useState(initialSelectedRunId);

  useEffect(() => {
    setRuns(initialRuns);
  }, [initialRuns]);

  useEffect(() => {
    setActiveRunIds(initialActiveRunIds);
  }, [initialActiveRunIds]);

  useEffect(() => {
    setSelectedRunId(initialSelectedRunId);
  }, [initialSelectedRunId]);

  const visibleRuns = useMemo(
    () =>
      activeRunIds.length > 0
        ? activeRunIds
            .map((id) => runs.find((run) => run.id === id))
            .filter((run): run is RunSummary => Boolean(run))
        : runs,
    [activeRunIds, runs],
  );

  return (
    <main className="runs-page">
      <section className="panel">
        <div className="runs-page-header">
          <div className="runs-page-copy">
            <div className="eyebrow">Runs</div>
            <h1>Runs</h1>
            <p>
              Each run is one saved orange seller, manufacturer, and retailer negotiation chain.
              Running a seed creates three new runs at once.
            </p>
          </div>

          <div className="page-actions">
            <RunSeedForm
              mode="inline"
              onLaunched={(payload: SimulationBatchLaunchResult) => {
                setRuns((currentRuns) => {
                  const launchedRuns = payload.runs.map(toRunSummary);
                  const launchedRunIds = new Set(launchedRuns.map((run) => run.id));
                  const remainingRuns = currentRuns.filter((run) => !launchedRunIds.has(run.id));
                  return [...launchedRuns, ...remainingRuns];
                });
                const launchedRunIds = payload.runs.map((run) => run.id);
                setActiveRunIds(launchedRunIds);
                setSelectedRunId(launchedRunIds[0] ?? null);
              }}
            />
          </div>
        </div>

        {error ? (
          <ErrorState title="Unable to load runs" message={error} />
        ) : visibleRuns.length === 0 ? (
          <div className="empty-state">
            <h2>No runs found</h2>
            <p>Run a simulation and the new record will appear here.</p>
          </div>
        ) : null}
      </section>

      {!error && visibleRuns.length > 0 ? (
        <RunsWorkspace
          activeRunIds={activeRunIds}
          initialRuns={runs}
          initialSelectedRunId={selectedRunId}
        />
      ) : null}
    </main>
  );
}
