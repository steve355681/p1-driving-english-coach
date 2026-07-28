/**
 * The one place that decides between the real database and placeholder data.
 *
 * Without Supabase configured the app still has to run — that is how it behaves
 * for anyone who clones the repo, and how the GitHub Pages build behaved. Rather
 * than scattering `isSupabaseConfigured()` through the screens, every read and
 * write goes through here and reports which source answered, so the UI can say
 * so honestly instead of presenting fixtures as real.
 */

import { isSupabaseConfigured } from "@/lib/supabase/client";
import * as db from "@/lib/db/sessions";
import { getSessionReview } from "@/lib/db/reviews";
import { getProgressSummary } from "@/lib/db/progress";
import {
  summariseProgress,
  type ProgressSummary,
} from "@/lib/progress/summarise";
import {
  PLACEHOLDER_NOW,
  placeholderFeedbackTypes,
  placeholderReview,
  placeholderSessions,
} from "@/lib/placeholder-data";
import type {
  EnglishLevel,
  Session,
  SessionDuration,
  SessionReview,
} from "@/types";

export interface Sourced<T> {
  data: T;
  /** True when `data` came from `lib/placeholder-data.ts`. */
  placeholder: boolean;
}

/** The id used for the stand-in session when there is no database. */
export const PLACEHOLDER_SESSION_ID = "demo";

/**
 * Without a database the launcher's choices have nowhere to live, so the
 * session screen would show whatever the fixture happens to say instead of what
 * was just picked. Parking them in sessionStorage keeps the placeholder flow
 * coherent; it is deliberately per-tab and short-lived, since it is a stand-in
 * for a row, not a cache of one.
 */
const PLACEHOLDER_KEY = "p1:placeholder-session";

function rememberPlaceholder(session: Session) {
  try {
    sessionStorage.setItem(PLACEHOLDER_KEY, JSON.stringify(session));
  } catch {
    // Private browsing, storage disabled — the fixture below is still shown.
  }
}

function recallPlaceholder(id: string): Session | null {
  try {
    const raw = sessionStorage.getItem(PLACEHOLDER_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    return session.id === id ? session : null;
  } catch {
    return null;
  }
}

export async function startSession(input: {
  topic: string;
  durationMinutes: SessionDuration;
  level: EnglishLevel;
  topicId?: string | null;
}): Promise<Sourced<Session>> {
  if (!isSupabaseConfigured()) {
    const session: Session = {
      ...placeholderSessions[0],
      id: PLACEHOLDER_SESSION_ID,
      topic: input.topic,
      durationMinutes: input.durationMinutes,
      level: input.level,
      status: "connecting",
    };
    rememberPlaceholder(session);
    return { data: session, placeholder: true };
  }

  return { data: await db.createSession(input), placeholder: false };
}

export async function loadSession(
  id: string,
): Promise<Sourced<Session | null>> {
  if (!isSupabaseConfigured() || id === PLACEHOLDER_SESSION_ID) {
    const session = recallPlaceholder(id) ?? {
      ...placeholderSessions[0],
      id,
      status: "connecting" as const,
    };
    return { data: session, placeholder: true };
  }

  return { data: await db.getSession(id), placeholder: false };
}

export async function loadRecentSessions(): Promise<Sourced<Session[]>> {
  if (!isSupabaseConfigured()) {
    return { data: placeholderSessions, placeholder: true };
  }

  return { data: await db.listRecentSessions(), placeholder: false };
}

export async function loadReview(
  id: string,
): Promise<Sourced<SessionReview | null>> {
  if (!isSupabaseConfigured() || id.startsWith(PLACEHOLDER_SESSION_ID)) {
    return { data: placeholderReview, placeholder: true };
  }

  return { data: await getSessionReview(id), placeholder: false };
}

/**
 * The placeholder dashboard runs through the same aggregation as the real one,
 * so the demo cannot show a shape the product does not actually produce.
 *
 * "Now" is `PLACEHOLDER_NOW` rather than the real clock. The fixtures have
 * fixed dates, so against the real clock the demo's weekly chart would quietly
 * empty out as months passed, and the dates listed directly above it would
 * disagree with it.
 */
export async function loadProgress(): Promise<Sourced<ProgressSummary>> {
  if (!isSupabaseConfigured()) {
    return {
      data: summariseProgress({
        sessions: placeholderSessions,
        feedback: placeholderFeedbackTypes.map((type) => ({
          type,
          sessionId: placeholderSessions[0].id,
        })),
        vocabulary: placeholderReview.vocabulary.map((item) => ({
          id: item.id,
          phrase: item.phrase,
          meaningZh: item.meaningZh,
          sessionId: item.sessionId,
          createdAt: item.createdAt,
          reviewStage: item.reviewStage,
          lastReviewedAt: item.lastReviewedAt,
        })),
        now: PLACEHOLDER_NOW,
      }),
      placeholder: true,
    };
  }

  return { data: await getProgressSummary(), placeholder: false };
}

/**
 * Deletes practice history.
 *
 * A no-op without a database: the placeholder list is a module constant, so
 * there is nothing to remove and the next read returns the fixtures either way.
 */
export async function removeSessions(ids: string[]): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await db.deleteSessions(ids);
}

export { db };
