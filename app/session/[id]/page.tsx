import { LiveSessionScreen } from "@/components/session/LiveSessionScreen";

/**
 * A static export can only ship paths known at build time, so the id is pinned
 * to the demo session. Next requires this flag to be a literal, so it applies
 * to every build, not just the Pages one — flip it to `true` in Phase 3 when
 * sessions become real records with unpredictable ids.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: "demo" }];
}

/**
 * Driving mode lives outside the `(main)` route group so it never picks up the
 * bottom nav or any other chrome.
 */
export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto w-full max-w-md">
      <LiveSessionScreen sessionId={id} />
    </main>
  );
}
