"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { RunSummary } from "../lib/api-types";
import { formatDateTime, formatLabel } from "../lib/format";


type RunSelectorProps = {
  runs: RunSummary[];
  variant?: "page" | "nav";
};


export function RunSelector({ runs, variant = "page" }: RunSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedRunId = pathname?.startsWith("/runs/")
    ? pathname.split("/")[2] ?? ""
    : searchParams.get("selected") ?? searchParams.get("ids") ?? "";

  return (
    <div className={`run-selector-shell ${variant === "nav" ? "nav" : ""}`}>
      <label className={`field run-selector-field ${variant === "nav" ? "nav" : ""}`}>
        <span>{variant === "nav" ? "Open Run" : "Run ID"}</span>
        <select
          className={`run-selector ${variant === "nav" ? "nav" : ""}`}
          value={selectedRunId}
          onChange={(event) => {
            const nextRunId = event.target.value;
            if (!nextRunId) {
              return;
            }

            router.push(`/runs?ids=${nextRunId}&selected=${nextRunId}`, {
              scroll: false,
            });
          }}
        >
          <option value="">{variant === "nav" ? "Select run id" : "Select a run"}</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {run.id} · {formatLabel(run.status)} · {formatDateTime(run.updated_at)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
