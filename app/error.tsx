"use client";

import { useEffect } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { MobileShell } from "@/components/layout/MobileShell";
import { ROUTES } from "@/lib/constants";

/**
 * Last resort for an unhandled client error.
 *
 * Next's default error page is untranslated, light-themed and mentions the
 * stack — on a phone mounted in a car that is worse than useless. Screens have
 * their own error states for failures they expect; this one exists for the
 * failures they do not.
 *
 * The message is deliberately not shown. It comes from wherever the crash was
 * and is written for whoever wrote that code, not for someone at the roadside.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error", error);
  }, [error]);

  return (
    <MobileShell className="justify-center gap-6 pb-16">
      <div>
        <h1 className="text-xl font-semibold">出了一點問題</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          這一頁沒能正常載入。你的練習紀錄不會因為這個畫面而遺失。
        </p>
        {/* The digest is the only thing that ties this screen to a server log,
            so it is worth the small amount of noise it adds. */}
        {error.digest ? (
          <p className="mt-3 text-xs text-muted">錯誤代碼：{error.digest}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-brand px-6 text-base font-medium text-base transition-colors hover:bg-brand-strong"
        >
          重新載入
        </button>
        <ButtonLink href={ROUTES.launcher} size="lg" variant="secondary" fullWidth>
          回到首頁
        </ButtonLink>
      </div>
    </MobileShell>
  );
}
