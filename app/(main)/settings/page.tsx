import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { AccountPanel } from "@/components/settings/AccountPanel";
import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ROUTES } from "@/lib/constants";

/**
 * Preferences and privacy.
 *
 * There is no default-level setting. The level is picked per session in the
 * launcher, where it is about to be used and where changing it costs one tap —
 * a second copy in settings only added a place for the two to disagree.
 * `user_profiles.english_level` stays in the schema for a future path that
 * needs a stored preference.
 */
export default function SettingsPage() {
  return (
    <>
      <PageHeader title="設定" subtitle="偏好與隱私說明。" />

      <div className="flex flex-col gap-7">
        <section>
          <SectionHeading title="主題" />
          <Link
            href={ROUTES.topics}
            className="flex min-h-14 items-center justify-between rounded-2xl border border-line bg-surface px-4 transition-colors hover:bg-surface-2"
          >
            <span className="text-sm text-fg">我的主題</span>
            <span className="text-sm text-muted">→</span>
          </Link>
          <p className="mt-1.5 text-xs text-muted">
            管理貼上的筆記，可以重複用來練習。
          </p>
        </section>

        <section>
          <SectionHeading title="帳號" />
          <AccountPanel />
        </section>

        <section>
          <SectionHeading title="隱私" />
          <Card>
            <ul className="flex flex-col gap-2 text-xs leading-relaxed text-muted">
              <li>· 練習過程會產生逐字稿，用來產生回顧內容。</li>
              <li>· 原始錄音是否保留尚未定案，目前不保留。</li>
              <li>· 你可以隨時刪除練習紀錄：在「進度」頁長按任一筆，即可單選或複選後刪除。</li>
              <li>· 刪除會一併移除該次的逐字稿、修正建議與字詞，且無法復原。</li>
            </ul>
          </Card>
        </section>

        <section>
          <SectionHeading title="關於" />
          <Card>
            <p className="text-xs leading-relaxed text-muted">
              P1 Driving English Coach 是一個開發中的作品集專案。完整產品規格與實作階段規劃放在
              repo 的 docs/ 目錄。
            </p>
          </Card>
        </section>
      </div>
    </>
  );
}
