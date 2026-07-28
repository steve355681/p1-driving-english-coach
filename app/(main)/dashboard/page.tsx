"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { ExpressionWall } from "@/components/dashboard/ExpressionWall";
import { WeeklyChart } from "@/components/dashboard/WeeklyChart";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { PlaceholderNotice } from "@/components/ui/PlaceholderNotice";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useAsync } from "@/hooks/useAsync";
import { loadProgress, loadRecentSessions } from "@/lib/data";
import { practisedMinutes, WEEKS_SHOWN } from "@/lib/progress/summarise";
import { ROUTES } from "@/lib/constants";
import { formatDateZh } from "@/lib/utils";

/**
 * Dashboard (FR-5).
 *
 * Everything here is counted from what happened — minutes actually spoken,
 * mistakes the review flagged more than once, phrases collected. There is no
 * score trend by design; see the Phase 5 decision in docs/07.
 */
export default function DashboardPage() {
  const sessionState = useAsync(() => loadRecentSessions(), []);
  const progressState = useAsync(() => loadProgress(), []);

  const sessions = sessionState.data?.data ?? [];
  const progress = progressState.data?.data ?? null;
  const placeholder = sessionState.data?.placeholder ?? false;
  const error = sessionState.error ?? progressState.error;
  const loading = sessionState.loading || progressState.loading;

  return (
    <>
      <PageHeader title="進度" subtitle="重複使用才看得出變化。" />

      <div className="flex flex-col gap-7">
        {placeholder ? (
          <PlaceholderNotice>尚未連上資料庫</PlaceholderNotice>
        ) : null}

        {error ? (
          <Card className="border-state-error/30 bg-state-error/5">
            <p className="text-sm text-state-error">無法載入紀錄</p>
            <p className="mt-1 text-xs text-muted">{error.message}</p>
          </Card>
        ) : null}

        <section className="grid grid-cols-2 gap-3">
          <Card>
            <p className="text-xs text-muted">實際練習</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {loading ? "—" : (progress?.sessionCount ?? 0)}
              <span className="ml-1 text-sm font-normal text-muted">次</span>
            </p>
          </Card>
          <Card>
            {/* Elapsed time, not the duration picked in the launcher — see
                `practisedMinutes`. A session that never connected counts zero. */}
            <p className="text-xs text-muted">累積開口</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {loading ? "—" : (progress?.practisedMinutes ?? 0)}
              <span className="ml-1 text-sm font-normal text-muted">分</span>
            </p>
          </Card>
        </section>

        <section>
          <SectionHeading
            title="每週練習時間"
            hint={`最近 ${WEEKS_SHOWN} 週`}
          />
          <Card>
            {progress ? (
              <WeeklyChart weeks={progress.weeks} />
            ) : (
              <p className="text-sm text-muted">載入中…</p>
            )}
            <p className="mt-3 text-xs text-muted">
              這裡看的是規律，不是分數 —— 開口的頻率比單次表現更能說明變化。
            </p>
          </Card>
        </section>

        <section>
          <SectionHeading title="最近的練習" />
          {sessionState.loading ? (
            <p className="text-sm text-muted">載入中…</p>
          ) : sessions.length === 0 ? (
            <EmptyState
              title="還沒有練習紀錄"
              description="開始第一次練習，這裡就會有內容。"
              action={<ButtonLink href={ROUTES.launcher}>開始練習</ButtonLink>}
            />
          ) : (
            /* Three fit above the fold; the rest scroll in place rather than
               pushing the recurring-problem and review sections off screen.
               max-h is 3 cards plus a sliver of the fourth, so it reads as
               scrollable without a scrollbar being visible on iOS. */
            <ul className="flex max-h-[15.5rem] flex-col gap-3 overflow-y-auto overscroll-contain pr-1">
              {sessions.map((session) => {
                const minutes = Math.round(practisedMinutes(session));
                return (
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
                        {minutes > 0 ? `${minutes} 分` : "未完成"} ·{" "}
                        {session.level}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <SectionHeading title="重複出現的問題" hint="本週累積" />
          <Card>
            {progress && progress.weekThemes.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {progress.weekThemes.map((theme) => (
                  <li key={theme.type}>
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
                          width: `${(theme.count / progress.weekThemes[0].count) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">本週還沒有回顧抓出的問題。</p>
            )}
            {/* Written from the numbers, not by a model — see `weeklyNote`. */}
            <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-fg">
              {progress ? progress.weekNote : "載入中…"}
            </p>
          </Card>
        </section>

        <section>
          <SectionHeading title="表達牆" hint="依複習節奏亮起" />
          {progress ? (
            <ExpressionWall
              phrases={progress.expressions}
              placeholder={placeholder}
            />
          ) : (
            <p className="text-sm text-muted">載入中…</p>
          )}
        </section>
      </div>
    </>
  );
}
