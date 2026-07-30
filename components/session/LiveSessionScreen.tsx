"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { db } from "@/lib/data";
import {
  isRunning,
  nextStatus,
  persistedStatus,
  type SessionEvent,
} from "@/lib/session/machine";
import { connectVoice, type VoiceConnection } from "@/lib/voice/connection";
import {
  createTranscriptLog,
  type TranscriptLog,
} from "@/lib/session/transcript";
import { getAccessToken } from "@/lib/supabase/auth";
import {
  ROUTES,
  SESSION_STATUS_COLOR,
  SESSION_STATUS_LABELS,
} from "@/lib/constants";
import { cn, formatElapsed, toError } from "@/lib/utils";
import type { Session, SessionStatus, TranscriptTurn } from "@/types";

/**
 * How long the coach may be silent mid-turn before the screen says so. Long
 * enough that an ordinary pause between clauses never trips it.
 */
const STALL_NOTICE_MS = 6000;

/** How many turns the peek panel shows. Deliberately not scrollable. */
const RECENT_TURNS = 2;

/**
 * Driving mode.
 *
 * Hard rules for this screen:
 * - one glanceable status, one timer, two large controls — nothing else
 * - no paragraphs, no corrections, no navigation
 * - every tap target is at least 7rem tall
 *
 * The connection starts on a tap rather than on mount. Safari refuses both
 * microphone access and audio playback without a user gesture, so an automatic
 * connect would fail on exactly the device this product is for. The tap happens
 * while parked, which is where the setup is supposed to happen anyway.
 */
