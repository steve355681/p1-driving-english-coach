"use client";

import { LiveSessionScreen } from "@/components/session/LiveSessionScreen";
import { ButtonLink } from "@/components/ui/Button";
import { useAsync } from "@/hooks/useAsync";
import { loadSession } from "@/lib/data";
import { ROUTES } from "@/lib/constants";

/** Full-screen message, styled for driving mode: large, centred, no chrome. */
function Notice({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-8 text-center">
      <p className="text-xl">{children}</p>
      {action}
    </div>
  );
}

export function SessionLoader({ sessionId }: { sessionId: string }) {
  const { data, error, loading } = useAsync(
    () => loadSession(sessionId),
    [sessionId],
  );

  if (loading) return <Notice>準備中…</Notice>;

  if (error) {
    return (
      <Notice
        action={
          <ButtonLink href={ROUTES.launcher} size="lg">
            回到設定
          </ButtonLink>
        }
      >
        無法載入這次練習
        <span className="mt-2 block text-sm text-muted">{error.message}</span>
      </Notice>
    );
  }

  if (!data?.data) {
    return (
      <Notice
        action={
          <ButtonLink href={ROUTES.launcher} size="lg">
            開始新的練習
          </ButtonLink>
        }
      >
        找不到這次練習
      </Notice>
    );
  }

  return (
    <LiveSessionScreen session={data.data} placeholder={data.placeholder} />
  );
}
