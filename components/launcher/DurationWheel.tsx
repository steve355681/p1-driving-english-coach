"use client";

import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { SessionDuration } from "@/types";

const ITEM_HEIGHT = 56;
/** Odd, so exactly one row sits in the centre slot. */
const VISIBLE_ROWS = 5;

const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const EDGE_PADDING = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2;

/** How long scrolling must be idle before we treat the wheel as settled.
 *  `scrollend` would be cleaner but Safari only shipped it recently. */
const SETTLE_MS = 120;

/**
 * Scroll-snap duration picker. Used in the launcher only — this is a
 * before-driving control, so a bit of interaction cost is fine here in a way it
 * would not be on the live session screen.
 */
export function DurationWheel({
  options,
  value,
  onChange,
}: {
  options: SessionDuration[];
  value: SessionDuration;
  onChange: (value: SessionDuration) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAligned = useRef(false);

  const indexOf = useCallback(
    (target: SessionDuration) => Math.max(0, options.indexOf(target)),
    [options],
  );

  // Align the wheel whenever `value` changes from the outside — including the
  // first paint. Skipped when the wheel is already parked on that row, which is
  // what stops a scroll -> onChange -> scroll feedback loop.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const target = indexOf(value);
    if (Math.round(list.scrollTop / ITEM_HEIGHT) === target) return;

    list.scrollTo({
      top: target * ITEM_HEIGHT,
      behavior: hasAligned.current ? "smooth" : "auto",
    });
    hasAligned.current = true;
  }, [value, indexOf]);

  useEffect(() => {
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  function handleScroll() {
    if (settleTimer.current) clearTimeout(settleTimer.current);

    settleTimer.current = setTimeout(() => {
      const list = listRef.current;
      if (!list) return;

      const index = Math.round(list.scrollTop / ITEM_HEIGHT);
      const clamped = Math.min(options.length - 1, Math.max(0, index));
      const next = options[clamped];
      if (next !== value) onChange(next);
    }, SETTLE_MS);
  }

  return (
    <div
      className="relative select-none"
      style={{ height: WHEEL_HEIGHT }}
    >
      {/* Centre slot marker. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-2xl border border-brand/40 bg-brand/5"
        style={{ height: ITEM_HEIGHT }}
      />

      <div
        ref={listRef}
        role="listbox"
        aria-label="練習長度"
        tabIndex={-1}
        onScroll={handleScroll}
        className={cn(
          "h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain",
          // Hide the scrollbar — it reads as chrome on a picker.
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // Fade the rows away from the centre so it reads as a wheel.
          "[mask-image:linear-gradient(to_bottom,transparent,black_28%,black_72%,transparent)]",
        )}
        style={{ paddingTop: EDGE_PADDING, paddingBottom: EDGE_PADDING }}
      >
        {options.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={selected}
              aria-label={`${option} 分鐘`}
              onClick={() => onChange(option)}
              className="flex w-full snap-center items-baseline justify-center gap-1.5 focus-visible:outline-none"
              style={{ height: ITEM_HEIGHT }}
            >
              <span
                className={cn(
                  "text-3xl tabular-nums transition-colors",
                  selected ? "font-semibold text-brand" : "text-muted",
                )}
              >
                {option}
              </span>
              <span
                className={cn(
                  "text-sm transition-colors",
                  selected ? "text-brand" : "text-muted",
                )}
              >
                分
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
