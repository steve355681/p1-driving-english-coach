import type { ReactNode } from "react";

export function SectionHeading({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  /** Controls that belong to the section, shown on the heading row. */
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
