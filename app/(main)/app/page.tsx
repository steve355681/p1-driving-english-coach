"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SafetyNotice } from "@/components/layout/SafetyNotice";
import { DurationWheel } from "@/components/launcher/DurationWheel";
import { OptionGroup } from "@/components/launcher/OptionGroup";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  DEFAULT_DURATION,
  DURATIONS,
  LEVELS,
  ROUTES,
  TOPICS,
} from "@/lib/constants";
import type { EnglishLevel, SessionDuration } from "@/types";

/**
 * Session launcher (FR-1). Phase 1 keeps the selection in local state only —
 * creating the session record and persisting the choices lands in Phase 3.
 */
export default function LauncherPage() {
  const [topic, setTopic] = useState(TOPICS[0].id);
  const [level, setLevel] = useState<EnglishLevel>("intermediate");
  const [duration, setDuration] = useState<SessionDuration>(DEFAULT_DURATION);

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
          <ButtonLink
            href={ROUTES.session("demo")}
            size="lg"
            fullWidth
            aria-label="開始練習"
          >
            開始練習
          </ButtonLink>
          <p className="text-center text-xs text-muted">
            語音功能尚未接上，目前會進入練習畫面的骨架。
          </p>
        </div>
      </div>
    </>
  );
}
