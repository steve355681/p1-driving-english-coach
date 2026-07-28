import assert from "node:assert/strict";
import test from "node:test";

import {
  TIER_LIMITS,
  decideGrant,
  denialMessage,
  readVoiceAccess,
} from "@/lib/voice/policy";

/**
 * This is the only thing between a visitor and an unbounded OpenAI bill, so
 * every branch is worth pinning down.
 */

const trial = { tier: "trial", requestedSeconds: 900, grantsToday: 0 };

test("a request longer than the tier allows is clamped, not refused", () => {
  // 15 minutes asked for on the trial tier: that is the launcher's default,
  // not an attack.
  const decision = decideGrant(trial);
  assert.equal(decision.allowed, true);
  assert.equal(decision.grantedSeconds, TIER_LIMITS.trial.maxSessionSeconds);

  const full = decideGrant({ ...trial, tier: "full" });
  assert.equal(full.grantedSeconds, 900, "under the cap, granted as asked");
});

test("the daily cap is enforced per tier", () => {
  const used = decideGrant({ ...trial, grantsToday: 1 });
  assert.equal(used.allowed, false);
  assert.equal(used.reason, "daily_limit");

  // The same count is fine on the tier that allows eight.
  assert.equal(decideGrant({ ...trial, tier: "full", grantsToday: 1 }).allowed, true);
  assert.equal(
    decideGrant({ ...trial, tier: "full", grantsToday: 8 }).allowed,
    false,
  );
});

test("a nonsense duration is refused rather than coerced", () => {
  for (const requestedSeconds of [0, -60, NaN, Infinity]) {
    const decision = decideGrant({ ...trial, requestedSeconds });
    assert.equal(decision.allowed, false, `${requestedSeconds} must be refused`);
    assert.equal(decision.reason, "invalid_request");
  }
});

test("allowlist mode refuses anyone without an entitlement row", () => {
  const stranger = decideGrant({ ...trial, access: "allowlist" });
  assert.equal(stranger.allowed, false);
  assert.equal(stranger.reason, "not_allowed");

  const owner = decideGrant({ ...trial, access: "allowlist", entitled: true });
  assert.equal(owner.allowed, true);
});

test("allowlist is checked before quota, and before the request is read", () => {
  // Otherwise a closed deployment would leak whether a quota had been used, and
  // a malformed request would be reported as malformed rather than as refused.
  const decision = decideGrant({
    ...trial,
    access: "allowlist",
    grantsToday: 99,
    requestedSeconds: NaN,
  });
  assert.equal(decision.reason, "not_allowed");
});

test("trial mode ignores entitlement, so the default deployment stays open", () => {
  assert.equal(decideGrant({ ...trial, access: "trial" }).allowed, true);
  // A caller that predates the setting behaves as trial.
  assert.equal(decideGrant(trial).allowed, true);
});

test("the access setting fails open to trial on anything unrecognised", () => {
  assert.equal(readVoiceAccess("allowlist"), "allowlist");
  assert.equal(readVoiceAccess(" ALLOWLIST "), "allowlist");

  // A deployment that silently refuses its own owner because of a typo is
  // worse than one that spends a little; the daily cap bounds it either way.
  for (const raw of [undefined, "", "trial", "true", "yes", "allow"]) {
    assert.equal(readVoiceAccess(raw), "trial", `${raw} must fall back`);
  }
});

test("every denial has a message that says what to do about it", () => {
  for (const reason of ["daily_limit", "invalid_request", "not_allowed"]) {
    for (const tier of ["trial", "full"]) {
      const message = denialMessage(reason, tier);
      assert.ok(message.length > 0, `${reason}/${tier} needs a message`);
    }
  }

  assert.match(denialMessage("daily_limit", "trial"), /試用/);
  assert.match(denialMessage("not_allowed", "trial"), /其他功能都可以正常使用/);
});
