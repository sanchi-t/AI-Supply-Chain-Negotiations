"use client";

type RunsErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};


export default function RunsErrorPage({ reset }: RunsErrorPageProps) {
  return (
    <main className="panel">
      <div className="eyebrow">Runs</div>
      <h1>Unable to load runs</h1>
      <p>The runs page hit an unexpected error.</p>
      <div className="hero-actions">
        <button className="button secondary" onClick={reset} type="button">
          Try Again
        </button>
      </div>
    </main>
  );
}
