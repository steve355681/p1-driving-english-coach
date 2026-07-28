"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { SafetyNotice } from "@/components/layout/SafetyNotice";
import { DurationWheel } from "@/components/launcher/DurationWheel";
import { OptionGroup } from "@/components/launcher/OptionGroup";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useAsync } from "@/hooks/useAsync";
import { startSession } from "@/lib/data";
import { listTopics, markTopicUsed } from "@/lib/db/topics";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { cn, toError } from "@/lib/utils";
import type { Topic } from "@/types";
import {
  DEFAULT_DURATION,
  DEFAULT_LEVEL,
  DURATIONS,
  LEVELS,
  ROUTES,
  TOPICS,
} from "@/lib/constants";
import type { EnglishLevel, SessionDuration } from "@/types";

/** Session launcher (FR-1). Creates the session record, then hands off. */
export default function LauncherPage() {
  const router = useRouter();
  const [topic, setTopic] = useState(TOPICS[0].id);
  const [level, setLevel] = useState<EnglishLevel>(DEFAULT_LEVEL);
  const [duration, setDuration] = useState<SessionDuration>(DEFAULT_DURATION);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"saved" | "preset">("preset");
  const [tabPinned, setTabPinned] = useState(false);

  const saved = useAsync(
    async () => (isSupabaseConfigured() ? listTopics() : []),
    [],
  );

  const savedTopics: Topic[] = saved.data ?? [];

  // Land on the learner's own topics when they have any — that is what they
  // came back for. Once they touch the switch, leave it where they put it.
  if (!tabPinned && savedTopics.length > 0 && tab === "preset") {
    setTab("saved");
    setSavedId(savedTopics[0].id);
  }

  function pick(next: "saved" | "preset") {
    setTabPinned(true);
    setTab(next);
  }

  async function start() {
    setStarting(true);
    setError(null);

    try {
      const chosen =
        tab === "saved" ? savedTopics.find((t) => t.id === savedId) : undefined;

      if (tab === "saved" && !chosen) {
        throw new Error("請先選一個主題。");
      }

      const { data } = await startSession({
        topic: chosen?.title ?? TOPICS.find((t) => t.id === topic)?.label ?? topic,
        topicId: chosen?.id ?? null,
        durationMinutes: duration,
        level,
      });

      // Cosmetic counters for the list; never worth failing a start over.
      if (chosen) {
        markTopicUsed(chosen).catch((cause) => {
          console.error("Could not update topic usage", cause);
        });
      }

      router.push(ROUTES.session(data.id));
    } catch (cause) {
      // Stay on this screen: the user is still parked, and retrying is one tap.
      setError(toError(cause).message);
      setStarting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="開始一次練習"
        subtitle="出發前設定好，路上就不用再碰手機。"
      />

      <div className="flex flex-col gap-7">
        <section>
          <SectionHeading title="主題" hint="今天想聊什麼" />

          {isSupabaseConfigured() ? (
            <div
              role="tablist"
              className="mb-3 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface-2 p-1"
            >
              {(
                [
                  ["saved", "我的主題"],
                  ["preset", "預設主題"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  role="tab"
                  type="button"
                  aria-selected={tab === value}
                  onClick={() => pick(value)}
                  className={cn(
                    "min-h-11 rounded-xl text-sm transition-colors",
                    tab === value
                      ? "bg-base font-semibold text-fg"
                      : "text-muted hover:text-fg",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {tab === "preset" ? (
            <OptionGroup
              name="topic"
              value={topic}
              onChange={setTopic}
              options={TOPICS.map((t) => ({
                value: t.id,
                label: t.label,
                hint: t.hint,
              }))}
            />
          ) : saved.loading ? (
            <p className="text-sm text-muted">載入中…</p>
          ) : savedTopics.length === 0 ? (
            <Card>
              <p className="text-sm text-fg">還沒有自訂主題</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                把 NotebookLM 的筆記貼進來，就能圍繞它練習口說。
              </p>
              <ButtonLink
                href={ROUTES.newTopic}
                variant="secondary"
                fullWidth
                className="mt-3"
              >
                + 新增主題
              </ButtonLink>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              <OptionGroup
                name="saved-topic"
                value={savedId ?? savedTopics[0].id}
                onChange={setSavedId}
                options={savedTopics.map((t) => ({
                  value: t.id,
                  label: t.title,
                  hint: t.lastUsedAt
                    ? `練過 ${t.useCount} 次`
                    : "還沒練過",
                }))}
              />
              <ButtonLink
                href={ROUTES.newTopic}
                variant="ghost"
                fullWidth
                className="border border-dashed border-line"
              >
                + 新增主題
              </ButtonLink>
            </div>
          )}
        </section>

        <section>
          <SectionHeading title="程度" hint="會影響語速與提示多寡" />
          <OptionGroup
            name="level"
            value={level}
            onChange={setLevel}
            options={LEVELS.map((l) => ({
              value: l.value,
              label: l.label,
              hint: l.hint,
            }))}
          />
        </section>

        <section>
          <SectionHeading title="長度" hint="通勤大約多久" />
          <DurationWheel
            options={DURATIONS}
            value={duration}
            onChange={setDuration}
          />
        </section>

        <SafetyNotice />

        <div className="flex flex-col gap-2">
          <Button size="lg" fullWidth onClick={start} disabled={starting}>
            {starting ? "建立中…" : "開始練習"}
          </Button>
          {error ? (
            <p className="rounded-xl border border-state-error/30 bg-state-error/5 px-3 py-2 text-center text-xs text-state-error">
              無法建立練習：{error}
            </p>
          ) : (
            <p className="text-center text-xs text-muted">
              語音功能尚未接上，目前只會記錄這次練習的設定與時間。
            </p>
          )}
        </div>
      </div>
    </>
  );
}