export function LiveSessionScreen({
  session,
  placeholder,
}: {
  session: Session;
  placeholder: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * The last couple of turns, for when the conversation starts going in
   * circles and the learner needs to see what was actually said.
   *
   * Collapsed by default and it stays that way unless asked for: this screen's
   * whole point is that it does not reward looking at it. Two turns is the cap
   * — enough to catch a misheard word, not enough to read while moving.
   */
  const [recent, setRecent] = useState<TranscriptTurn[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const voiceRef = useRef<VoiceConnection | null>(null);
  const lastPersisted = useRef<SessionStatus | null>(null);
  const transcriptRef = useRef<TranscriptLog | null>(null);
  const savingRef = useRef(false);
  /**
   * Wall clock, not the elapsed timer. The credential expires a fixed number
   * of seconds after it was minted regardless of pauses, so a deadline that
   * paused with the UI would outlive the connection it belongs to.
   */
  const deadlineRef = useRef<number | null>(null);
  const endingRef = useRef(false);
  /** Set while the coach has gone quiet mid-turn, so the notice is shown once. */
  const stalledRef = useRef(false);

  /**
   * Writes the whole transcript, not a delta. Sending the full array makes a
   * retry or an out-of-order write harmless, where appending could duplicate
   * turns. Overlapping writes are skipped rather than queued — the next flush
   * carries everything anyway.
   */
  const flushTranscript = useCallback(async () => {
    const log = transcriptRef.current;
    if (!log || placeholder || savingRef.current) return;

    savingRef.current = true;
    const snapshot = log.all();
    try {
      await db.saveTranscript(session.id, snapshot);
      log.markFlushed();
    } catch (cause) {
      // Keep the turns pending so the next flush retries them. A failed save
      // must not interrupt the conversation.
      console.error("Could not save transcript", cause);
    } finally {
      savingRef.current = false;
    }
  }, [placeholder, session.id]);

  const send = useCallback(
    (event: SessionEvent) => {
      setStatus((current) => {
        const next = nextStatus(current, event);
        if (next === current) return next;

        // Pausing has to stop the audio, not just the label.
        voiceRef.current?.setMicrophoneEnabled(next !== "paused");

        if (placeholder) return next;

        const toWrite = persistedStatus(next);
        if (toWrite !== lastPersisted.current) {
          lastPersisted.current = toWrite;
          // Fire and forget: a failed status write must not interrupt a session
          // that is otherwise fine. The user is driving.
          db.updateSessionStatus(session.id, toWrite).catch((cause) => {
            console.error("Could not save session status", cause);
          });
        }
        return next;
      });
    },
    [placeholder, session.id],
  );

  // Releasing the microphone on unmount matters: leaving it open keeps the
  // recording indicator lit and the mic live after the user has left.
  useEffect(() => {
    return () => voiceRef.current?.close();
  }, []);

  useEffect(() => {
    if (!isRunning(status)) return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  // The turn-count trigger alone would strand a few turns whenever the
  // conversation goes quiet, which is exactly when a drive tends to end.
  useEffect(() => {
    if (!isRunning(status)) return;
    const timer = setInterval(() => {
      if (transcriptRef.current?.due()) void flushTranscript();
    }, 5000);
    return () => clearInterval(timer);
  }, [status, flushTranscript]);

  /**
   * Says something when the coach goes quiet mid-turn.
   *
   * The model does occasionally stall for several seconds in the middle of a
   * response. Nothing is broken and nothing needs restarting, but the screen
   * used to show "教練說話中" over total silence, which is indistinguishable
   * from a dead connection. Naming it is the fix; the silence itself belongs
   * to the model.
   */
  useEffect(() => {
    if (status !== "ai_speaking") {
      stalledRef.current = false;
      return;
    }

    const timer = setInterval(() => {
      const last = voiceRef.current?.lastActivityAt();
      if (!last) return;

      const idle = Date.now() - last;
      if (idle >= STALL_NOTICE_MS && !stalledRef.current) {
        stalledRef.current = true;
        setNotice("教練停頓了一下，直接說話就可以接下去。");
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [status]);

  // Ends the session when the granted time runs out. The driver cannot be
  // expected to watch a clock and tap a button, and without this the
  // credential simply expires mid-sentence and the session is left open in the
  // database with no ending.
  useEffect(() => {
    if (status !== "listening" && status !== "ai_speaking" && status !== "paused") {
      return;
    }

    const timer = setInterval(() => {
      const deadline = deadlineRef.current;
      if (deadline === null) return;

      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        void endSession("時間到，已為你結束這次練習。");
      } else if (remaining <= 60_000) {
        setNotice("剩下不到 1 分鐘。");
      }
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  /**
   * Opens the voice connection. Also the reconnect path, which is why it does
   * not start from scratch: a session interrupted by a phone call keeps the
   * transcript it already has and the deadline it was already running to.
   */
  async function connect() {
    setError(null);
    setNotice(null);
    stalledRef.current = false;
    send({ type: "CONNECT" });

    if (placeholder) {
      // No database means no credential to fetch; run the shell so the flow is
      // still walkable.
      setNotice("尚未連上資料庫，語音沒有實際連線。");
      send({ type: "CONNECTED" });
      return;
    }

    try {
      const accessToken = await getAccessToken();
      const audioElement = audioRef.current;
      if (!audioElement) throw new Error("音訊元件尚未就緒。");

      // Reused on reconnect. A fresh log would drop every turn that had not
      // been flushed when the connection died.
      const log = transcriptRef.current ?? createTranscriptLog();
      transcriptRef.current = log;

      voiceRef.current = await connectVoice({
        sessionId: session.id,
        requestedSeconds: session.durationMinutes * 60,
        accessToken,
        audioElement,
        onEvent: (event) => {
          switch (event.type) {
            case "connected":
              send({ type: "CONNECTED" });
              break;
            case "coach-speaking":
              send({ type: "COACH_SPEAKING" });
              break;
            case "coach-done":
              send({ type: "COACH_DONE" });
              break;
            case "transcript":
              log.add({ role: event.role, text: event.text });
              setRecent(log.all().slice(-RECENT_TURNS));
              if (log.due()) void flushTranscript();
              break;
            case "error":
              setError(event.error.message);
              break;
            case "dropped":
              // The connection is already gone; `close()` on a dead peer is a
              // no-op, but clearing the ref stops pause/resume from acting on
              // tracks the OS has already stopped.
              voiceRef.current = null;
              setError(`${event.reason}點「重新連線」可以接著練，逐字稿會保留。`);
              send({ type: "FAIL" });
              break;
            case "closed":
              break;
          }
        },
      });

      // A trial grant is shorter than the chosen duration; say so once, before
      // the drive, rather than cutting out unexplained later.
      // The deadline never moves outward on reconnect. A drive does not get
      // longer because the connection dropped, and the new credential expires
      // on its own clock regardless.
      const granted = voiceRef.current.grantedSeconds;
      deadlineRef.current = Math.min(
        deadlineRef.current ?? Number.POSITIVE_INFINITY,
        Date.now() + granted * 1000,
      );
      const notes: string[] = [];
      if (granted < session.durationMinutes * 60) {
        notes.push(`本次可練習 ${Math.round(granted / 60)} 分鐘。`);
      }
      if (!voiceRef.current.transcription) {
        notes.push("這次無法記錄逐字稿，練習結束後不會有回顧內容。");
      }
      if (notes.length) setNotice(notes.join(" "));
    } catch (cause) {
      setError(toError(cause).message);
      send({ type: "FAIL" });
    }
  }

  async function endSession(reason?: string) {
    // The deadline and a tap can arrive together; ending twice would push the
    // review route twice and race two writes.
    if (endingRef.current) return;
    endingRef.current = true;

    deadlineRef.current = null;
    if (reason) setNotice(reason);
    voiceRef.current?.close();
    voiceRef.current = null;
    send({ type: "END" });

    try {
      if (!placeholder) {
        // The final write carries everything, including turns a periodic flush
        // has not reached yet.
        await db.completeSession(session.id, transcriptRef.current?.all() ?? []);
      }
      send({ type: "ENDED" });
      router.push(ROUTES.review(session.id));
    } catch (cause) {
      endingRef.current = false;
      send({ type: "FAIL" });
      setError(toError(cause).message);
    }
  }

  const { label, hint } = SESSION_STATUS_LABELS[status];
  const idle = status === "idle";
  const failed = status === "error";

  return (
    <div className="flex min-h-dvh flex-col justify-between px-5 pb-safe pt-safe">
      <audio ref={audioRef} autoPlay className="hidden" />

      <div className="flex items-center justify-between text-sm text-muted">
        <span>{session.topic}</span>
        <span aria-label="已進行時間" className="tabular-nums">
          {formatElapsed(elapsed)}
        </span>
      </div>

      <div
        className="flex flex-1 flex-col items-center justify-center gap-4"
        aria-live="polite"
      >
        <div
          className={cn(
            "flex size-44 items-center justify-center rounded-full border-4 border-current",
            SESSION_STATUS_COLOR[status],
            isRunning(status) && "animate-pulse",
          )}
        >
          <span className="text-3xl font-semibold">
            {idle ? "準備好了" : label}
          </span>
        </div>
        <p className="text-base text-muted">{idle ? "點下方開始" : hint}</p>

        {notice ? (
          <p className="px-6 text-center text-sm text-state-paused">{notice}</p>
        ) : null}
        {error ? (
          <p className="px-6 text-center text-sm text-state-error">{error}</p>
        ) : null}
      </div>

      {/* Above the controls, so reaching for it can never be confused with
          reaching for 暫停 or 結束. */}
      {!idle && recent.length > 0 ? (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowTranscript((open) => !open)}
            aria-expanded={showTranscript}
            className="min-h-11 w-full text-center text-sm text-muted underline underline-offset-4"
          >
            {showTranscript ? "收起逐字稿" : "看剛剛說了什麼"}
          </button>

          {showTranscript ? (
            <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-line bg-surface px-4 py-3">
              {recent.map((turn, index) => (
                <p
                  key={`${turn.at}-${index}`}
                  className="text-sm leading-relaxed"
                >
                  <span className="mr-2 text-xs text-muted">
                    {turn.role === "coach" ? "教練" : "你"}
                  </span>
                  <span className="text-fg">{turn.text}</span>
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {idle || failed ? (
          <Button size="driving" fullWidth onClick={connect}>
            {failed ? "重新連線" : "開始對話"}
          </Button>
        ) : status === "paused" ? (
          <Button
            size="driving"
            fullWidth
            onClick={() => send({ type: "RESUME" })}
          >
            繼續
          </Button>
        ) : (
          <Button
            size="driving"
            variant="secondary"
            fullWidth
            disabled={!isRunning(status)}
            onClick={() => send({ type: "PAUSE" })}
          >
            暫停
          </Button>
        )}
        <Button size="lg" variant="ghost" fullWidth onClick={() => endSession()}>
          結束並查看回顧
        </Button>
      </div>
    </div>
  );
}
