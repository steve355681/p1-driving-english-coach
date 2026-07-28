/**
 * Review persistence: the feedback and vocabulary rows attached to a session,
 * plus the session-level summary and scores.
 *
 * Reading only. The write lives in `lib/review/persist.ts`, because it also
 * happens server-side from the generation route.
 */

import { requireSupabase } from "@/lib/supabase/client";
import {
  toFeedbackItem,
  toSession,
  toVocabularyItem,
} from "@/lib/db/mappers";
import type { SessionReview } from "@/types";

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
    transcriptTurns: session.transcript.length,
  };
}
