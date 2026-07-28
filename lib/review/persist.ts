import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { FeedbackItem, VocabularyItem } from "@/types";

/** What generation produces and the review page renders. */
export interface ReviewContent {
  summary: string;
  nextRecommendation: string;
  alternatives: string[];
  corrections: Array<Omit<FeedbackItem, "id" | "sessionId">>;
  vocabulary: Array<Omit<VocabularyItem, "id" | "sessionId">>;
}

/**
 * Writes a generated review.
 *
 * Takes the client rather than reaching for one, because the same write happens
 * from the API route with the service role. That client bypasses row level
 * security, so `sessionId` must already have been checked against the caller —
 * this function trusts it completely and will happily write a review onto
 * someone else's session if handed the wrong id.
 *
 * Feedback and vocabulary are deleted first so re-running generation replaces a
 * review instead of stacking duplicates. This is several statements rather than
 * one transaction — PostgREST has no multi-statement transaction — so a failure
 * partway can leave a session with a summary and no items. Acceptable while
 * generation stays re-runnable; if it stops being, this belongs in a Postgres
 * function.
 *
 * `scoreOverall` and friends are left null on purpose. docs/07 asks for broad
 * trend indicators over numeric scoring, and a 0–100 figure invented by a model
 * from one transcript is exactly the fake precision it warns about.
 */
export async function writeReview(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  content: ReviewContent,
) {
  const { error: sessionError } = await supabase
    .from("sessions")
    .update({
      summary: content.summary,
      alternatives: content.alternatives,
      next_recommendation: content.nextRecommendation,
    })
    .eq("id", sessionId);

  if (sessionError) throw sessionError;

  await Promise.all([
    supabase.from("feedback_items").delete().eq("session_id", sessionId),
    supabase.from("vocabulary_items").delete().eq("session_id", sessionId),
  ]);

  if (content.corrections.length > 0) {
    const { error } = await supabase.from("feedback_items").insert(
      content.corrections.map((item) => ({
        session_id: sessionId,
        type: item.type,
        original_text: item.originalText,
        improved_text: item.improvedText,
        explanation: item.explanation,
        severity: item.severity,
      })),
    );
    if (error) throw error;
  }

  if (content.vocabulary.length > 0) {
    const { error } = await supabase.from("vocabulary_items").insert(
      content.vocabulary.map((item) => ({
        session_id: sessionId,
        phrase: item.phrase,
        meaning_zh: item.meaningZh,
        example_en: item.exampleEn,
        category: item.category,
      })),
    );
    if (error) throw error;
  }
}
