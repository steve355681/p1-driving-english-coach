/**
 * Session persistence.
 *
 * Every function throws on a Postgres error rather than returning a result
 * union — callers are UI code that needs to show an error state either way,
 * and swallowing failures here would hide RLS misconfiguration.
 *
 * Nothing calls these yet; the launcher and live session screen wire up in
 * Phase 3.
 */

import { ensureAuthUserId, requireSupabase } from "@/lib/supabase/client";
import { toSession } from "@/lib/db/mappers";
import type {
  EnglishLevel,
  Session,
  SessionDuration,
  SessionStatus,
  TranscriptTurn,
} from "@/types";

export interface CreateSessionInput {
  topic: string;
  durationMinutes: SessionDuration;
  level: EnglishLevel;
  /** Set when the learner picked one of their saved topics. */
  topicId?: string | null;
}

export async function createSession(
  input: CreateSessionInput,
): Promise<Session> {
  const supabase = requireSupabase();
  const userId = await ensureAuthUserId();

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: userId,
      topic: input.topic,
      topic_id: input.topicId ?? null,
      duration_minutes: input.durationMinutes,
      level: input.level,
      status: "connecting",
    })
    .select()
    .single();

  if (error) throw error;
  return toSession(data);
}

export async function getSession(id: string): Promise<Session | null> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from("sessions")
    .select()
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? toSession(data) : null;
}

export async function listRecentSessions(limit = 20): Promise<Session[]> {
  const supabase = requireSupabase();

  // No user filter needed — RLS already restricts this to the caller's rows.
  const { data, error } = await supabase
    .from("sessions")
    .select()
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(toSession);
}

export async function updateSessionStatus(id: string, status: SessionStatus) {
  const supabase = requireSupabase();

  const { error } = await supabase
    .from("sessions")
    .update({ status })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Overwrites the transcript with the full turn list.
 *
 * docs/04 asks for incremental persistence, so this is meant to be called
 * periodically during a session, not once at the end. Sending the whole array
 * keeps it idempotent: a retried or out-of-order call can't duplicate turns
 * the way an append would.
 */
export async function saveTranscript(id: string, transcript: TranscriptTurn[]) {
  const supabase = requireSupabase();

  const { error } = await supabase
    .from("sessions")
    .update({ transcript })
    .eq("id", id);

  if (error) throw error;
}

export async function completeSession(
  id: string,
  transcript: TranscriptTurn[],
): Promise<Session> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from("sessions")
    .update({
      status: "completed",
      ended_at: new Date().toISOString(),
      transcript,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return toSession(data);
}

/**
 * Deletes sessions outright.
 *
 * Row level security scopes this to the caller, so a forged id belonging to
 * someone else deletes nothing rather than erroring — which is why there is no
 * owner filter here.
 *
 * The transcript, corrections and collected phrases go with it: feedback_items
 * and vocabulary_items cascade from the session. voice_usage does not — its
 * session_id is `on delete set null`, deliberately, so deleting practice
 * history cannot be used to reset a daily voice quota.
 */
export async function deleteSessions(ids: string[]) {
  if (ids.length === 0) return;

  const supabase = requireSupabase();
  const { error } = await supabase.from("sessions").delete().in("id", ids);
  if (error) throw error;
}
