"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAsync } from "@/hooks/useAsync";
import { listTopics } from "@/lib/db/topics";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ROUTES } from "@/lib/constants";
import { formatDateZh } from "@/lib/utils";
import type { Topic } from "@/types";

export function topicSubtitle(topic: Topic) {
  if (!topic.lastUsedAt) return `還沒練過 · 建立於 ${formatDateZh(topic.createdAt)}`;
  return `練過 ${topic.useCount} 次 · 最近 ${formatDateZh(topic.lastUsedAt)}`;
}

export function TopicList() {
  const { data, error, loading } = useAsync(
    async () => (isSupabaseConfigured() ? listTopics() : []),
    [],
  );

  return (
    <>
      <PageHeader
        title="我的主題"
        subtitle="貼上的筆記會留在這裡，可以重複練習。"
        backHref={ROUTES.settings}
      />

      <div className="flex flex-col gap-4">
        {!isSupabaseConfigured() ? (
          <Card>
            <p className="text-sm text-fg">尚未連上資料庫</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              這份程式碼沒有設定 Supabase，所以無法儲存主題。
            </p>
          </Card>
        ) : error ? (
          <Card className="border-state-error/30 bg-state-error/5">
            <p className="text-sm text-state-error">無法載入主題</p>
            <p className="mt-1 text-xs text-muted">{error.message}</p>
          </Card>
        ) : loading ? (
          <p className="text-sm text-muted">載入中…</p>
        ) : data && data.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {data.map((topic) => (
              <li key={topic.id}>
                <Link
                  href={ROUTES.editTopic(topic.id)}
                  className="block rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-surface-2"
                >
                  <p className="text-sm font-medium">{topic.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {topicSubtitle(topic)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="還沒有自訂主題"
            description="把 NotebookLM 的筆記貼進來，就能圍繞它練習口說。"
          />
        )}

        {isSupabaseConfigured() ? (
          <ButtonLink href={ROUTES.newTopic} size="lg" fullWidth>
            + 新增主題
          </ButtonLink>
        ) : null}
      </div>
    </>
  );
}
