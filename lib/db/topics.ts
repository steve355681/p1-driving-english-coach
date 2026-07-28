/**
 * Saved topics: notes the learner practises against, reusable across sessions.
 *
 * Row level security scopes every query to the caller, so none of these filter
 * by user id — adding one would be redundant, and the absence is deliberate
 * rather than an oversight.
 */

import { ensureAuthUserId, requireSupabase } from "@/lib/supabase/client";
import type { Topic } from "@/types";
import type { TopicRow } from "@/types/database";

function toTopic(row: TopicRow): Topic {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    notes: row.notes,
    brief: row.brief,
    useCount: row.use_count,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  };
}

export async function listTopics(): Promise<Topic[]> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from("topics")
    .select()
    // Most recently practised first; never-practised fall back to newest.
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toTopic);
}

export async function getTopic(id: string): Promise<Topic | null> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from("topics")
    .select()
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? toTopic(data) : null;
}

export async function createTopic(input: {
  title: string;
  notes: string;
  brief: string | null;
}): Promise<Topic> {
  const supabase = requireSupabase();
  const userId = await ensureAuthUserId();

  const { data, error } = await supabase
    .from("topics")
    .insert({
      user_id: userId,
      title: input.title,
      notes: input.notes,
      brief: input.brief,
    })
    .select()
    .single();

  if (error) throw error;
  return toTopic(data);
}

export async function updateTopic(
  id: string,
  input: { title: string; notes: string; brief: string | null },
): Promise<Topic> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from("topics")
    .update({ title: input.title, notes: input.notes, brief: input.brief })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return toTopic(data);
}

export async function deleteTopic(id: string) {
  const supabase = requireSupabase();
  const { error } = await supabase.from("topics").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Bumps the counters shown in the list.
 *
 * Read-modify-write, so two sessions started at the same moment can lose one
 * increment. That is a label reading "練過 2 次" instead of 3, not a billing or
 * safety record, and the alternative is a Postgres function for a cosmetic
 * counter.
 */
export async function markTopicUsed(topic: Topic) {
  const supabase = requireSupabase();

  const { error } = await supabase
    .from("topics")
    .update({
      use_count: topic.useCount + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", topic.id);

  if (error) throw error;
}
