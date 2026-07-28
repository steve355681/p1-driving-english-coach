import { ButtonLink } from "@/components/ui/Button";
import { MobileShell } from "@/components/layout/MobileShell";
import { ROUTES } from "@/lib/constants";

/**
 * 404.
 *
 * The realistic way to land here is a bookmarked review of a session that has
 * since been deleted, so the copy says that rather than "page not found".
 */
export default function NotFound() {
  return (
    <MobileShell className="justify-center gap-6 pb-16">
      <div>
        <h1 className="text-xl font-semibold">找不到這個頁面</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          網址可能打錯了，或這次練習已經被刪除。
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <ButtonLink href={ROUTES.launcher} size="lg" fullWidth>
          開始練習
        </ButtonLink>
        <ButtonLink
          href={ROUTES.dashboard}
          size="lg"
          variant="secondary"
          fullWidth
        >
          查看進度
        </ButtonLink>
      </div>
    </MobileShell>
  );
}
