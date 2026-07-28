/**
 * Collects the conversation as it happens and decides when to write it down.
 *
 * `docs/04` is explicit that the transcript must not depend on end-of-session
 * persistence. A drive can end with a dead battery, a tunnel, or a browser tab
 * evicted while backgrounded — and a session whose transcript only existed in
 * memory produces no review at all, which is the half of the product that
 * happens after the car stops.
 */

import type { TranscriptTurn } from "@/types";

/** Write after this many new turns, whichever comes first. */
const FLUSH_EVERY_TURNS = 4;
/** …or after this long with anything pending. */
const FLUSH_AFTER_MS = 20_000;

export function shouldFlush(input: {
  pendingTurns: number;
  msSinceLastFlush: number;
}) {
  if (input.pendingTurns === 0) return false;
  return (
    input.pendingTurns >= FLUSH_EVERY_TURNS ||
    input.msSinceLastFlush >= FLUSH_AFTER_MS
  );
}

export interface TranscriptLog {
  add: (turn: Omit<TranscriptTurn, "at">) => void;
  /** Everything captured so far, oldest first. */
  all: () => TranscriptTurn[];
  /** True when it is worth writing to the database now. */
  due: (now?: number) => boolean;
  /** Marks the current contents as written. */
  markFlushed: (now?: number) => void;
  pending: () => number;
}

export function createTranscriptLog(startedAt = Date.now()): TranscriptLog {
  const turns: TranscriptTurn[] = [];
  let flushedCount = 0;
  let lastFlush = startedAt;

  return {
    add(turn) {
      const text = turn.text.trim();
      // Empty transcriptions happen — a cough, road noise, a false trigger.
      // Storing them would pad the review with nothing to review.
      if (!text) return;

      turns.push({
        ...turn,
        text,
        at: Math.round((Date.now() - startedAt) / 1000),
      });
    },
    all: () => [...turns],
    due: (now = Date.now()) =>
      shouldFlush({
        pendingTurns: turns.length - flushedCount,
        msSinceLastFlush: now - lastFlush,
      }),
    markFlushed(now = Date.now()) {
      flushedCount = turns.length;
      lastFlush = now;
    },
    pending: () => turns.length - flushedCount,
  };
}

/**
 * Which server events carry text, and whose.
 *
 * Matched on suffixes for the same reason as the audio events: these names
 * have been renamed before, and a miss here is silent — the session sounds
 * fine and the review turns up empty.
 */
export function classifyTranscript(
  type: string,
): TranscriptTurn["role"] | null {
  if (/input_audio_transcription\.completed$/.test(type)) return "user";
  if (/audio_transcript\.done$/.test(type)) return "coach";
  return null;
}
