/**
 * Marks any screen still rendering `lib/placeholder-data.ts`. Being explicit
 * about what is not wired up yet keeps the demo honest.
 */
export function PlaceholderNotice({ children }: { children: string }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted">
      示範資料 · {children}
    </p>
  );
}
