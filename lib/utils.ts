/** Tiny classname joiner. Avoids pulling in clsx for a one-liner. */
export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

/** Seconds -> `M:SS`, for the live session timer. */
export function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** ISO date -> `M月D日`. Deterministic so server and client render the same. */
export function formatDateZh(iso: string) {
  const date = new Date(iso);
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}
