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
}

export const TIER_LIMITS: Record<VoiceTier, TierLimits> = {
  // Long enough for a visitor to have a real conversation and understand the
  // product; short enough that a hundred of them cost a few dollars.
  trial: { maxSessionSeconds: 180, maxSessionsPerDay: 1 },
  // Not "unlimited": a runaway loop or a bug should still hit a wall well
  // before it hits the OpenAI spending cap.
  full: { maxSessionSeconds: 3600, maxSessionsPerDay: 8 },
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

  // Clamp rather than reject: asking for 60 minutes on the trial tier is not an
  // attack, it is the launcher's default duration. Give what the tier allows.
  return {
    allowed: true,
    grantedSeconds: Math.min(
      Math.floor(input.requestedSeconds),
      limits.maxSessionSeconds,
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
