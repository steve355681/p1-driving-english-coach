"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { ExpressionWall } from "@/components/dashboard/ExpressionWall";
import { SessionList } from "@/components/dashboard/SessionList";
import { WeeklyChart } from "@/components/dashboard/WeeklyChart";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { PlaceholderNotice } from "@/components/ui/PlaceholderNotice";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useState } from "react";
import { useAsync } from "@/hooks/useAsync";
import { loadProgress, loadRecentSessions } from "@/lib/data";
import { WEEKS_SHOWN } from "@/lib/progress/summarise";
import { ROUTES } from "@/lib/constants";

/**
 * Dashboard (FR-5).
 *
 * Everything here is counted from what happened — minutes actually spoken,
 * mistakes the review flagged more than once, phrases collected. There is no
 * score trend by design; see the Phase 5 decision in docs/07.
 */
export default function DashboardPage() {
  // Bumped after a deletion. Both reads share it so the totals, the chart and
  // the wall cannot keep counting a session the list no longer shows.
  const [reload, setReload] = useState(0);
  const sessionState = useAsync(() => loadRecentSessions(), [reload]);
  const progressState = useAsync(() => loadProgress(), [reload]);

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

        {sessions.length === 0 && !sessionState.loading ? (
          <section>
            <SectionHeading title="最近的練習" />
            <EmptyState
              title="還沒有練習紀錄"
              description="開始第一次練習，這裡就會有內容。"
              action={<ButtonLink href={ROUTES.launcher}>開始練習</ButtonLink>}
            />
          </section>
        ) : (
          <SessionList
            sessions={sessions}
            loading={sessionState.loading}
            placeholder={placeholder}
            onDeleted={() => setReload((value) => value + 1)}
          />
        )}

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
