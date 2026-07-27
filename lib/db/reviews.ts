/**
 * Review persistence: the feedback and vocabulary rows attached to a session,
 * plus the session-level summary and scores.
 *
 * Phase 5 generates this content; Phase 2 just gives it somewhere to live.
 */

import { requireSupabase } from "@/lib/supabase/client";
import {
  toFeedbackItem,
  toSession,
  toVocabularyItem,
} from "@/lib/db/mappers";
import type {
  FeedbackItem,
  SessionReview,
  VocabularyItem,
} from "@/types";

/** What Phase 5 will hand over once it has processed a transcript. */
export interface SaveReviewInput {
  summary: string;
  nextRecommendation: string;
  alternatives: string[];
  scores?: {
    overall?: number;
    fluency?: number;
    clarity?: number;
    vocab?: number;
  };
  corrections: Array<Omit<FeedbackItem, "id" | "sessionId">>;
  vocabulary: Array<Omit<VocabularyItem, "id" | "sessionId">>;
}

export async function getSessionReview(
  sessionId: string,
): Promise<SessionReview | null> {
  const supabase = requireSupabase();

  const [sessionResult, feedbackResult, vocabularyResult] = await Promise.all([
    supabase.from("sessions").select().eq("id", sessionId).maybeSingle(),
    supabase
      .from("feedback_items")
      .select()
      .eq("session_id", sessionId)
      .order("created_at"),
    supabase
      .from("vocabulary_items")
      .select()
      .eq("session_id", sessionId)
      .order("created_at"),
  ]);

  if (sessionResult.error) throw sessionResult.error;
  if (feedbackResult.error) throw feedbackResult.error;
  if (vocabularyResult.error) throw vocabularyResult.error;
  if (!sessionResult.data) return null;

  const row = sessionResult.data;
  const session = toSession(row);

  return {
    sessionId: session.id,
    title: session.topic,
    summary: session.summary ?? "",
    corrections: (feedbackResult.data ?? []).map(toFeedbackItem),
    // Read straight off the row: these two live on `sessions` and are review
    // output, so they are not part of the `Session` domain type.
    alternatives: row.alternatives ?? [],
    vocabulary: (vocabularyResult.data ?? []).map(toVocabularyItem),
    nextRecommendation: row.next_recommendation ?? "",
  };
}

/**
 * Writes a generated review.
 *
 * Feedback and vocabulary are deleted first so re-running generation for a
 * session replaces its review instead of stacking duplicates. This is three
 * statements rather than one transaction — PostgREST has no multi-statement
 * transaction — so a failure partway can leave a session with its old summary
 * and no items. Acceptable while generation is re-runnable; if it stops being
 * re-runnable, this belongs in a Postgres function.
 */
export async function saveSessionReview(
  sessionId: string,
  input: SaveReviewInput,
) {
  const supabase = requireSupabase();

  const { error: sessionError } = await supabase
    .from("sessions")
    .update({
      summary: input.summary,
      alternatives: input.alternatives,
      next_recommendation: input.nextRecommendation,
      score_overall: input.scores?.overall ?? null,
      score_fluency: input.scores?.fluency ?? null,
      score_clarity: input.scores?.clarity ?? null,
      score_vocab: input.scores?.vocab ?? null,
    })
    .eq("id", sessionId);

  if (sessionError) throw sessionError;

  await Promise.all([
    supabase.from("feedback_items").delete().eq("session_id", sessionId),
    supabase.from("vocabulary_items").delete().eq("session_id", sessionId),
  ]);

  if (input.corrections.length > 0) {
    const { error } = await supabase.from("feedback_items").insert(
      input.corrections.map((item) => ({
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

  if (input.vocabulary.length > 0) {
    const { error } = await supabase.from("vocabulary_items").insert(
      input.vocabulary.map((item) => ({
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
