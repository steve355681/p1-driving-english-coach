/**
 * Normalises anything thrown into an Error.
 *
 * Supabase rejects with a plain object (`{ message, code, details, hint }`),
 * not an Error instance, so the obvious `String(cause)` renders the useful part
 * as "[object Object]" and the user is told nothing.
 */
export function toError(cause: unknown): Error {
  if (cause instanceof Error) return cause;

  if (cause && typeof cause === "object" && "message" in cause) {
    const { message, code } = cause as { message?: unknown; code?: unknown };
    if (typeof message === "string" && message) {
      // Postgres error codes are worth surfacing; Supabase leaves the field an
      // empty string for network failures, which would render as "message ()".
      const suffix = typeof code === "string" && code ? ` (${code})` : "";
      return new Error(message + suffix);
    }
  }

  return new Error(String(cause));
}

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
