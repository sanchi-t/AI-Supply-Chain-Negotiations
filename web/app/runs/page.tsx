import { RunsPageShell } from "../../components/runs-page-shell";
import { getRuns } from "../../lib/api";


type RunsPageProps = {
  searchParams: Promise<{
    ids?: string;
    selected?: string;
  }>;
};


export default async function RunsPage({ searchParams }: RunsPageProps) {
  const result = await getRuns();
  const params = await searchParams;
  const activeRunIds = params.ids
    ? params.ids.split(",").map((value) => value.trim()).filter(Boolean)
    : [];
  const selectedRunId = params.selected ?? activeRunIds[0] ?? null;
  const initialRuns = result.data ?? [];
  return (
    <RunsPageShell
      error={result.error}
      initialActiveRunIds={activeRunIds}
      initialRuns={initialRuns}
      initialSelectedRunId={selectedRunId}
    />
  );
}
