/**
 * The write behind a tap on the expression wall.
 *
 * Row level security scopes the update to the caller through the phrase's
 * session, so there is no owner filter here — and no way to advance someone
 * else's review schedule.
 */

import { requireSupabase } from "@/lib/supabase/client";
import { REVIEW_STAGES } from "@/lib/progress/rhythm";

/**
 * Records that a phrase was recalled, moving it to the next interval.
 *
 * Takes the stage the caller was looking at rather than incrementing whatever
 * is in the database, and refuses to write if they disagree. Two tabs open on
 * the dashboard would otherwise let a double tap skip an interval — the second
 * write would land on a row that had already moved on.
 */
export async function markPhraseReviewed(id: string, fromStage: number) {
  const supabase = requireSupabase();

  const nextStage = Math.min(fromStage + 1, REVIEW_STAGES);

  const { error } = await supabase
    .from("vocabulary_items")
    .update({
      review_stage: nextStage,
      last_reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("review_stage", fromStage);

  if (error) throw error;
}
