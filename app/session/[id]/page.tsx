import { SessionLoader } from "@/components/session/SessionLoader";

/**
 * Driving mode lives outside the `(main)` route group so it never picks up the
 * bottom nav or any other chrome.
 *
 * Any id is valid: sessions are created with real UUIDs. The record is loaded
 * in the browser because the anonymous auth session lives there — a server
 * component has no user to read rows as.
 */
export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto w-full max-w-md">
      <SessionLoader sessionId={id} />
    </main>
  );
}
