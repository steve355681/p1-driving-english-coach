"use client";

import { useEffect, useState } from "react";
import { toError } from "@/lib/utils";

export interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

/**
 * Runs an async load once per change of `deps` and tracks loading/error state.
 *
 * Supabase is browser-only here — the anonymous auth session lives in the
 * browser, so a server component has no user context to read rows as. That
 * makes client-side fetching the correct shape for these screens, not a
 * shortcut.
 */
export function useAsync<T>(
  load: () => Promise<T>,
  deps: unknown[],
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, error: null, loading: true });

    load()
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setState({ data: null, error: toError(cause), loading: false });
      });

    return () => {
      cancelled = true;
    };
    // `load` is intentionally not a dependency: callers pass an inline closure,
    // which would be a new function every render and re-fetch forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
