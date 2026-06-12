"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { SimulationBatchLaunchResult } from "../lib/api-types";


type RunSeedFormProps = {
  mode?: "refresh" | "redirect" | "inline";
  onLaunched?: (payload: SimulationBatchLaunchResult) => void;
};


export function RunSeedForm({
  mode = "refresh",
  onLaunched,
}: RunSeedFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [seed, setSeed] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const parsedSeed = Number(seed);

    if (!Number.isFinite(parsedSeed)) {
      setError("Enter a valid seed number.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/simulation/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ seed: parsedSeed }),
      });

      const payload = (await response.json()) as {
        data: SimulationBatchLaunchResult | null;
        error: string | null;
      };

      if (!response.ok || !payload.data) {
        console.error("Simulation failed:", payload.error ?? "Unknown simulation error");
        setError(payload.error ?? "Simulation could not be completed.");
        setIsSubmitting(false);
        return;
      }

      setSuccess(`${payload.data.count} simulation${payload.data.count === 1 ? "" : "s"} launched.`);
      setIsSubmitting(false);
      navigateAfterLaunch(payload.data);
    } catch {
      console.error("Simulation request failed");
      setError("Unable to reach the simulation service.");
      setIsSubmitting(false);
    }
  }

  function navigateAfterLaunch(launchData: SimulationBatchLaunchResult) {
    const launchedRunIds = launchData.runs.map((run) => run.id).filter(Boolean);
    const runsPath =
      launchedRunIds.length > 0
        ? `/runs?ids=${launchedRunIds.join(",")}&selected=${launchedRunIds[0]}`
        : "/runs";
    startTransition(() => {
      if (mode === "inline") {
        onLaunched?.(launchData);
        return;
      }

      if (mode === "redirect") {
        router.push(runsPath);
        return;
      }

      router.refresh();
    });
  }

  const isBusy = isSubmitting || isPending;
  const canSubmit = seed.trim().length > 0;

  return (
    <form className="seed-form" onSubmit={handleSubmit}>
      <div className="seed-form-row">
        <label className="field">
          <span>Seed Number</span>
          <input
            inputMode="numeric"
            onChange={(event) => setSeed(event.target.value)}
            placeholder="e.g. 42"
            value={seed}
          />
        </label>
        <button
          className="button primary"
          disabled={isBusy || !canSubmit}
          type="submit"
        >
          {isBusy ? "Launching Simulations..." : "Run Simulation"}
        </button>
      </div>

      {isBusy ? (
        <div className="progress-shell" aria-live="polite">
          <div className="progress-bar" />
        </div>
      ) : null}

      {error ? (
        <p className="inline-error">{error}</p>
      ) : null}
      {success ? <p className="inline-success">{success}</p> : null}
    </form>
  );
}
