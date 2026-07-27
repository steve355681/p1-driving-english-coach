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
 * Phase 4 replaces the fake connect below with a real voice connection and
 * dispatches COACH_SPEAKING / COACH_DONE as the coach's audio starts and stops.
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

  // What we last wrote, so a status the database already has is not written
  // again. Purely an optimisation; the value is never read for logic.
  const lastPersisted = useRef<SessionStatus | null>(null);

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

  // Start the session on mount. Without a voice pipeline there is nothing to
  // wait for, so `CONNECTED` follows immediately — Phase 4 fires it when the
  // audio channel is actually open, and FAIL when it is not.
  useEffect(() => {
    send({ type: "CONNECT" });
    send({ type: "CONNECTED" });
  }, [send]);

  useEffect(() => {
    if (!isRunning(status)) return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  const { label, hint } = SESSION_STATUS_LABELS[status];

  async function end() {
    send({ type: "END" });

    try {
      if (!placeholder) {
        // Transcript is empty until Phase 4 captures one.
        await db.completeSession(session.id, []);
      }
      send({ type: "ENDED" });
      router.push(ROUTES.review(session.id));
    } catch (cause) {
      send({ type: "FAIL" });
      setError(toError(cause).message);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-between px-5 pb-safe pt-safe">
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
          <span className="text-3xl font-semibold">{label}</span>
        </div>
        <p className="text-base text-muted">{hint}</p>
        {error ? (
          <p className="px-6 text-center text-sm text-state-error">{error}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        {status === "paused" ? (
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
