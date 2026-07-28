/** Row (snake_case, from Postgres) <-> domain type (camelCase, used by the UI). */

import type {
  FeedbackItemRow,
  SessionRow,
  UserProfileRow,
  VocabularyItemRow,
} from "@/types/database";
import type {
  FeedbackItem,
  Session,
  SessionDuration,
  UserProfile,
  VocabularyItem,
} from "@/types";

export function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    topicId: row.topic_id,
    userId: row.user_id,
    topic: row.topic,
    // The column is constrained to the same 5-minute grid as SessionDuration,
    // so this cast can only be wrong if the constraint is changed without the
    // type.
    durationMinutes: row.duration_minutes as SessionDuration,
    level: row.level,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    transcript: row.transcript ?? [],
    summary: row.summary,
    scoreOverall: row.score_overall,
    scoreFluency: row.score_fluency,
    scoreClarity: row.score_clarity,
    scoreVocab: row.score_vocab,
  };
}

export function toFeedbackItem(row: FeedbackItemRow): FeedbackItem {
  return {
    id: row.id,
    sessionId: row.session_id,
    type: row.type,
    originalText: row.original_text,
    improvedText: row.improved_text,
    explanation: row.explanation,
    severity: row.severity,
  };
}

export function toVocabularyItem(row: VocabularyItemRow): VocabularyItem {
  return {
    id: row.id,
    sessionId: row.session_id,
    phrase: row.phrase,
    meaningZh: row.meaning_zh,
    exampleEn: row.example_en,
    category: row.category,
    reviewStage: row.review_stage,
    lastReviewedAt: row.last_reviewed_at,
    createdAt: row.created_at,
  };
}

export function toUserProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    englishLevel: row.english_level,
    interests: row.interests,
    preferredTopics: row.preferred_topics,
    preferredFeedbackStyle: row.preferred_feedback_style,
    createdAt: row.created_at,
  };
}
