"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { SafetyNotice } from "@/components/layout/SafetyNotice";
import { DurationWheel } from "@/components/launcher/DurationWheel";
import { OptionGroup } from "@/components/launcher/OptionGroup";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { startSession } from "@/lib/data";
import { toError } from "@/lib/utils";
import {
  DEFAULT_DURATION,
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
  const [level, setLevel] = useState<EnglishLevel>("intermediate");
  const [duration, setDuration] = useState<SessionDuration>(DEFAULT_DURATION);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setStarting(true);
    setError(null);

    try {
      const label = TOPICS.find((t) => t.id === topic)?.label ?? topic;
      const { data } = await startSession({
        topic: label,
        durationMinutes: duration,
        level,
      });
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
