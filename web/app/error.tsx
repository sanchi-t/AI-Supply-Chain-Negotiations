"use client";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};


export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main className="panel">
      <div className="eyebrow">Error</div>
      <h1>Something went wrong</h1>
      <p>The page could not be loaded.</p>
      <div className="hero-actions">
        <button className="button secondary" onClick={reset} type="button">
          Try Again
        </button>
      </div>
    </main>
  );
}
