import { LiveSessionScreen } from "@/components/session/LiveSessionScreen";

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
