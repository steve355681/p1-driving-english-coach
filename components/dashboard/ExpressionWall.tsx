"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { markPhraseReviewed } from "@/lib/db/vocabulary";
import {
  REVIEW_INTERVALS_DAYS,
  REVIEW_STAGES,
  type WallPhrase,
} from "@/lib/progress/rhythm";
import { ROUTES } from "@/lib/constants";
import { formatDateZh, toError } from "@/lib/utils";

/**
 * The expression wall, on a spaced-review rhythm.
 *
 * A phrase due for recall is tinted; the tint says which interval it is in.
 * Tapping it means "I remembered this", which advances it to the next interval
 * and returns it to the plain surface until that interval elapses. After the
 * last interval it leaves the wall — the point is to empty, not to accumulate.
 *
 * Every chip is tappable, but a phrase still inside its interval only reveals
 * when it next comes round — it does not advance. Someone browsing the wall
 * out of curiosity must not be able to burn a phrase off it: six curious taps
 * would otherwise run a phrase through the whole schedule in one sitting and
 * delete it, and nothing on screen would have warned them.
 *
 * Class names are written out rather than built from the stage number: Tailwind
 * scans source text, so an interpolated `bg-rhythm-${stage}` would compile to
 * nothing and every chip would render plain.
 */
const STAGE_STYLES = [
  "border-rhythm-0/40 bg-rhythm-0/15",
  "border-rhythm-1/40 bg-rhythm-1/15",
  "border-rhythm-2/40 bg-rhythm-2/15",
];

export function ExpressionWall({
  phrases,
  placeholder,
}: {
  phrases: WallPhrase[];
  placeholder: boolean;
}) {
  const [items, setItems] = useState(phrases);
  const [peeked, setPeeked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The parent loads asynchronously, so the first render arrives empty.
  useEffect(() => setItems(phrases), [phrases]);

  /**
   * A tap on a phrase that is not due yet. It says when the phrase comes round
   * again and changes nothing — looking is not recalling, and treating it as a
   * review would quietly compress a schedule the learner never asked to skip.
   */
  function peek(phrase: WallPhrase) {
    setPeeked((current) => (current === phrase.id ? null : phrase.id));
  }

  async function review(phrase: WallPhrase) {
    setError(null);
    setPeeked(null);

    // Applied before the write: a tap on a chip has to feel immediate, and the
    // next state is fully determined by the current one, so there is nothing to
    // wait for the server to tell us.
    const nextStage = phrase.stage + 1;
    setItems((current) =>
      nextStage >= REVIEW_STAGES
        ? current.filter((item) => item.id !== phrase.id)
        : current.map((item) =>
            item.id === phrase.id
              ? {
                  ...item,
                  stage: nextStage,
                  due: false,
                  intervalDays: REVIEW_INTERVALS_DAYS[nextStage],
                }
              : item,
          ),
    );

    if (placeholder) return;

    try {
      await markPhraseReviewed(phrase.id, phrase.stage);
    } catch (cause) {
      // Put it back. A phrase that silently failed to save would come back on
      // the next load and look like the tap did nothing.
      setItems((current) =>
        current.some((item) => item.id === phrase.id)
          ? current.map((item) => (item.id === phrase.id ? phrase : item))
          : [phrase, ...current],
      );
      setError(toError(cause).message);
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="目前沒有要複習的說法"
        description="每次練習的回顧會挑出值得記住的字詞，依照複習節奏出現在這裡。"
      />
    );
  }

  const due = items.filter((item) => item.due).length;

  /**
   * One block per colour, due blocks first, everything not due last.
   *
   * `buildWall` already returns them in this order; splitting into blocks is
   * what makes the grouping visible, because a single wrapping row runs one
   * colour into the next mid-line. Each block carries its interval as a label —
   * without it the colours are three shades with nothing to tell the learner
   * what they mean.
   */
  const groups = [
    ...REVIEW_INTERVALS_DAYS.map((days, stage) => ({
      key: `due-${stage}`,
      label: `隔 ${days} 天`,
      items: items.filter((item) => item.due && item.stage === stage),
    })),
    {
      key: "waiting",
      label: "還在間隔內",
      items: items.filter((item) => !item.due),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group.key}>
          <p className="mb-1.5 text-[10px] text-muted">{group.label}</p>
          <div className="flex flex-wrap gap-2">
            {group.items.map((item) => (
              <div
                key={item.id}
                className={[
                  "rounded-xl border px-3 py-2 transition-colors",
                  item.due
                    ? STAGE_STYLES[item.stage]
                    : "border-line bg-surface",
                ].join(" ")}
              >
                {/* The link below has to sit outside this button — a link
                    nested inside a button is invalid and behaves differently
                    across browsers. */}
                <button
                  type="button"
                  onClick={() => (item.due ? review(item) : peek(item))}
                  aria-label={
                    item.due
                      ? `複習 ${item.phrase}，${item.meaningZh}`
                      : `${item.phrase}，${item.meaningZh}，還在間隔內`
                  }
                  className="block cursor-pointer text-left"
                >
                  <span className="block text-xs text-fg">{item.phrase}</span>
                  <span className="block text-[10px] text-muted">
                    {item.meaningZh}
                  </span>
                </button>

                {peeked === item.id ? (
                  <div className="mt-1.5 border-t border-line pt-1.5">
                    <span className="block text-[10px] text-brand">
                      {formatDateZh(new Date(item.dueAtMs).toISOString())}再複習
                    </span>
                    <Link
                      href={ROUTES.review(item.sessionId)}
                      className="mt-0.5 block text-[10px] text-muted underline underline-offset-2"
                    >
                      看那次練習 →
                    </Link>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="text-xs leading-relaxed text-muted">
        {due > 0
          ? `有 ${due} 個該複習了（上色的那些）。想起意思就點一下，它會退到下一個間隔。`
          : "目前都在間隔內，時間到了會自己上色。"}
        節奏是{" "}
        {REVIEW_INTERVALS_DAYS.map((days) => `${days} 天`).join("、")}{" "}
        三輪，走完就會從這裡消失，仍然留在那次練習的回顧裡。沒上色的點下去只會告訴你下次什麼時候，並可以連到當時那次練習，不會推進進度。
      </p>

      {error ? <p className="text-xs text-state-error">{error}</p> : null}
    </div>
  );
}
