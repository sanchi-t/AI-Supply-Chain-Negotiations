import Link from "next/link";

import { RunSummary } from "../lib/api-types";
import { formatDateTime, formatLabel } from "../lib/format";

type RunStripCardProps = {
  run: RunSummary;
  active?: boolean;
  href?: string;
  onClick?: () => void;
  single?: boolean;
};

export function RunStripCard({
  run,
  active = false,
  href,
  onClick,
  single = false,
}: RunStripCardProps) {
  const className = `run-strip-card ${active ? "active" : ""} ${single ? "single" : ""}`.trim();
  const statusClassName =
    run.status === "completed"
      ? "badge leaf"
      : run.status === "failed"
        ? "badge danger"
        : "badge pulse";
  const content = (
    <>
      <div className="run-strip-header">
        <strong>{run.id}</strong>
        <span className={statusClassName}>
          {formatLabel(run.status)}
        </span>
      </div>
      <div className="run-strip-body">
        <div className="run-strip-title">{run.title}</div>
        <div className="run-meta">
          <span>{formatDateTime(run.updated_at)}</span>
          <span>{run.step_count} steps</span>
          <span>{formatLabel(run.current_phase)}</span>
        </div>
      </div>
    </>
  );

  if (href) {
    return (
      <Link className={className} href={href}>
        {content}
      </Link>
    );
  }

  return (
    <button className={className} onClick={onClick} type="button">
      {content}
    </button>
  );
}
