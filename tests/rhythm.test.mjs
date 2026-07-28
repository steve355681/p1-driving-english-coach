import assert from "node:assert/strict";
import test from "node:test";

import {
  REVIEW_INTERVALS_DAYS,
  REVIEW_STAGES,
  buildWall,
  dueAt,
  isFinished,
} from "@/lib/progress/rhythm";
import { summariseProgress } from "@/lib/progress/summarise";

const NOW = new Date("2026-07-28T09:00:00.000Z"); // a Tuesday
const DAY = 24 * 60 * 60 * 1000;

function phrase(overrides) {
  return {
    id: "p",
    phrase: "on hold",
    meaningZh: "暫緩中",
    sessionId: "s",
    createdAt: "2026-07-28T08:00:00.000Z",
    reviewStage: 0,
    lastReviewedAt: null,
    ...overrides,
  };
}

test("three intervals — a day, a week, a month — and they widen", () => {
  assert.deepEqual([...REVIEW_INTERVALS_DAYS], [1, 7, 30]);
  assert.equal(REVIEW_STAGES, 3);

  const ascending = REVIEW_INTERVALS_DAYS.every(
    (days, i) => i === 0 || days > REVIEW_INTERVALS_DAYS[i - 1],
  );
  assert.ok(ascending, "a later stage must never come round sooner");
});

test("a phrase is scheduled from its last recall, or from when it was collected", () => {
  // Never reviewed: anchored to createdAt, and stage 0 waits a day.
  assert.equal(
    dueAt(phrase()),
    Date.parse("2026-07-28T08:00:00.000Z") + DAY,
  );

  // Reviewed once: the 7-day interval runs from the recall, not from creation.
  assert.equal(
    dueAt(
      phrase({ reviewStage: 1, lastReviewedAt: "2026-07-28T08:00:00.000Z" }),
    ),
    Date.parse("2026-07-28T08:00:00.000Z") + 7 * DAY,
  );
});

test("a phrase collected today waits a day before it is due", () => {
  const [item] = buildWall([phrase()], NOW);
  assert.equal(item.due, false);
  assert.equal(item.stage, 0);
  assert.equal(item.intervalDays, 1);

  const [tomorrow] = buildWall([phrase()], new Date(NOW.getTime() + DAY));
  assert.equal(tomorrow.due, true);
});

test("a phrase inside its interval is not due", () => {
  // Reviewed an hour ago at stage 2, which waits thirty days.
  const [item] = buildWall(
    [phrase({ reviewStage: 2, lastReviewedAt: "2026-07-28T08:00:00.000Z" })],
    NOW,
  );
  assert.equal(item.due, false);
  assert.equal(item.intervalDays, 30);
  assert.equal(item.dueAtMs, Date.parse("2026-07-28T08:00:00.000Z") + 30 * DAY);
});

test("a phrase that has cleared every interval leaves the wall", () => {
  assert.ok(isFinished(REVIEW_STAGES));
  assert.equal(
    buildWall([phrase({ reviewStage: REVIEW_STAGES })], NOW).length,
    0,
  );
});

test("a duplicate never resurrects a finished phrase or resets progress", () => {
  // Same phrase from two sessions: one finished, one collected again today.
  const wall = buildWall(
    [
      phrase({ id: "new", reviewStage: 0 }),
      phrase({ id: "done", reviewStage: REVIEW_STAGES }),
    ],
    NOW,
  );
  assert.equal(wall.length, 0, "the finished copy wins, so it stays gone");

  // Same phrase, one part-way through: progress is kept, not reset to 0.
  const partial = buildWall(
    [
      phrase({ id: "new", reviewStage: 0 }),
      phrase({
        id: "old",
        reviewStage: 2,
        lastReviewedAt: "2026-07-27T08:00:00.000Z",
      }),
    ],
    NOW,
  );
  assert.equal(partial.length, 1);
  assert.equal(partial[0].id, "old");
  assert.equal(partial[0].stage, 2);
});

test("due phrases come first, earliest in the rhythm before the rest", () => {
  const wall = buildWall(
    [
      phrase({ id: "a", phrase: "settled", reviewStage: 1, lastReviewedAt: "2026-07-28T08:00:00.000Z" }),
      phrase({ id: "b", phrase: "overdue-late", reviewStage: 2, lastReviewedAt: "2026-06-01T08:00:00.000Z" }),
      phrase({ id: "c", phrase: "overdue-early", reviewStage: 0, lastReviewedAt: "2026-06-01T08:00:00.000Z" }),
    ],
    NOW,
  );

  assert.deepEqual(
    wall.map((item) => [item.id, item.due]),
    [
      ["c", true],
      ["b", true],
      ["a", false],
    ],
  );
});

// --- the weekly note -------------------------------------------------------

function session(overrides) {
  return {
    id: "s",
    userId: "u",
    topic: "Work & Career",
    durationMinutes: 15,
    level: "B1",
    status: "completed",
    startedAt: "2026-07-28T08:00:00.000Z",
    endedAt: "2026-07-28T08:15:00.000Z",
    transcript: [],
    summary: null,
    scoreOverall: null,
    scoreFluency: null,
    scoreClarity: null,
    scoreVocab: null,
    ...overrides,
  };
}

const empty = { sessions: [], feedback: [], vocabulary: [], now: NOW };

test("a week with no practice is told plainly, not congratulated", () => {
  const cold = summariseProgress(empty);
  assert.match(cold.weekNote, /本週還沒有練習紀錄/);

  const lapsed = summariseProgress({
    ...empty,
    sessions: [
      session({
        id: "lastweek",
        startedAt: "2026-07-21T08:00:00.000Z",
        endedAt: "2026-07-21T08:15:00.000Z",
      }),
    ],
  });
  assert.match(lapsed.weekNote, /上週練了 1 次，本週還沒開始/);
});

test("practice with no review says where the review is", () => {
  const result = summariseProgress({ ...empty, sessions: [session()] });
  assert.match(result.weekNote, /本週練了 1 次、15 分鐘/);
  assert.match(result.weekNote, /還沒有回顧內容/);
});

test("the note names this week's top problem and compares with last week", () => {
  const result = summariseProgress({
    ...empty,
    sessions: [
      session({ id: "now" }),
      session({
        id: "prev",
        startedAt: "2026-07-21T08:00:00.000Z",
        endedAt: "2026-07-21T08:10:00.000Z",
      }),
    ],
    feedback: [
      { type: "grammar", sessionId: "now" },
      { type: "grammar", sessionId: "now" },
      { type: "fluency", sessionId: "now" },
      // Last week's corrections must not be counted in this week's chart.
      { type: "word_choice", sessionId: "prev" },
    ],
  });

  assert.deepEqual(
    result.weekThemes.map((theme) => [theme.type, theme.count]),
    [
      ["grammar", 2],
      ["fluency", 1],
    ],
  );
  assert.match(result.weekNote, /挑出 3 個可以修的地方/);
  assert.match(result.weekNote, /最常出現的是「文法」/);
  assert.match(result.weekNote, /比上週多開口 5 分鐘/);
});
