"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { PlaceholderNotice } from "@/components/ui/PlaceholderNotice";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useAsync } from "@/hooks/useAsync";
import { loadRecentSessions } from "@/lib/data";
import { ROUTES } from "@/lib/constants";
import {
  placeholderErrorThemes,
  placeholderReview,
} from "@/lib/placeholder-data";
import { formatDateZh } from "@/lib/utils";

/**
 * Dashboard (FR-5).
 *
 * Session history is real. Recurring themes and the expression wall are
 * derived from review content, which Phase 5 generates and Phase 6 aggregates —
 * so against a real database they show empty states rather than fixtures.
 */
export default function DashboardPage() {
  const { data, error, loading } = useAsync(() => loadRecentSessions(), []);

  const sessions = data?.data ?? [];
  const placeholder = data?.placeholder ?? false;
  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);

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
            <p className="text-xs text-muted">累積練習</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {loading ? "—" : sessions.length}
              <span className="ml-1 text-sm font-normal text-muted">次</span>
            </p>
          </Card>
          <Card>
            <p className="text-xs text-muted">累積時間</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {loading ? "—" : totalMinutes}
              <span className="ml-1 text-sm font-normal text-muted">分</span>
            </p>
          </Card>
        </section>

        <section>
          <SectionHeading title="最近的練習" />
          {loading ? (
            <p className="text-sm text-muted">載入中…</p>
          ) : sessions.length === 0 ? (
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
          {placeholder ? (
            <Card>
              <ul className="flex flex-col gap-3">
                {placeholderErrorThemes.map((theme) => {
                  const max = Math.max(
                    ...placeholderErrorThemes.map((t) => t.count),
                  );
                  return (
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
                          style={{ width: `${(theme.count / max) * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : (
            <EmptyState
              title="還沒有足夠資料"
              description="等練習有了 AI 回顧之後，這裡會統計你最常犯的錯誤類型。"
            />
          )}
        </section>

        <section>
          <SectionHeading title="表達牆" hint="練習中出現過、值得留著的說法" />
          {placeholder ? (
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
          ) : (
            <EmptyState
              title="還沒有收集到說法"
              description="每次練習的回顧會挑出值得記住的字詞，累積在這裡。"
            />
          )}
        </section>
      </div>
    </>
  );
}
