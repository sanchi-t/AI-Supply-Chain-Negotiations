import Link from "next/link";


export default function RunNotFoundPage() {
  return (
    <main className="panel">
      <div className="eyebrow">Run Detail</div>
      <h1>Run not found</h1>
      <p>The requested run record does not exist in local storage.</p>
      <div className="hero-actions">
        <Link className="button secondary" href="/runs">
          Back to Runs
        </Link>
      </div>
    </main>
  );
}
