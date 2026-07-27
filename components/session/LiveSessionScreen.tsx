"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  ROUTES,
  SESSION_STATUS_COLOR,
  SESSION_STATUS_LABELS,
} from "@/lib/constants";
import { cn, formatElapsed } from "@/lib/utils";
import type { SessionStatus } from "@/types";

/**
 * Driving mode.
 *
 * Hard rules for this screen:
 * - one glanceable status, one timer, two large controls — nothing else
 * - no paragraphs, no corrections, no navigation
 * - every tap target is at least 7rem tall
 *
 * Phase 1 wires the UI only. `status` is local state so the shell is
 * demoable; the real state machine (connecting / ai_speaking / error
 * transitions, persistence) is Phase 3, and the voice pipeline is Phase 4.
 */
export function LiveSessionScreen({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<SessionStatus>("listening");
  const [elapsed, setElapsed] = useState(0);

  const running = status === "listening" || status === "ai_speaking";

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const { label, hint } = SESSION_STATUS_LABELS[status];

  function endSession() {
    setStatus("ending");
    router.push(ROUTES.review(sessionId));
  }

  return (
    <div className="flex min-h-dvh flex-col justify-between px-5 pb-safe pt-safe">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>練習進行中</span>
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
            running && "animate-pulse",
          )}
        >
          <span className="text-3xl font-semibold">{label}</span>
        </div>
        <p className="text-base text-muted">{hint}</p>
      </div>

      <div className="flex flex-col gap-3">
        {status === "paused" ? (
          <Button size="driving" fullWidth onClick={() => setStatus("listening")}>
            繼續
          </Button>
        ) : (
          <Button
            size="driving"
            variant="secondary"
            fullWidth
            onClick={() => setStatus("paused")}
          >
            暫停
          </Button>
        )}
        <Button size="lg" variant="ghost" fullWidth onClick={endSession}>
          結束並查看回顧
        </Button>
      </div>
    </div>
  );
}
