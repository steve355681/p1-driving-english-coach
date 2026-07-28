import { MobileShell } from "@/components/layout/MobileShell";
import { SafetyNotice } from "@/components/layout/SafetyNotice";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ROUTES } from "@/lib/constants";

const MODES = [
  {
    phase: "出發前",
    title: "30 秒完成設定",
    body: "選主題、選程度、選 10 / 15 / 20 分鐘，然後按開始。",
  },
  {
    phase: "行進間",
    title: "只用聲音對話",
    body: "螢幕只顯示狀態和兩個大按鈕。不需要閱讀，也不需要打字。",
  },
  {
    phase: "抵達後",
    title: "看得完的回顧",
    body: "重點修正 3 條、更好的說法幾句、值得記的字詞 5 個。",
  },
];

export default function LandingPage() {
  return (
    <MobileShell className="gap-10 pb-16">
      <section className="pt-safe pt-16">
        <Badge tone="brand">Mobile-first · 通勤英文口說</Badge>
        <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight">
          把通勤時間
          <br />
          變成英文口說練習
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          P1 Driving English Coach 是一個手機優先的 AI
          英文口說教練。出發前設定，行進間只用聲音對話，抵達後給你一份看得完的回顧。
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <ButtonLink href={ROUTES.launcher} size="lg" fullWidth>
            試用 Demo
          </ButtonLink>
          <ButtonLink
            href={ROUTES.dashboard}
            size="lg"
            variant="secondary"
            fullWidth
          >
            看看進度頁長什麼樣
          </ButtonLink>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">怎麼運作</h2>
        <div className="flex flex-col gap-3">
          {MODES.map((mode) => (
            <Card key={mode.phase}>
              <p className="text-xs font-medium text-brand">{mode.phase}</p>
              <p className="mt-1.5 text-sm font-semibold">{mode.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {mode.body}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">這個產品不做什麼</h2>
        <Card>
          <ul className="space-y-2 text-xs leading-relaxed text-muted">
            <li>· 不做鎖定畫面上的完整操作</li>
            <li>· 不依賴語音喚醒字</li>
            <li>· 不做 CarPlay / Android Auto 深度整合</li>
            <li>· MVP 階段是網頁 App，不是原生 App</li>
          </ul>
          <p className="mt-3 text-xs text-muted">
            這些限制是刻意的：先把「出發前開始、行進間低互動、抵達後回顧」這條路徑做紮實。
          </p>
        </Card>
      </section>

      <section>
        <SafetyNotice />
      </section>

      <footer className="border-t border-line pt-6 text-xs leading-relaxed text-muted">
        <p>
          語音對話、逐字稿、AI 回顧與進度統計都已經接上。試用帳號每天可以練習
          一次、每次 3 分鐘。
        </p>
        <p className="mt-2">
          練習過程只保留逐字稿，不保留錄音。完整規格與實作決策放在 repo 的
          docs/ 目錄。
        </p>
      </footer>
    </MobileShell>
  );
}
