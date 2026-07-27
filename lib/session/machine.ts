/**
 * Live session state machine (docs/04, section 2).
 *
 * A pure reducer with no React and no I/O, so Phase 4 can drive it from the
 * voice pipeline by dispatching events rather than by reaching into component
 * state. Anything the machine cannot express is a bug in the machine, not
 * something to work around at the call site.
 */

import type { SessionStatus } from "@/types";

export type SessionEvent =
  | { type: "CONNECT" }
  | { type: "CONNECTED" }
  /** Phase 4: the coach's audio started / stopped. */
  | { type: "COACH_SPEAKING" }
  | { type: "COACH_DONE" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "END" }
  | { type: "ENDED" }
  | { type: "FAIL" }
  | { type: "RETRY" };

const TRANSITIONS: Record<
  SessionStatus,
  Partial<Record<SessionEvent["type"], SessionStatus>>
> = {
  idle: { CONNECT: "connecting" },
  connecting: { CONNECTED: "listening", END: "ending", FAIL: "error" },
  listening: {
    COACH_SPEAKING: "ai_speaking",
    PAUSE: "paused",
    END: "ending",
    FAIL: "error",
  },
  ai_speaking: {
    COACH_DONE: "listening",
    PAUSE: "paused",
    END: "ending",
    FAIL: "error",
  },
  // Resuming always returns to listening: the coach's turn was interrupted, so
  // it is the user's turn again.
  paused: { RESUME: "listening", END: "ending", FAIL: "error" },
  ending: { ENDED: "completed", FAIL: "error" },
  completed: {},
  error: { RETRY: "connecting", END: "ending" },
};

/** Unknown events for the current state are ignored, not errors. */
export function nextStatus(
  status: SessionStatus,
  event: SessionEvent,
): SessionStatus {
  return TRANSITIONS[status][event.type] ?? status;
}

/** A session that has stopped moving on its own. */
export function isTerminal(status: SessionStatus) {
  return status === "completed" || status === "error";
}

/** Whether the elapsed timer should be running. */
export function isRunning(status: SessionStatus) {
  return status === "listening" || status === "ai_speaking";
}

/**
 * What gets written to `sessions.status`.
 *
 * `ai_speaking` collapses into `listening` because the two flip back and forth
 * on every conversational turn. Persisting each flip would mean a write every
 * few seconds per user for a distinction nobody queries — the column exists to
 * answer "is this session in progress, paused, or finished".
 */
export function persistedStatus(status: SessionStatus): SessionStatus {
  return status === "ai_speaking" ? "listening" : status;
}
