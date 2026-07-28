"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { removeSessions } from "@/lib/data";
import { practisedMinutes } from "@/lib/progress/summarise";
import { ROUTES } from "@/lib/constants";
import { cn, formatDateZh, toError } from "@/lib/utils";
import type { Session } from "@/types";

/**
 * Practice history, with photo-album style selection for deleting.
 *
 * A long press turns the list into a picker; after that a tap selects instead
 * of opening. Deleting is destructive and permanent — the transcript and its
 * review go with the row — so it deliberately takes three deliberate acts:
 * hold, choose, then press a button that names the count.
 */

/** Long enough not to fire on a tap, short enough not to feel broken. */
const HOLD_MS = 500;
/** A press that travels this far was the start of a scroll, not a hold. */
const MOVE_TOLERANCE_PX = 10;

export function SessionList({
  sessions,
  loading,
  placeholder,
  onDeleted,
}: {
  sessions: Session[];
  loading: boolean;
  placeholder: boolean;
  onDeleted: () => void;
}) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdOrigin = useRef<{ x: number; y: number } | null>(null);
  /**
   * A completed long press is still followed by a click, which would open the
   * session the learner just selected. This swallows exactly that one click.
   */
  const swallowClick = useRef(false);

  function cancelHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    holdOrigin.current = null;
  }

  function startHold(session: Session, event: React.PointerEvent) {
    if (selecting) return;

    holdOrigin.current = { x: event.clientX, y: event.clientY };
    holdTimer.current = setTimeout(() => {
      swallowClick.current = true;
      setSelecting(true);
      setSelected(new Set([session.id]));
    }, HOLD_MS);
  }

  function trackHold(event: React.PointerEvent) {
    const origin = holdOrigin.current;
    if (!origin) return;

    // The list scrolls, so a drag that begins on a card is usually someone
    // scrolling past it rather than reaching for selection.
    const travelled =
      Math.abs(event.clientX - origin.x) + Math.abs(event.clientY - origin.y);
    if (travelled > MOVE_TOLERANCE_PX) cancelHold();
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
    setError(null);
  }

  async function deleteSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;

    setDeleting(true);
    setError(null);
    try {
      // Placeholder mode has no rows to delete; the parent reload puts the
      // fixtures straight back, which is the honest outcome for demo data.
      if (!placeholder) await removeSessions(ids);
      stopSelecting();
      onDeleted();
    } catch (cause) {
      setError(toError(cause).message);
    } finally {
      setDeleting(false);
    }
  }

  const count = selected.size;

  return (
    <section>
      <SectionHeading
        title="最近的練習"
        hint={
          selecting
            ? "點一下選取或取消選取"
            : sessions.length > 0
              ? "長按可以選取並刪除"
              : undefined
        }
        action={
          selecting ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={stopSelecting}>
                取消
              </Button>
              <Button
                variant="danger"
                disabled={count === 0 || deleting}
                onClick={deleteSelected}
              >
                {deleting ? "刪除中…" : `刪除 ${count} 筆`}
              </Button>
            </div>
          ) : undefined
        }
      />

      {error ? (
        <p className="mb-3 text-xs text-state-error">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">載入中…</p>
      ) : (
        /* Three fit above the fold; the rest scroll in place rather than
           pushing the recurring-problem and review sections off screen. */
        <ul className="flex max-h-[15.5rem] flex-col gap-3 overflow-y-auto overscroll-contain pr-1">
          {sessions.map((session) => {
            const minutes = Math.round(practisedMinutes(session));
            const chosen = selected.has(session.id);

            return (
              <li key={session.id}>
                <Link
                  href={ROUTES.review(session.id)}
                  onPointerDown={(event) => startHold(session, event)}
                  onPointerMove={trackHold}
                  onPointerUp={cancelHold}
                  onPointerCancel={cancelHold}
                  onPointerLeave={cancelHold}
                  // Without this, a long press on iOS raises the link callout
                  // and on Android the context menu, either of which lands on
                  // top of the selection the hold was meant to make.
                  onContextMenu={(event) => event.preventDefault()}
                  onClick={(event) => {
                    if (swallowClick.current) {
                      swallowClick.current = false;
                      event.preventDefault();
                      return;
                    }
                    if (!selecting) return;
                    event.preventDefault();
                    toggle(session.id);
                  }}
                  aria-pressed={selecting ? chosen : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border bg-surface p-4 transition-colors",
                    "select-none [-webkit-touch-callout:none]",
                    chosen
                      ? "border-brand bg-brand/5"
                      : "border-line hover:bg-surface-2",
                  )}
                >
                  {selecting ? (
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                        chosen
                          ? "border-brand bg-brand text-base"
                          : "border-line text-transparent",
                      )}
                    >
                      ✓
                    </span>
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-medium">
                        {session.topic}
                      </p>
                      <p className="shrink-0 text-xs text-muted">
                        {formatDateZh(session.startedAt)}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {minutes > 0 ? `${minutes} 分` : "未完成"} · {session.level}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
