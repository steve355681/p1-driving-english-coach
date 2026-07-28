"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlaceholderNotice } from "@/components/ui/PlaceholderNotice";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useAsync } from "@/hooks/useAsync";
import { loadReview } from "@/lib/data";
import { ReviewUnavailableError, requestReview } from "@/lib/review/request";
import { ROUTES } from "@/lib/constants";
import { toError } from "@/lib/utils";

const SEVERITY_TONE = {
  high: "warn",
  medium: "neutral",
  low: "neutral",
} as const;

/**
 * Post-session review (FR-4). Compact on purpose: 3 corrections, a few better
 * phrasings, 5 words.
 *
 * The review does not exist when the drive ends — it is generated the first
 * time this page is opened. That keeps the driver off a spinner at the end of a
 * session, and means a session nobody ever reviews costs nothing to run.
 */
export function ReviewScreen({ sessionId }: { sessionId: string }) {
  // Bumped after generation to re-read the review through the same path that
  // loaded it, so freshly generated and already-saved reviews render
  // identically rather than through two code paths that can drift.
  const [reload, setReload] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<Error | null>(null);
  // One automatic attempt per session. Without this a failure that leaves the
  // review empty would retry on every render, against a metered API.
  const attempted = useRef<string | null>(null);

  const { data, error, loading } = useAsync(
    () => loadReview(sessionId),
    [sessionId, reload],
  );

  const review = data?.data ?? null;
  const needsGenerating =
    !!review &&
    data?.placeholder === false &&
    review.transcriptTurns > 0 &&
    !review.summary &&
    review.corrections.length === 0 &&
    review.vocabulary.length === 0;

  async function generate() {
    setGenerating(true);
    setGenError(null);
    try {
      await requestReview(sessionId);
      setReload((value) => value + 1);
    } catch (cause) {
      setGenError(toError(cause));
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    if (!needsGenerating || attempted.current === sessionId) return;
    attempted.current = sessionId;
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsGenerating, sessionId]);

  if (loading) {
    return (
      <>
        <PageHeader title="這次練習的回顧" />
        <p className="text-sm text-muted">載入中…</p>
      </>
    );
  }

  if (error || !review) {
    return (
      <>
        <PageHeader title="這次練習的回顧" backHref={ROUTES.dashboard} />
        <EmptyState
          title={error ? "無法載入回顧" : "找不到這次練習"}
          description={error?.message ?? "它可能已經被刪除了。"}
          action={<ButtonLink href={ROUTES.launcher}>開始新的練習</ButtonLink>}
        />
      </>
    );
  }

  const placeholder = data?.placeholder ?? false;
  const isEmpty =
    !review.summary &&
    review.corrections.length === 0 &&
    review.vocabulary.length === 0;

  return (
    <>
      <PageHeader title="這次練習的回顧" subtitle={review.title} />

      <div className="flex flex-col gap-7">
        {placeholder ? (
          <PlaceholderNotice>不是你的練習內容</PlaceholderNotice>
        ) : null}

        {isEmpty ? (
          generating ? (
            <EmptyState
              title="正在整理這次的回顧…"
              description={`讀完 ${review.transcriptTurns} 段對話大約需要幾秒鐘。`}
            />
          ) : genError ? (
            <EmptyState
              title="這次沒有產生回顧"
              description={genError.message}
              action={
                // A refusal does not get better by retrying — offering the
                // button anyway would just be a second way to be told no.
                genError instanceof ReviewUnavailableError ? undefined : (
                  <Button onClick={generate}>再試一次</Button>
                )
              }
            />
          ) : (
            <EmptyState
              title="這次練習還沒有回顧內容"
              description={
                review.transcriptTurns > 0
                  ? `對話已經記錄下來了（${review.transcriptTurns} 段），但還沒整理成回顧。`
                  : "這次沒有錄到對話內容，所以沒有東西可以回顧。"
              }
              action={
                review.transcriptTurns > 0 && !placeholder ? (
                  <Button onClick={generate}>產生回顧</Button>
                ) : undefined
              }
            />
          )
        ) : (
          <>
            {review.summary ? (
              <section>
                <SectionHeading title="重點摘要" />
                <Card>
                  <p className="text-sm leading-relaxed text-muted">
                    {review.summary}
                  </p>
                </Card>
              </section>
            ) : null}

            {review.corrections.length > 0 ? (
              <section>
                <SectionHeading title="最該修的 3 句" hint="只列最有價值的" />
                <div className="flex flex-col gap-3">
                  {review.corrections.map((item) => (
                    <Card key={item.id}>
                      <div className="mb-2 flex items-center gap-2">
                        <Badge tone={SEVERITY_TONE[item.severity]}>
                          {item.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-state-error line-through decoration-state-error/40">
                        {item.originalText}
                      </p>
                      <p className="mt-1.5 text-sm font-medium text-brand">
                        {item.improvedText}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-muted">
                        {item.explanation}
                      </p>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}

            {review.alternatives.length > 0 ? (
              <section>
                <SectionHeading title="更好的說法" />
                <Card>
                  <ul className="flex flex-col gap-2.5">
                    {review.alternatives.map((line) => (
                      <li key={line} className="text-sm text-fg">
                        {line}
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            ) : null}

            {review.vocabulary.length > 0 ? (
              <section>
                <SectionHeading title="值得記住的字詞" />
                <div className="flex flex-col gap-3">
                  {review.vocabulary.map((item) => (
                    <Card key={item.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-semibold">{item.phrase}</p>
                        <p className="text-xs text-muted">{item.meaningZh}</p>
                      </div>
                      <p className="mt-1.5 text-xs text-muted">
                        {item.exampleEn}
                      </p>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}

            {review.nextRecommendation ? (
              <section>
                <SectionHeading title="下次練什麼" />
                <Card className="border-brand/30 bg-brand/5">
                  <p className="text-sm leading-relaxed text-fg">
                    {review.nextRecommendation}
                  </p>
                </Card>
              </section>
            ) : null}
          </>
        )}

        <div className="flex flex-col gap-2">
          <ButtonLink href={ROUTES.launcher} size="lg" fullWidth>
            再練一次
          </ButtonLink>
          <ButtonLink
            href={ROUTES.dashboard}
            size="lg"
            variant="secondary"
            fullWidth
          >
            查看整體進度
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
