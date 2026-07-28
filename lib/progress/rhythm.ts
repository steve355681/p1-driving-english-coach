/**
 * Spaced review for the expression wall.
 *
 * The Ebbinghaus forgetting curve says a phrase seen once is mostly gone within
 * a day, and that each successful recall flattens the curve — so the useful
 * schedule is short gaps that widen. These intervals are the conventional
 * ones, counted from the last time the phrase was actually recalled.
 *
 * Pure, and takes `now` as an argument, because "is this due yet" is date
 * arithmetic across day boundaries and time zones, which is exactly the kind of
 * thing that is quietly wrong for weeks.
 */

import type { FeedbackType } from "@/types";

/**
 * Days to wait at each stage before a phrase is worth seeing again.
 *
 * Stage 0 is zero days on purpose: the first recall belongs right after the
 * drive, while the conversation it came from is still fresh. Everything after
 * that widens.
 */
export const REVIEW_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30] as const;

/** A phrase that has cleared every interval has left the wall. */
export const REVIEW_STAGES = REVIEW_INTERVALS_DAYS.length;

const DAY_MS = 24 * 60 * 60 * 1000;

/** What the database gives us for one collected phrase. */
export interface PhraseRow {
  id: string;
  phrase: string;
  meaningZh: string;
  sessionId: string;
  createdAt: string;
  reviewStage: number;
  lastReviewedAt: string | null;
}

export interface WallPhrase {
  id: string;
  phrase: string;
  meaningZh: string;
  sessionId: string;
  stage: number;
  /** True when the interval for the current stage has elapsed. */
  due: boolean;
  /** Days in the current interval — what the chip's colour means. */
  intervalDays: number;
}

/** Categories on the dashboard's recurring-problem chart. */
export interface FeedbackRef {
  type: FeedbackType;
  sessionId: string;
}

export function isFinished(stage: number) {
  return stage >= REVIEW_STAGES;
}

/** When a phrase at `stage` becomes worth seeing again. */
export function dueAt(row: Pick<PhraseRow, "createdAt" | "reviewStage" | "lastReviewedAt">) {
  const anchor = Date.parse(row.lastReviewedAt ?? row.createdAt);
  const days = REVIEW_INTERVALS_DAYS[row.reviewStage] ?? 0;
  return anchor + days * DAY_MS;
}

/**
 * Builds the wall: one entry per distinct phrase, finished ones removed, due
 * ones first.
 *
 * De-duplication happens *before* the finished filter, and keeps the copy that
 * has been reviewed most. A phrase that comes up in a second conversation gets
 * a fresh row at stage 0, and without this ordering that fresh row would either
 * reset visible progress or — worse — resurrect a phrase the learner had
 * already finished, because the finished copy was filtered out and the new one
 * was not.
 */
export function buildWall(rows: PhraseRow[], now: Date): WallPhrase[] {
  const best = new Map<string, PhraseRow>();

  for (const row of rows) {
    const key = row.phrase.trim().toLowerCase();
    if (!key) continue;

    const current = best.get(key);
    // Rows arrive newest first, so a strict `>` keeps the newest copy among
    // equal stages — that is the review the chip should link back to.
    if (!current || row.reviewStage > current.reviewStage) best.set(key, row);
  }

  const time = now.getTime();

  return [...best.values()]
    .filter((row) => !isFinished(row.reviewStage))
    .map((row) => ({
      id: row.id,
      phrase: row.phrase.trim(),
      meaningZh: row.meaningZh,
      sessionId: row.sessionId,
      stage: row.reviewStage,
      due: time >= dueAt(row),
      intervalDays: REVIEW_INTERVALS_DAYS[row.reviewStage] ?? 0,
    }))
    .sort((a, b) => {
      // Due first — the wall's job is to show what is worth a glance now.
      if (a.due !== b.due) return a.due ? -1 : 1;
      // Then earliest in the rhythm, which is where forgetting is fastest.
      return a.stage - b.stage || a.phrase.localeCompare(b.phrase);
    });
}
