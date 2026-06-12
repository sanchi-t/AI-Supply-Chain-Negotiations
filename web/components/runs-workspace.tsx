"use client";

import { useEffect, useMemo, useState } from "react";

import { ErrorState } from "./error-state";
import { LiveRunDetail } from "./live-run-detail";
import { RunStripCard } from "./run-strip-card";
import {
  RunDetailResponse,
  RunSummary,
} from "../lib/api-types";


type RunsWorkspaceProps = {
  initialRuns: RunSummary[];
  activeRunIds: string[];
  initialSelectedRunId: string | null;
};


export function RunsWorkspace({
  initialRuns,
  activeRunIds,
  initialSelectedRunId,
}: RunsWorkspaceProps) {
  const [runs, setRuns] = useState(initialRuns);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    initialSelectedRunId ?? initialRuns[0]?.id ?? null,
  );
  const [detail, setDetail] = useState<RunDetailResponse | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const visibleRuns = useMemo(() => {
    if (activeRunIds.length === 0) {
      return runs;
    }

    const ordered = activeRunIds
      .map((id) => runs.find((run) => run.id === id))
      .filter((run): run is RunSummary => Boolean(run));

    return ordered;
  }, [activeRunIds, runs]);
  const stripClassName =
    visibleRuns.length === 1 ? "run-strip run-strip-single" : "run-strip";

  useEffect(() => {
    setRuns(initialRuns);
  }, [initialRuns]);

  useEffect(() => {
    const visibleRunIds = visibleRuns.map((run) => run.id);

    if (
      initialSelectedRunId &&
      initialSelectedRunId !== selectedRunId &&
      visibleRunIds.includes(initialSelectedRunId)
    ) {
      setSelectedRunId(initialSelectedRunId);
      return;
    }

    if (selectedRunId && visibleRunIds.includes(selectedRunId)) {
      return;
    }

    setSelectedRunId(visibleRunIds[0] ?? null);
  }, [initialSelectedRunId, selectedRunId, visibleRuns]);

  useEffect(() => {
    if (activeRunIds.length === 0) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch("/api/runs", {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          data: RunSummary[] | null;
          error: string | null;
        };

        if (!response.ok || !payload.data) {
          return;
        }

        setRuns(payload.data);
      } catch {
        return;
      }
    }, 1800);

    return () => window.clearInterval(intervalId);
  }, [activeRunIds]);

  useEffect(() => {
    if (!selectedRunId) {
      setDetail(null);
      return;
    }

    let isCancelled = false;

    async function loadDetail() {
      const response = await fetch(`/api/runs/${selectedRunId}/detail`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        data: RunDetailResponse | null;
        error: string | null;
      };

      if (isCancelled) {
        return;
      }

      if (!response.ok || !payload.data) {
        setDetail(null);
        setDetailError(payload.error ?? "Unable to load run detail.");
        return;
      }

      setDetail(payload.data);
      setDetailError(null);
    }

    loadDetail().catch(() => {
      if (!isCancelled) {
        setDetail(null);
        setDetailError("Unable to load run detail.");
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedRunId]);

  return (
    <div className="runs-workspace">
      {visibleRuns.length > 0 ? (
        <section className={stripClassName}>
          {visibleRuns.map((run) => (
            <RunStripCard
              active={selectedRunId === run.id}
              href={`/runs/${run.id}`}
              key={run.id}
              run={run}
              single={visibleRuns.length === 1}
            />
          ))}
        </section>
      ) : null}

      {detailError ? (
        <ErrorState title="Unable to load run detail" message={detailError} />
      ) : null}

      {detail ? <LiveRunDetail initialDetail={detail} key={detail.run.id} /> : null}
    </div>
  );
}
