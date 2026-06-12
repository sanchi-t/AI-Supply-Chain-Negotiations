import { notFound } from "next/navigation";

import { ErrorState } from "../../../components/error-state";
import { LiveRunDetail } from "../../../components/live-run-detail";
import { getRunDetail } from "../../../lib/api";


type RunDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};


export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { id } = await params;
  const result = await getRunDetail(id);

  if (!result.data && result.status === 404) {
    notFound();
  }

  if (!result.data) {
    return (
      <main className="panel">
        <div className="eyebrow">Run Detail</div>
        <h1>Run unavailable</h1>
        <ErrorState title="Unable to load run" message={result.error} />
      </main>
    );
  }

  return <LiveRunDetail initialDetail={result.data} />;
}
