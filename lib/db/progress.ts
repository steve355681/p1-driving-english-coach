/**
 * Reads the rows the dashboard aggregates from.
 *
 * Row level security scopes all three queries to the caller, including the two
 * child tables — their policies check ownership through `sessions` — so none of
 * these filter by user id.
 *
 * Aggregation happens in the browser rather than in Postgres. For one person's
 * practice history this is a few hundred small rows; a view or an RPC would be
 * faster and is the right answer if this ever has to serve someone with years
 * of sessions, but it is not worth a migration today. The caps below are what
 * keeps that promise honest.
 */

import { requireSupabase } from "@/lib/supabase/client";
import { toSession } from "@/lib/db/mappers";
import { summariseProgress, type ProgressSummary } from "@/lib/progress/summarise";
import { REVIEW_STAGES } from "@/lib/progress/rhythm";
import type { FeedbackType } from "@/types";

/** Enough for years of daily practice, and a hard stop on an unbounded read. */
const SESSION_LIMIT = 500;
const FEEDBACK_LIMIT = 2000;
const VOCABULARY_LIMIT = 400;

export async function getProgressSummary(): Promise<ProgressSummary> {
  const supabase = requireSupabase();

  const [sessionResult, feedbackResult, vocabularyResult] = await Promise.all([
    supabase
      .from("sessions")
      .select()
      .order("started_at", { ascending: false })
      .limit(SESSION_LIMIT),
    supabase
      .from("feedback_items")
      .select("type, session_id")
      .limit(FEEDBACK_LIMIT),
    supabase
      .from("vocabulary_items")
      .select("id, phrase, meaning_zh, session_id, created_at, review_stage, last_reviewed_at")
      // Finished phrases have left the wall for good, so there is no reason to
      // fetch them — and excluding them keeps the cap above meaningful.
      .lt("review_stage", REVIEW_STAGES)
      .order("created_at", { ascending: false })
      .limit(VOCABULARY_LIMIT),
  ]);

  if (sessionResult.error) throw sessionResult.error;
  if (feedbackResult.error) throw feedbackResult.error;
  if (vocabularyResult.error) throw vocabularyResult.error;

  return summariseProgress({
    sessions: (sessionResult.data ?? []).map(toSession),
    feedback: (feedbackResult.data ?? []).map((row) => ({
      type: row.type as FeedbackType,
      sessionId: row.session_id,
    })),
    vocabulary: (vocabularyResult.data ?? []).map((row) => ({
      id: row.id,
      phrase: row.phrase,
      meaningZh: row.meaning_zh,
      sessionId: row.session_id,
      createdAt: row.created_at,
      reviewStage: row.review_stage,
      lastReviewedAt: row.last_reviewed_at,
    })),
    now: new Date(),
  });
}
