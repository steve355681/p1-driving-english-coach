import type { FeedbackType, Session } from "@/types";

/**
 * Cross-session aggregation for the dashboard (FR-5).
 *
 * Pure on purpose: everything here is arithmetic over rows, which is exactly
 * the kind of thing that is wrong in a way nobody notices for weeks. Keeping it
 * free of Supabase means it can be tested offline against fixed input.
 *
 * There is no score trend, per the Phase 5 decision in docs/07. What is
 * measured here is what actually happened — minutes spoken, mistakes repeated,
 * phrases collected — rather than a number describing how well it went.
 */

export const WEEKS_SHOWN = 8;

/** Feedback types the review can produce; see `lib/review/config.ts`. */
export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  grammar: "文法",
  word_choice: "用詞選擇",
  fluency: "流暢度",
  pronunciation: "發音",
};

export interface ErrorTheme {
  type: FeedbackType;
  label: string;
  count: number;
}

export interface Expression {
  phrase: string;
  meaningZh: string;
  sessionId: string;
}

export interface WeekBucket {
  /** ISO date of the Monday that starts the week, in UTC. */
  start: string;
  label: string;
  minutes: number;
  sessions: number;
}

export interface ProgressSummary {
  /** Sessions that produced real speaking time, not launcher visits. */
  sessionCount: number;
  practisedMinutes: number;
  errorThemes: ErrorTheme[];
  expressions: Expression[];
  weeks: WeekBucket[];
}

/**
 * How long a session actually ran.
 *
 * Not `durationMinutes` — that is what the learner asked for before the drive.
 * A trial grant caps at three minutes, sessions get ended early, and a session
 * that never connected still carries its requested duration. Summing the
 * request would tell someone who opened the launcher five times and never spoke
 * that they had practised 75 minutes.
 *
 * Clamped to the requested duration as a guard against a row that was left open
 * and closed hours later; the voice grant makes anything longer impossible.
 */
export function practisedMinutes(session: Session): number {
  if (!session.endedAt) return 0;

  const elapsed = Date.parse(session.endedAt) - Date.parse(session.startedAt);
  if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;

  return Math.min(elapsed / 60000, session.durationMinutes);
}

/** Monday 00:00 UTC of the week containing `iso`. UTC keeps it deterministic. */
function weekStart(iso: string): string {
  const date = new Date(iso);
  // getUTCDay() is 0 for Sunday, which belongs to the week that began six days
  // earlier rather than the one starting the next day.
  const offset = (date.getUTCDay() + 6) % 7;
  const monday = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - offset,
    ),
  );
  return monday.toISOString().slice(0, 10);
}

function shiftWeeks(isoDate: string, weeks: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

export function summariseProgress(input: {
  sessions: Session[];
  /** One entry per feedback item across all the caller's sessions. */
  feedbackTypes: FeedbackType[];
  vocabulary: Expression[];
  now: Date;
}): ProgressSummary {
  const practised = input.sessions
    .map((session) => ({ session, minutes: practisedMinutes(session) }))
    .filter((entry) => entry.minutes > 0);

  const counts = new Map<FeedbackType, number>();
  for (const type of input.feedbackTypes) {
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  const errorThemes: ErrorTheme[] = [...counts.entries()]
    .map(([type, count]) => ({
      type,
      label: FEEDBACK_TYPE_LABELS[type] ?? type,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  // The same phrase can come out of several reviews. Showing it twice makes the
  // wall look padded and buries the phrases that only appeared once.
  const seen = new Set<string>();
  const expressions = input.vocabulary.filter((item) => {
    const key = item.phrase.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Fixed-width buckets, always the same eight weeks whether or not anything
  // was practised. A chart that only shows weeks with sessions hides exactly
  // the gaps this view exists to make visible.
  const thisWeek = weekStart(input.now.toISOString());
  const weeks: WeekBucket[] = Array.from({ length: WEEKS_SHOWN }, (_, index) => {
    const start = shiftWeeks(thisWeek, index - (WEEKS_SHOWN - 1));
    const [, month, day] = start.split("-");
    return {
      start,
      label: `${Number(month)}/${Number(day)}`,
      minutes: 0,
      sessions: 0,
    };
  });

  const byStart = new Map(weeks.map((week) => [week.start, week]));
  for (const { session, minutes } of practised) {
    const bucket = byStart.get(weekStart(session.startedAt));
    if (!bucket) continue;
    bucket.minutes += minutes;
    bucket.sessions += 1;
  }
  for (const week of weeks) week.minutes = Math.round(week.minutes);

  return {
    sessionCount: practised.length,
    practisedMinutes: Math.round(
      practised.reduce((sum, entry) => sum + entry.minutes, 0),
    ),
    errorThemes,
    expressions,
    weeks,
  };
}
