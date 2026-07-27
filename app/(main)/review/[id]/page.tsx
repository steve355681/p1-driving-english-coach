import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PlaceholderNotice } from "@/components/ui/PlaceholderNotice";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ROUTES } from "@/lib/constants";
import { placeholderReview } from "@/lib/placeholder-data";

const SEVERITY_TONE = {
  high: "warn",
  medium: "neutral",
  low: "neutral",
} as const;

/**
 * Post-session review (FR-4). Compact on purpose: 3 corrections, a few better
 * phrasings, 5 words. Real generation is Phase 5.
 */
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const review = placeholderReview;

  return (
    <>
      <PageHeader title="這次練習的回顧" subtitle={review.title} />

      <div className="flex flex-col gap-7">
        <PlaceholderNotice>
          回顧內容尚未由 AI 產生（Phase 5）
        </PlaceholderNotice>

        <section>
          <SectionHeading title="重點摘要" />
          <Card>
            <p className="text-sm leading-relaxed text-muted">
              {review.summary}
            </p>
          </Card>
        </section>

        <section>
          <SectionHeading title="最該修的 3 句" hint="只列最有價值的" />
          <div className="flex flex-col gap-3">
            {review.corrections.map((item) => (
              <Card key={item.id}>
                <div className="mb-2 flex items-center gap-2">
                  <Badge tone={SEVERITY_TONE[item.severity]}>{item.type}</Badge>
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

        <section>
          <SectionHeading title="值得記住的字詞" />
          <div className="flex flex-col gap-3">
            {review.vocabulary.map((item) => (
              <Card key={item.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold">{item.phrase}</p>
                  <p className="text-xs text-muted">{item.meaningZh}</p>
                </div>
                <p className="mt-1.5 text-xs text-muted">{item.exampleEn}</p>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading title="下次練什麼" />
          <Card className="border-brand/30 bg-brand/5">
            <p className="text-sm leading-relaxed text-fg">
              {review.nextRecommendation}
            </p>
          </Card>
        </section>

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
          <p className="text-center text-xs text-muted">session id: {id}</p>
        </div>
      </div>
    </>
  );
}
