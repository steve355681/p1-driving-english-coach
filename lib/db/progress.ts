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
import type { FeedbackType } from "@/types";

/** Enough for years of daily practice, and a hard stop on an unbounded read. */
const SESSION_LIMIT = 500;
const FEEDBACK_LIMIT = 2000;
/** The wall shows the most recent; older phrases are still in each review. */
const VOCABULARY_LIMIT = 200;

export async function getProgressSummary(): Promise<ProgressSummary> {
  const supabase = requireSupabase();

  const [sessionResult, feedbackResult, vocabularyResult] = await Promise.all([
    supabase
      .from("sessions")
      .select()
      .order("started_at", { ascending: false })
      .limit(SESSION_LIMIT),
    supabase.from("feedback_items").select("type").limit(FEEDBACK_LIMIT),
    supabase
      .from("vocabulary_items")
      .select("phrase, meaning_zh, session_id")
      .order("created_at", { ascending: false })
      .limit(VOCABULARY_LIMIT),
  ]);

  if (sessionResult.error) throw sessionResult.error;
  if (feedbackResult.error) throw feedbackResult.error;
  if (vocabularyResult.error) throw vocabularyResult.error;

  return summariseProgress({
    sessions: (sessionResult.data ?? []).map(toSession),
    feedbackTypes: (feedbackResult.data ?? []).map(
      (row) => row.type as FeedbackType,
    ),
    vocabulary: (vocabularyResult.data ?? []).map((row) => ({
      phrase: row.phrase,
      meaningZh: row.meaning_zh,
      sessionId: row.session_id,
    })),
    now: new Date(),
  });
}
