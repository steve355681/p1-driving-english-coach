import type { WeekBucket } from "@/lib/progress/summarise";

/**
 * Minutes practised per week.
 *
 * Bars rather than a line: a line implies a continuous quantity between
 * points, and a week with no practice is a real zero, not a dip on the way
 * somewhere. Every week in the window is drawn even when empty — the gaps are
 * the point of the chart.
 *
 * This is not a score trend. docs/07 rules those out, so what is plotted is
 * what actually happened rather than a judgement about how it went.
 */
export function WeeklyChart({ weeks }: { weeks: WeekBucket[] }) {
  const peak = Math.max(...weeks.map((week) => week.minutes), 1);

  return (
    <div className="flex items-end justify-between gap-1.5" role="list">
      {weeks.map((week) => (
        <div
          key={week.start}
          role="listitem"
          className="flex flex-1 flex-col items-center gap-1.5"
          title={`${week.label} 那週 ${week.minutes} 分鐘`}
        >
          <span className="text-[10px] tabular-nums text-muted">
            {week.minutes || ""}
          </span>
          <div className="flex h-20 w-full items-end">
            <div
              className={
                week.minutes > 0
                  ? "w-full rounded-t bg-brand"
                  : "w-full rounded-t bg-surface-2"
              }
              // A zero week still gets a hairline, so the row reads as eight
              // weeks with gaps rather than as a chart missing its axis.
              style={{
                height: week.minutes
                  ? `${Math.max((week.minutes / peak) * 100, 8)}%`
                  : "2px",
              }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted">
            {week.label}
          </span>
        </div>
      ))}
    </div>
  );
}
