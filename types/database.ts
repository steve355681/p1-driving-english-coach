/**
 * Database row types, matching `supabase/migrations/`.
 *
 * Hand-written for now — once the Supabase CLI is set up locally this file
 * should be replaced by `supabase gen types typescript`. Keep it in sync with
 * the migrations by hand until then.
 *
 * These are the wire shapes (snake_case, nullable columns). The camelCase
 * domain types in `types/index.ts` are what the UI uses; `lib/db/mappers.ts`
 * converts between them.
 *
 * Everything here must be a `type`, never an `interface`. Supabase constrains a
 * schema's rows to `Record<string, unknown>`, and only type aliases get an
 * implicit index signature — declare these as interfaces and the whole schema
 * silently fails the constraint, collapsing every table to `never` at the call
 * site with no error pointing back here.
 */

import type {
  EnglishLevel,
  FeedbackSeverity,
  FeedbackType,
  SessionStatus,
  TranscriptTurn,
  VoiceTier,
} from "@/types";

export type UserProfileRow = {
  id: string;
  english_level: EnglishLevel;
  interests: string[];
  preferred_topics: string[];
  preferred_feedback_style: "gentle" | "direct";
  created_at: string;
  updated_at: string;
}

export type TopicRow = {
  id: string;
  user_id: string;
  title: string;
  notes: string;
  brief: string | null;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TopicInsert = Pick<TopicRow, "user_id" | "title" | "notes"> &
  Partial<Pick<TopicRow, "id" | "brief">>;

export type TopicUpdate = Partial<
  Omit<TopicRow, "id" | "user_id" | "created_at" | "updated_at">
>;

export type SessionRow = {
  id: string;
  user_id: string;
  topic_id: string | null;
  topic: string;
  duration_minutes: number;
  level: EnglishLevel;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  /** jsonb. Postgres stores it opaquely; the app always writes this shape. */
  transcript: TranscriptTurn[];
  summary: string | null;
  alternatives: string[];
  next_recommendation: string | null;
  score_overall: number | null;
  score_fluency: number | null;
  score_clarity: number | null;
  score_vocab: number | null;
  created_at: string;
  updated_at: string;
}

export type FeedbackItemRow = {
  id: string;
  session_id: string;
  type: FeedbackType;
  original_text: string;
  improved_text: string;
  explanation: string;
  severity: FeedbackSeverity;
  created_at: string;
}

/** Read-only from the client — see the migration for why. */
export type VoiceUsageRow = {
  id: string;
  user_id: string;
  session_id: string | null;
  granted_seconds: number;
  tier: VoiceTier;
  created_at: string;
}

/** Written by the API route with the service role only. */
export type VoiceUsageInsert = Omit<VoiceUsageRow, "id" | "created_at">;

/** Read-only from the client — see the migration for why. */
export type VoiceEntitlementRow = {
  user_id: string;
  tier: VoiceTier;
  note: string | null;
  created_at: string;
}

export type VocabularyItemRow = {
  id: string;
  session_id: string;
  phrase: string;
  meaning_zh: string;
  example_en: string;
  category: string;
  /** How many review intervals the phrase has cleared; see `lib/progress/rhythm.ts`. */
  review_stage: number;
  last_reviewed_at: string | null;
  created_at: string;
}

/** Columns the app supplies on insert; everything else is defaulted by Postgres. */
export type SessionInsert = Pick<
  SessionRow,
  "user_id" | "topic" | "duration_minutes" | "level"
> &
  Partial<
    Pick<SessionRow, "id" | "status" | "started_at" | "transcript" | "topic_id">
  >;

export type SessionUpdate = Partial<
  Omit<SessionRow, "id" | "user_id" | "created_at" | "updated_at">
>;

export type FeedbackItemInsert = Omit<FeedbackItemRow, "id" | "created_at"> &
  Partial<Pick<FeedbackItemRow, "id">>;

/** The review-schedule columns are defaulted by Postgres, not by generation. */
export type VocabularyItemInsert = Omit<
  VocabularyItemRow,
  "id" | "created_at" | "review_stage" | "last_reviewed_at"
> &
  Partial<Pick<VocabularyItemRow, "id" | "review_stage" | "last_reviewed_at">>;

export type UserProfileUpdate = Partial<
  Omit<UserProfileRow, "id" | "created_at" | "updated_at">
>;

/** The schema shape `createClient<Database>()` expects. */
export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfileRow;
        Insert: { id: string } & UserProfileUpdate;
        Update: UserProfileUpdate;
        Relationships: [];
      };
      sessions: {
        Row: SessionRow;
        Insert: SessionInsert;
        Update: SessionUpdate;
        Relationships: [];
      };
      feedback_items: {
        Row: FeedbackItemRow;
        Insert: FeedbackItemInsert;
        Update: Partial<FeedbackItemInsert>;
        Relationships: [];
      };
      vocabulary_items: {
        Row: VocabularyItemRow;
        Insert: VocabularyItemInsert;
        Update: Partial<VocabularyItemInsert>;
        Relationships: [];
      };
      topics: {
        Row: TopicRow;
        Insert: TopicInsert;
        Update: TopicUpdate;
        Relationships: [];
      };
      voice_entitlements: {
        Row: VoiceEntitlementRow;
        // Readable only; there is no client-side write path by design.
        Insert: never;
        Update: never;
        Relationships: [];
      };
      voice_usage: {
        Row: VoiceUsageRow;
        // Only ever inserted by the API route, which uses the service role.
        Insert: VoiceUsageInsert;
        Update: never;
        Relationships: [];
      };
    };
    // `Record<never, never>` (no keys), not `Record<string, never>` (every key
    // maps to never). `.from()` resolves a relation against `Tables & Views`,
    // so the latter intersects every table down to `never`.
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
