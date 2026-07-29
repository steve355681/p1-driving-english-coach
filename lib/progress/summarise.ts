import { buildWall, type FeedbackRef, type PhraseRow, type WallPhrase } from "@/lib/progress/rhythm";
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
};

export interface ErrorTheme {
  type: FeedbackType;
  label: string;
  count: number;
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
  /** This week only — see `weekNote` for the context that makes it readable. */
  weekThemes: ErrorTheme[];
  weekNote: string;
  expressions: WallPhrase[];
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

function countThemes(types: FeedbackType[]): ErrorTheme[] {
  const counts = new Map<FeedbackType, number>();
  for (const type of types) counts.set(type, (counts.get(type) ?? 0) + 1);

  return [...counts.entries()]
    .map(([type, count]) => ({
      type,
      label: FEEDBACK_TYPE_LABELS[type] ?? type,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

/**
 * The line under this week's chart.
 *
 * Written from the numbers rather than by a model. It has to render instantly,
 * offline, and on every dashboard load — a metered call for one sentence would
 * cost money every time the page is opened, and say less than the comparison
 * does. It is allowed to be encouraging but not to be untrue: a week with no
 * practice is told plainly, because a dashboard that congratulates you for
 * nothing is worth nothing.
 */
function weeklyNote(input: {
  sessions: number;
  minutes: number;
  lastWeekSessions: number;
  lastWeekMinutes: number;
  themes: ErrorTheme[];
}): string {
  if (input.sessions === 0) {
    return input.lastWeekSessions > 0
      ? `上週練了 ${input.lastWeekSessions} 次，本週還沒開始。挑一個 10 分鐘的主題就能接回節奏。`
      : "本週還沒有練習紀錄。第一次最難，挑 10 分鐘、選一個熟悉的主題就好。";
  }

  const opening = `本週練了 ${input.sessions} 次、${input.minutes} 分鐘。`;

  if (input.themes.length === 0) {
    return `${opening}還沒有回顧內容 —— 打開任何一次練習，回顧就會產生。`;
  }

  const top = input.themes[0];
  const total = input.themes.reduce((sum, theme) => sum + theme.count, 0);
  const focus = `回顧挑出 ${total} 個可以修的地方，最常出現的是「${top.label}」。`;

  let trend: string;
  if (input.lastWeekMinutes === 0) {
    trend = "這週先當基準，下週就有得比了。";
  } else if (input.minutes > input.lastWeekMinutes) {
    trend = `比上週多開口 ${input.minutes - input.lastWeekMinutes} 分鐘，保持住。`;
  } else if (input.minutes === input.lastWeekMinutes) {
    trend = "和上週一樣多，穩定比爆發有用。";
  } else {
    trend = `比上週少了 ${input.lastWeekMinutes - input.minutes} 分鐘，補一次短的就追回來了。`;
  }

  return `${opening}${focus}${trend}`;
}

export function summariseProgress(input: {
  sessions: Session[];
  /** One entry per feedback item across all the caller's sessions. */
  feedback: FeedbackRef[];
  vocabulary: PhraseRow[];
  now: Date;
}): ProgressSummary {
  const practised = input.sessions
    .map((session) => ({ session, minutes: practisedMinutes(session) }))
    .filter((entry) => entry.minutes > 0);

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

  // Feedback is bucketed by when the *session* happened, not when the review
  // was generated. A drive reviewed days later still belongs to the week the
  // learner was actually speaking.
  const lastWeek = shiftWeeks(thisWeek, -1);
  const sessionWeeks = new Map(
    input.sessions.map((session) => [session.id, weekStart(session.startedAt)]),
  );
  const weekThemes = countThemes(
    input.feedback
      .filter((item) => sessionWeeks.get(item.sessionId) === thisWeek)
      .map((item) => item.type),
  );

  const current = byStart.get(thisWeek);
  const previous = byStart.get(lastWeek);

  return {
    sessionCount: practised.length,
    practisedMinutes: Math.round(
      practised.reduce((sum, entry) => sum + entry.minutes, 0),
    ),
    weekThemes,
    weekNote: weeklyNote({
      sessions: current?.sessions ?? 0,
      minutes: current?.minutes ?? 0,
      lastWeekSessions: previous?.sessions ?? 0,
      lastWeekMinutes: previous?.minutes ?? 0,
      themes: weekThemes,
    }),
    expressions: buildWall(input.vocabulary, input.now),
    weeks,
  };
}
