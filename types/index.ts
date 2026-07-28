/**
 * Domain types for P1 Driving English Coach.
 *
 * These mirror the data model in `docs/04-technical-architecture.md`. They are
 * defined ahead of the database so the UI skeleton has something real to type
 * against; the Supabase schema lands in Phase 2 and should stay in sync.
 */

export type EnglishLevel = "basic" | "intermediate" | "advanced";

/**
 * Minutes, in 5-minute steps from 5 to 60. Kept as a closed union so an
 * off-grid value is a type error; `DURATIONS` in `lib/constants.ts` is the
 * runtime list and must stay in sync.
 */
export type SessionDuration =
  | 5
  | 10
  | 15
  | 20
  | 25
  | 30
  | 35
  | 40
  | 45
  | 50
  | 55
  | 60;

/** Live session state machine states (`docs/04`, section 2). */
export type SessionStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "ai_speaking"
  | "paused"
  | "ending"
  | "completed"
  | "error";

export type FeedbackType =
  | "grammar"
  | "word_choice"
  | "pronunciation"
  | "fluency";

export type FeedbackSeverity = "low" | "medium" | "high";

/**
 * How much metered voice a user may spend.
 * `trial` is the default for everyone, including users with no entitlement row.
 */
export type VoiceTier = "trial" | "full";

export interface AuthState {
  userId: string | null;
  email: string | null;
  /** True for a browser that has never linked an email. */
  isAnonymous: boolean;
}

export interface Topic {
  id: string;
  /** English label — this is what the user will actually speak about. */
  label: string;
  /** Chinese hint shown in the launcher UI. */
  hint: string;
}

export interface UserProfile {
  id: string;
  englishLevel: EnglishLevel;
  interests: string[];
  preferredTopics: string[];
  preferredFeedbackStyle: "gentle" | "direct";
  createdAt: string;
}

export interface TranscriptTurn {
  role: "user" | "coach";
  text: string;
  /** Seconds from session start. */
  at: number;
}

export interface Session {
  id: string;
  /**
   * Never null, including in anonymous demo mode — Supabase anonymous sign-in
   * issues a real auth user, which is what lets row level security protect a
   * session's transcript.
   */
  userId: string;
  topic: string;
  durationMinutes: SessionDuration;
  level: EnglishLevel;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  transcript: TranscriptTurn[];
  summary: string | null;
  /** 0–100. Broad indicators only — see the "no fake precision" note in `docs/07`. */
  scoreOverall: number | null;
  scoreFluency: number | null;
  scoreClarity: number | null;
  scoreVocab: number | null;
}

export interface FeedbackItem {
  id: string;
  sessionId: string;
  type: FeedbackType;
  originalText: string;
  improvedText: string;
  explanation: string;
  severity: FeedbackSeverity;
}

export interface VocabularyItem {
  id: string;
  sessionId: string;
  phrase: string;
  meaningZh: string;
  exampleEn: string;
  category: string;
}

/** What the review page renders (FR-4). */
export interface SessionReview {
  sessionId: string;
  title: string;
  summary: string;
  corrections: FeedbackItem[];
  alternatives: string[];
  vocabulary: VocabularyItem[];
  nextRecommendation: string;
}
