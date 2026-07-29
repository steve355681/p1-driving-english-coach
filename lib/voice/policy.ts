/**
 * How much metered voice a request may have.
 *
 * A pure function on purpose: this is the only thing between a visitor and an
 * unbounded OpenAI bill, so it is worth being able to test every branch without
 * a database, a network or a browser.
 *
 * It is never evaluated in the browser. The client cannot be trusted to report
 * its own tier or its own usage, so the API route recomputes both from the
 * database before calling this.
 */

import type { VoiceTier } from "@/types";

export interface TierLimits {
  /** Longest single grant. */
  maxSessionSeconds: number;
  /** Grants allowed in a rolling 24 hours. */
  maxSessionsPerDay: number;
  /**
   * Total granted seconds allowed in a rolling 24 hours.
   *
   * The session count alone does not bound spending: eight grants of an hour
   * each is eight hours of metered audio. Cost tracks time, so the cap that
   * matters is time.
   */
  maxSecondsPerDay: number;
}

export const TIER_LIMITS: Record<VoiceTier, TierLimits> = {
  // Long enough for a visitor to have a real conversation and understand the
  // product; short enough that a hundred of them cost a few dollars.
  trial: { maxSessionSeconds: 180, maxSessionsPerDay: 1, maxSecondsPerDay: 180 },
  // Not "unlimited": a runaway loop or a bug should still hit a wall well
  // before it hits the OpenAI spending cap.
  // 90 minutes a day: a full hour of practice with room for the reconnects a
  // dropped call costs, and roughly $2 a day at measured rates. The session
  // count stays high because reconnecting spends a grant without spending much
  // time; the seconds cap is what actually holds the line.
  full: { maxSessionSeconds: 3600, maxSessionsPerDay: 8, maxSecondsPerDay: 5400 },
};

/**
 * Who may spend voice on this deployment.
 *
 * `trial` lets any signed-in visitor — including an anonymous one — have one
 * short conversation a day. That is what makes the site demoable, and it is
 * also a standing offer to spend money on strangers: a few dollars a day if a
 * hundred people find it, more if someone scripts it.
 *
 * `allowlist` restricts voice to users with a `voice_entitlements` row. The
 * rest of the product stays fully usable; only the metered part is closed.
 *
 * Set with the `VOICE_ACCESS` environment variable. It defaults to `trial`
 * because a deployment that silently refuses its own owner is worse than one
 * that spends a little, and the daily cap bounds the damage either way.
 */
export type VoiceAccess = "trial" | "allowlist";

export function readVoiceAccess(raw: string | undefined): VoiceAccess {
  return raw?.trim().toLowerCase() === "allowlist" ? "allowlist" : "trial";
}

/** Below this a grant is not worth issuing. */
const MIN_USEFUL_SECONDS = 60;

export type DenialReason = "daily_limit" | "invalid_request" | "not_allowed";

export type GrantDecision =
  | { allowed: true; grantedSeconds: number; limits: TierLimits }
  | { allowed: false; reason: DenialReason; limits: TierLimits };

export function decideGrant(input: {
  tier: VoiceTier;
  /** What the client asked for, in seconds. Treated as a request, not a fact. */
  requestedSeconds: number;
  /** Grants already issued to this user in the last 24 hours. */
  grantsToday: number;
  /** Seconds already granted to this user in the last 24 hours. */
  secondsToday?: number;
  /** Deployment policy. Defaults to `trial` for callers that predate it. */
  access?: VoiceAccess;
  /** Whether the user has a `voice_entitlements` row of any tier. */
  entitled?: boolean;
}): GrantDecision {
  const limits = TIER_LIMITS[input.tier];

  // Checked before anything else: on a closed deployment the answer does not
  // depend on what was asked for or on how much has been used.
  if (input.access === "allowlist" && !input.entitled) {
    return { allowed: false, reason: "not_allowed", limits };
  }

  if (
    !Number.isFinite(input.requestedSeconds) ||
    input.requestedSeconds < 1
  ) {
    return { allowed: false, reason: "invalid_request", limits };
  }

  if (input.grantsToday >= limits.maxSessionsPerDay) {
    return { allowed: false, reason: "daily_limit", limits };
  }

  const remaining = limits.maxSecondsPerDay - (input.secondsToday ?? 0);
  // A grant too short to say anything in is worse than a refusal: it costs a
  // connection, a quota row and a microphone prompt, then ends mid-sentence.
  if (remaining < MIN_USEFUL_SECONDS) {
    return { allowed: false, reason: "daily_limit", limits };
  }

  // Clamp rather than reject: asking for 60 minutes on the trial tier is not an
  // attack, it is the launcher's default duration. Give what the tier allows,
  // and never more than the day has left.
  return {
    allowed: true,
    grantedSeconds: Math.min(
      Math.floor(input.requestedSeconds),
      limits.maxSessionSeconds,
      remaining,
    ),
    limits,
  };
}

/** Message shown to the user when a grant is refused. */
export function denialMessage(
  reason: DenialReason,
  tier: VoiceTier,
): string {
  if (reason === "invalid_request") return "練習長度不正確。";
  if (reason === "not_allowed") {
    return "這個站台的語音練習僅開放給已授權的帳號。其他功能都可以正常使用。";
  }

  return tier === "trial"
    ? "試用每天只能練習一次。登入並取得完整存取後就沒有這個限制。"
    : "今天的練習次數已達上限，明天再繼續。";
}
