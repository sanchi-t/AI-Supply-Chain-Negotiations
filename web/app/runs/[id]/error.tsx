"use client";

import Link from "next/link";


type RunDetailErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};


export default function RunDetailErrorPage({ reset }: RunDetailErrorPageProps) {
  return (
    <main className="panel">
      <div className="eyebrow">Run Detail</div>
      <h1>Unable to load run</h1>
      <p>The run detail page hit an unexpected error.</p>
      <div className="hero-actions">
        <button className="button secondary" onClick={reset} type="button">
          Try Again
        </button>
        <Link className="button secondary" href="/runs">
          Back to Runs
        </Link>
      </div>
    </main>
  );
}
