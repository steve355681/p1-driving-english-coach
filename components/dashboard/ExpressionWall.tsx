"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { markPhraseReviewed } from "@/lib/db/vocabulary";
import {
  REVIEW_INTERVALS_DAYS,
  REVIEW_STAGES,
  type WallPhrase,
} from "@/lib/progress/rhythm";
import { toError } from "@/lib/utils";

/**
 * The expression wall, on a spaced-review rhythm.
 *
 * A phrase due for recall is tinted; the tint says which interval it is in.
 * Tapping it means "I remembered this", which advances it to the next interval
 * and returns it to the plain surface until that interval elapses. After the
 * last interval it leaves the wall — the point is to empty, not to accumulate.
 *
 * Every chip is tappable, including one still inside its interval. The tint is
 * a suggestion about where attention is worth spending, not a lock: someone who
 * wants to run through the whole wall should be able to, and an early recall is
 * still a recall. One rule for every chip also beats a tap that means different
 * things depending on a date the learner cannot see.
 *
 * Class names are written out rather than built from the stage number: Tailwind
 * scans source text, so an interpolated `bg-rhythm-${stage}` would compile to
 * nothing and every chip would render plain.
 */
const STAGE_STYLES = [
  "border-rhythm-0/40 bg-rhythm-0/15",
  "border-rhythm-1/40 bg-rhythm-1/15",
  "border-rhythm-2/40 bg-rhythm-2/15",
  "border-rhythm-3/40 bg-rhythm-3/15",
  "border-rhythm-4/40 bg-rhythm-4/15",
  "border-rhythm-5/40 bg-rhythm-5/15",
];

function intervalLabel(days: number) {
  return days === 0 ? "剛學到" : `隔 ${days} 天`;
}

export function ExpressionWall({
  phrases,
  placeholder,
}: {
  phrases: WallPhrase[];
  placeholder: boolean;
}) {
  const [items, setItems] = useState(phrases);
  const [error, setError] = useState<string | null>(null);

  // The parent loads asynchronously, so the first render arrives empty.
  useEffect(() => setItems(phrases), [phrases]);

  async function review(phrase: WallPhrase) {
    setError(null);

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => review(item)}
            title={intervalLabel(item.intervalDays)}
            aria-label={`複習 ${item.phrase}，${item.meaningZh}`}
            className={[
              "cursor-pointer rounded-xl border px-3 py-2 text-left transition-colors",
              item.due
                ? STAGE_STYLES[item.stage]
                : "border-line bg-surface hover:bg-surface-2",
            ].join(" ")}
          >
            <span className="block text-xs text-fg">{item.phrase}</span>
            <span className="block text-[10px] text-muted">
              {item.meaningZh}
            </span>
          </button>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-muted">
        {due > 0
          ? `有 ${due} 個該複習了（上色的那些）。`
          : "目前都在間隔內，時間到了會自己上色。"}
        想起意思就點一下，它會退到下一個間隔（
        {REVIEW_INTERVALS_DAYS.slice(1)
          .map((days) => `${days} 天`)
          .join("、")}
        ）。沒上色的也點得下去，提早複習一樣算。走完最後一輪就會從這裡消失，仍然留在那次練習的回顧裡。
      </p>

      {error ? <p className="text-xs text-state-error">{error}</p> : null}
    </div>
  );
}
