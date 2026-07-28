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
import type { Session, SessionStatus } from "@/types";

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

  const audioRef = useRef<HTMLAudioElement>(null);
  const voiceRef = useRef<VoiceConnection | null>(null);
  const lastPersisted = useRef<SessionStatus | null>(null);
  const transcriptRef = useRef<TranscriptLog | null>(null);
  const savingRef = useRef(false);

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
        if (next === current || placeholder) return next;

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

  async function connect() {
    setError(null);
    setNotice(null);
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

      const log = createTranscriptLog();
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
              if (log.due()) void flushTranscript();
              break;
            case "error":
              setError(event.error.message);
              break;
            case "closed":
              break;
          }
        },
      });

      // A trial grant is shorter than the chosen duration; say so once, before
      // the drive, rather than cutting out unexplained later.
      const granted = voiceRef.current.grantedSeconds;
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

  async function end() {
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

      <div className="flex flex-col gap-3">
        {idle || failed ? (
          <Button size="driving" fullWidth onClick={connect}>
            {failed ? "再試一次" : "開始對話"}
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
        <Button size="lg" variant="ghost" fullWidth onClick={end}>
          結束並查看回顧
        </Button>
      </div>
    </div>
  );
}
