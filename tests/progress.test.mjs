import assert from "node:assert/strict";
import test from "node:test";

import {
  WEEKS_SHOWN,
  practisedMinutes,
  summariseProgress,
} from "@/lib/progress/summarise";

const NOW = new Date("2026-07-28T09:00:00.000Z"); // a Tuesday

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

test("practised time is what elapsed, not what was requested", () => {
  // The launcher asked for 15; the trial grant cut it to 3.
  assert.equal(
    practisedMinutes(
      session({ endedAt: "2026-07-28T08:03:00.000Z", durationMinutes: 15 }),
    ),
    3,
  );

  // Never connected: no end, so nothing was practised.
  assert.equal(practisedMinutes(session({ endedAt: null })), 0);

  // A row left open and closed hours later cannot exceed the grant.
  assert.equal(
    practisedMinutes(
      session({ endedAt: "2026-07-28T14:00:00.000Z", durationMinutes: 15 }),
    ),
    15,
  );

  // Clock skew must not produce negative practice.
  assert.equal(
    practisedMinutes(session({ endedAt: "2026-07-28T07:00:00.000Z" })),
    0,
  );
});

test("abandoned sessions count as neither time nor a session", () => {
  const result = summariseProgress({
    ...empty,
    sessions: [
      session({ id: "a" }),
      session({ id: "b", endedAt: null, status: "error" }),
      session({ id: "c", endedAt: null, status: "connecting" }),
    ],
  });

  assert.equal(result.sessionCount, 1);
  assert.equal(result.practisedMinutes, 15);
});

test("error themes are counted and ordered by how often they recur", () => {
  const result = summariseProgress({
    ...empty,
    sessions: [session({ id: "s1" })],
    feedback: [
      "word_choice",
      "grammar",
      "grammar",
      "fluency",
      "grammar",
      "word_choice",
    ].map((type) => ({ type, sessionId: "s1" })),
  });

  assert.deepEqual(
    result.weekThemes.map((theme) => [theme.type, theme.count]),
    [
      ["grammar", 3],
      ["word_choice", 2],
      ["fluency", 1],
    ],
  );
  assert.equal(result.weekThemes[0].label, "文法");
});

test("the weekly chart always spans the full window, gaps included", () => {
  const result = summariseProgress(empty);

  assert.equal(result.weeks.length, WEEKS_SHOWN);
  assert.ok(result.weeks.every((week) => week.minutes === 0));
  // Mondays, ascending, ending with the week containing NOW.
  assert.equal(result.weeks.at(-1).start, "2026-07-27");
  assert.equal(result.weeks[0].start, "2026-06-08");
  assert.equal(result.weeks.at(-1).label, "7/27");
});

test("sessions land in the week that contains them", () => {
  const result = summariseProgress({
    ...empty,
    sessions: [
      // Tuesday and Sunday of the same week — Sunday belongs to the week that
      // began six days earlier, not the one starting tomorrow.
      session({ id: "a", startedAt: "2026-07-28T08:00:00.000Z" }),
      session({
        id: "b",
        startedAt: "2026-08-02T08:00:00.000Z",
        endedAt: "2026-08-02T08:10:00.000Z",
      }),
      // The previous week.
      session({
        id: "c",
        startedAt: "2026-07-21T08:00:00.000Z",
        endedAt: "2026-07-21T08:20:00.000Z",
        durationMinutes: 20,
      }),
      // Older than the window: still counted in the totals, not in the chart.
      session({
        id: "d",
        startedAt: "2026-01-05T08:00:00.000Z",
        endedAt: "2026-01-05T08:05:00.000Z",
      }),
    ],
  });

  const current = result.weeks.at(-1);
  assert.equal(current.start, "2026-07-27");
  assert.equal(current.sessions, 2);
  assert.equal(current.minutes, 25);

  const previous = result.weeks.at(-2);
  assert.equal(previous.start, "2026-07-20");
  assert.equal(previous.minutes, 20);

  assert.equal(result.sessionCount, 4);
  assert.equal(result.practisedMinutes, 50);
});
