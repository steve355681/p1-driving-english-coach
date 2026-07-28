"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useAsync } from "@/hooks/useAsync";
import {
  createTopic,
  getTopic,
  updateTopic,
  deleteTopic,
} from "@/lib/db/topics";
import { startSession } from "@/lib/data";
import { getAccessToken } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  DEFAULT_DURATION,
  DEFAULT_LEVEL,
  ROUTES,
  TOPIC_CONDENSE_THRESHOLD,
  TOPIC_NOTES_MAX,
} from "@/lib/constants";
import { cn, toError } from "@/lib/utils";

/**
 * Create or edit a saved topic.
 *
 * The length readout is live because going over the threshold costs a model
 * call. Saying so while the notes are being pasted is more use than explaining
 * it afterwards.
 */
export function TopicEditor({ topicId }: { topicId?: string }) {
  const router = useRouter();
  const editing = Boolean(topicId);

  const existing = useAsync(
    async () => (topicId ? getTopic(topicId) : null),
    [topicId],
  );

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "start" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Seed the fields once the existing topic arrives.
  if (existing.data && existing.data.id !== loadedId) {
    setLoadedId(existing.data.id);
    setTitle(existing.data.title);
    setNotes(existing.data.notes);
  }

  const length = notes.trim().length;
  const overThreshold = length > TOPIC_CONDENSE_THRESHOLD;
  const overMax = length > TOPIC_NOTES_MAX;
  const canSave = length > 0 && !overMax && !busy;

  async function condense(): Promise<string | null> {
    if (!overThreshold) return null;

    const accessToken = await getAccessToken();
    const response = await fetch("/api/topics/condense", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes }),
    });

    const payload = (await response.json()) as {
      brief?: string | null;
      error?: string;
    };
    if (!response.ok) throw new Error(payload.error ?? "無法整理筆記。");
    return payload.brief ?? null;
  }

  async function save(thenStart: boolean) {
    setBusy(thenStart ? "start" : "save");
    setError(null);

    try {
      const brief = await condense();
      // An empty title is filled from the first line rather than rejected —
      // the notes are the point, the title is a label for a list.
      const finalTitle =
        title.trim() || notes.trim().split("\n")[0].slice(0, 60);

      const topic = editing
        ? await updateTopic(topicId!, { title: finalTitle, notes, brief })
        : await createTopic({ title: finalTitle, notes, brief });

      if (!thenStart) {
        router.push(ROUTES.topics);
        return;
      }

      const { data: session } = await startSession({
        topic: topic.title,
        topicId: topic.id,
        durationMinutes: DEFAULT_DURATION,
        level: DEFAULT_LEVEL,
      });
      router.push(ROUTES.session(session.id));
    } catch (cause) {
      setError(toError(cause).message);
      setBusy(null);
    }
  }

  async function remove() {
    if (!topicId) return;
    setBusy("delete");
    setError(null);
    try {
      await deleteTopic(topicId);
      router.push(ROUTES.topics);
    } catch (cause) {
      setError(toError(cause).message);
      setBusy(null);
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <>
        <PageHeader title="新增主題" backHref={ROUTES.topics} />
        <p className="text-sm text-muted">
          尚未連上資料庫，無法儲存主題。
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={editing ? "編輯主題" : "新增主題"}
        backHref={ROUTES.topics}
      />

      <div className="flex flex-col gap-7">
        <section>
          <SectionHeading title="標題" hint="留白的話，用筆記的第一行" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：AI 如何改變就業市場"
            maxLength={120}
            className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
        </section>

        <section>
          <SectionHeading
            title="筆記"
            hint="貼上 NotebookLM 的筆記，或任何你想聊的材料"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={10}
            placeholder="貼上內容…"
            className="w-full rounded-xl border border-line bg-surface-2 p-3 text-sm leading-relaxed text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
          <div className="mt-2 flex justify-between text-xs">
            <span className="text-muted tabular-nums">
              {length.toLocaleString()} 字
            </span>
            <span
              className={cn(
                overMax
                  ? "text-state-error"
                  : overThreshold
                    ? "text-state-paused"
                    : "text-muted",
              )}
            >
              {overMax
                ? `超過上限 ${TOPIC_NOTES_MAX.toLocaleString()} 字`
                : overThreshold
                  ? "儲存時會自動濃縮一次"
                  : "長度剛好，會原樣使用"}
            </span>
          </div>
        </section>

        {error ? (
          <p className="rounded-xl border border-state-error/30 bg-state-error/5 px-3 py-2 text-xs text-state-error">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            fullWidth
            disabled={!canSave}
            onClick={() => save(true)}
          >
            {busy === "start" ? "準備中…" : "儲存並開始練習"}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            fullWidth
            disabled={!canSave}
            onClick={() => save(false)}
          >
            {busy === "save" ? "儲存中…" : "只儲存"}
          </Button>
          {editing ? (
            <Button
              size="md"
              variant="ghost"
              fullWidth
              disabled={Boolean(busy)}
              onClick={remove}
            >
              {busy === "delete" ? "刪除中…" : "刪除這個主題"}
            </Button>
          ) : null}
        </div>

        <p className="text-center text-xs text-muted">
          刪除主題不會影響已經完成的練習紀錄。
        </p>
      </div>
    </>
  );
}
