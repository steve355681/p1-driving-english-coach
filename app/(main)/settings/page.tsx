import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { PlaceholderNotice } from "@/components/ui/PlaceholderNotice";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LEVELS } from "@/lib/constants";

/**
 * Preferences and privacy. Nothing here persists yet — it lands with the data
 * layer in Phase 2 and the auth decision in Phase 7.
 */
export default function SettingsPage() {
  return (
    <>
      <PageHeader title="設定" subtitle="偏好與隱私說明。" />

      <div className="flex flex-col gap-7">
        <PlaceholderNotice>設定尚未儲存（Phase 2）</PlaceholderNotice>

        <section>
          <SectionHeading title="預設程度" />
          <Card>
            <ul className="flex flex-col gap-3">
              {LEVELS.map((level) => (
                <li key={level.value} className="flex flex-col">
                  <span className="text-sm text-fg">{level.label}</span>
                  <span className="text-xs text-muted">{level.hint}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section>
          <SectionHeading title="帳號" />
          <Card>
            <p className="text-sm text-fg">目前為匿名試用模式</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              紀錄只綁在這個瀏覽器上。登入功能會在之後加入，屆時可以把既有紀錄接過去。
            </p>
          </Card>
        </section>

        <section>
          <SectionHeading title="隱私" />
          <Card>
            <ul className="flex flex-col gap-2 text-xs leading-relaxed text-muted">
              <li>· 練習過程會產生逐字稿，用來產生回顧內容。</li>
              <li>· 原始錄音是否保留尚未定案，目前不保留。</li>
              <li>· 你可以隨時刪除單次練習紀錄（功能開發中）。</li>
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
