import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { PlaceholderNotice } from "@/components/ui/PlaceholderNotice";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ROUTES } from "@/lib/constants";
import {
  placeholderErrorThemes,
  placeholderReview,
  placeholderSessions,
} from "@/lib/placeholder-data";
import { formatDateZh } from "@/lib/utils";

/**
 * Dashboard (FR-5). Phase 1 renders the shape only; real aggregation is
 * Phase 6. Scores stay coarse on purpose — see `docs/07`, open question 3.
 */
export default function DashboardPage() {
  const sessions = placeholderSessions;
  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const maxThemeCount = Math.max(
    ...placeholderErrorThemes.map((theme) => theme.count),
  );

  return (
    <>
      <PageHeader title="進度" subtitle="重複使用才看得出變化。" />

      <div className="flex flex-col gap-7">
        <PlaceholderNotice>資料尚未接上資料庫（Phase 2 / 6）</PlaceholderNotice>

        <section className="grid grid-cols-2 gap-3">
          <Card>
            <p className="text-xs text-muted">累積練習</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {sessions.length}
              <span className="ml-1 text-sm font-normal text-muted">次</span>
            </p>
          </Card>
          <Card>
            <p className="text-xs text-muted">累積時間</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {totalMinutes}
              <span className="ml-1 text-sm font-normal text-muted">分</span>
            </p>
          </Card>
        </section>

        <section>
          <SectionHeading title="最近的練習" />
          {sessions.length === 0 ? (
            <EmptyState
              title="還沒有練習紀錄"
              description="開始第一次練習，這裡就會有內容。"
              action={<ButtonLink href={ROUTES.launcher}>開始練習</ButtonLink>}
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {sessions.map((session) => (
                <li key={session.id}>
                  <Link
                    href={ROUTES.review(session.id)}
                    className="block rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-surface-2"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium">{session.topic}</p>
                      <p className="text-xs text-muted">
                        {formatDateZh(session.startedAt)}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {session.durationMinutes} 分 · {session.level}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionHeading title="重複出現的問題" hint="跨場次累積" />
          <Card>
            <ul className="flex flex-col gap-3">
              {placeholderErrorThemes.map((theme) => (
                <li key={theme.label}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-fg">{theme.label}</span>
                    <span className="text-muted tabular-nums">
                      {theme.count}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{
                        width: `${(theme.count / maxThemeCount) * 100}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section>
          <SectionHeading title="表達牆" hint="練習中出現過、值得留著的說法" />
          <div className="flex flex-wrap gap-2">
            {placeholderReview.vocabulary.map((item) => (
              <span
                key={item.id}
                className="rounded-xl border border-line bg-surface px-3 py-2 text-xs"
              >
                {item.phrase}
              </span>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
