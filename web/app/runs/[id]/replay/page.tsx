import Link from "next/link";
import { notFound } from "next/navigation";

import { CounterfactualReplay } from "../../../../components/counterfactual-replay";
import { ErrorState } from "../../../../components/error-state";
import { getRunCounterfactualReplay } from "../../../../lib/api";


type CounterfactualReplayPageProps = {
  params: Promise<{
    id: string;
  }>;
};


export default async function CounterfactualReplayPage({
  params,
}: CounterfactualReplayPageProps) {
  const { id } = await params;
  const result = await getRunCounterfactualReplay(id);

  if (!result.data && result.status === 404) {
    notFound();
  }

  if (!result.data) {
    return (
      <main className="panel">
        <div className="eyebrow">Replay</div>
        <h1>This view is not available</h1>
        <ErrorState title="Unable to load this replay page" message={result.error} />
        <div className="page-actions">
          <Link className="button secondary" href={`/runs/${id}`}>
            Back To Run
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <div className="page-actions replay-back-link">
        <Link className="button secondary" href={`/runs/${id}`}>
          Back To Run
        </Link>
      </div>
      <CounterfactualReplay replay={result.data} />
    </>
  );
}
