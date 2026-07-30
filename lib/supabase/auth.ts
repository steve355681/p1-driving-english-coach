import { ensureAuthUserId, requireSupabase } from "@/lib/supabase/client";
import type { AuthState } from "@/types";

/** Where the magic link should land. */
function redirectTo() {
  return `${window.location.origin}/settings`;
}

export interface AuthRedirectError {
  code: string | null;
  message: string;
}

/**
 * Captured at import time, on purpose.
 *
 * A failed OAuth round trip comes back as `error` parameters on this URL, and
 * the Supabase client strips the fragment while initialising. Reading it from
 * an effect is a race against that, and losing the race means the failure is
 * silent — which is exactly what happened: Google granted access, Supabase
 * refused the identity, and the screen simply carried on saying 匿名試用模式
 * with nothing to tell the learner why.
 */
const REDIRECT_ERROR: AuthRedirectError | null =
  typeof window === "undefined" ? null : parseRedirectError();

function parseRedirectError(): AuthRedirectError | null {
  // Which half of the URL carries it depends on the flow, so check both.
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const source = hash.has("error") ? hash : query.has("error") ? query : null;
  if (!source) return null;

  return {
    code: source.get("error_code"),
    message: source.get("error_description") ?? source.get("error") ?? "",
  };
}

/**
 * Known reasons a sign-in comes back refused.
 *
 * The raw description is always appended rather than swallowed. These codes
 * change, and a message that only says "登入失敗" would leave the next person
 * exactly where this one was.
 */
const REDIRECT_ERROR_MESSAGES: Record<string, string> = {
  identity_already_exists:
    "這個 Google 帳號已經有自己的紀錄了，沒辦法把這個瀏覽器上的練習併進去。" +
    "下面的按鈕會直接登入那個帳號 —— 那邊的紀錄都在，只有這個瀏覽器上的不會過去。",
  email_exists:
    "這個 email 已經有自己的紀錄了，沒辦法把這個瀏覽器上的練習併進去。" +
    "下面的按鈕會直接登入那個帳號 —— 那邊的紀錄都在，只有這個瀏覽器上的不會過去。",
  manual_linking_disabled:
    "專案沒有開啟手動綁定，所以無法保留這個瀏覽器的紀錄。可以改用下面的「仍要直接登入」。",
  bad_oauth_state:
    "登入流程被中斷了 —— 常見於在其他 App 內建的瀏覽器裡操作。請直接用 Chrome 或 Safari 開這個網站再試一次。",
  flow_state_not_found:
    "登入流程被中斷了 —— 常見於在其他 App 內建的瀏覽器裡操作。請直接用 Chrome 或 Safari 開這個網站再試一次。",
  access_denied: "你取消了 Google 授權。",
};

export function explainRedirectError(failure: AuthRedirectError) {
  const known = failure.code
    ? REDIRECT_ERROR_MESSAGES[failure.code]
    : undefined;

  if (known) return known;
  return `登入沒有完成：${failure.message || failure.code || "原因未知"}`;
}

/**
 * Returns the error this page was redirected back with, once, and clears it
 * from the address bar so a reload does not resurrect it.
 */
let redirectErrorTaken = false;

export function takeRedirectError(): AuthRedirectError | null {
  if (redirectErrorTaken || !REDIRECT_ERROR) return null;
  redirectErrorTaken = true;

  window.history.replaceState({}, "", window.location.pathname);
  return REDIRECT_ERROR;
}

/**
 * Who the caller is, according to the auth server.
 *
 * `getUser()` rather than `getSession()`, and the difference is not academic.
 * `getSession()` reads the access token held in this browser, and that token
 * was minted before Google was linked — so it still says the user has no
 * email. Reading it made a completed sign-in render as "目前為匿名試用模式",
 * which is indistinguishable from the sign-in having failed.
 *
 * The cost is a network round trip on each read. Worth it: this is the one
 * value on the settings screen the learner uses to decide whether to try
 * signing in again.
 */
export async function getAuthState(): Promise<AuthState> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.getUser();
  const user = error ? null : data.user;

  if (!user) return { userId: null, email: null, isAnonymous: true };

  return {
    userId: user.id,
    email: user.email ?? null,
    // Derived from the email alone. `is_anonymous` is not cleared reliably once
    // an identity is linked, and a stale `true` here would send the caller back
    // into linkIdentity against a user that has already been linked.
    isAnonymous: !user.email,
  };
}

/**
 * Which OTP flow the emailed code belongs to.
 *
 * Linking an address to an anonymous user goes through Supabase's change-email
 * flow, which issues a different kind of token from a plain sign-in. Verifying
 * with the wrong one fails, so the caller has to carry it back.
 */
export type VerifyType = "email" | "email_change";

export type SignInOutcome =
  | { kind: "linked"; verifyType: VerifyType }
  | { kind: "signed-in"; verifyType: VerifyType }
  /** The address already belongs to another account. */
  | { kind: "already-registered"; verifyType: VerifyType };

/**
 * Sends a magic link for `email`.
 *
 * When the current browser is an anonymous user, this *links* the address to
 * that same user rather than creating a new one, so the sessions already
 * recorded on this device stay attached. If the address is already registered,
 * linking is impossible and we fall back to a normal sign-in — the caller has
 * to warn that this device's anonymous history will not come along, because it
 * belongs to a different auth user and RLS will hide it.
 */
export async function requestMagicLink(
  email: string,
): Promise<SignInOutcome> {
  const supabase = requireSupabase();

  // Make sure there is a session to link to; a first-time visitor may not have
  // one yet.
  await ensureAuthUserId();
  const state = await getAuthState();

  if (state.isAnonymous) {
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: redirectTo() },
    );

    if (!error) return { kind: "linked", verifyType: "email_change" };

    // Supabase reports a taken address differently across versions; match on
    // the code and the message rather than trusting either alone.
    const taken =
      error.code === "email_exists" ||
      /already (been )?registered|already exists/i.test(error.message);

    if (!taken) throw error;

    await signInWithEmail(email);
    return { kind: "already-registered", verifyType: "email" };
  }

  await signInWithEmail(email);
  return { kind: "signed-in", verifyType: "email" };
}

async function signInWithEmail(email: string) {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo() },
  });
  if (error) throw error;
}

/**
 * Google sign-in, and the reason it is the recommended path.
 *
 * Email verification is fundamentally awkward on a phone: whatever arrives has
 * to be carried from a mail app back to a browser, and a tapped link opens in
 * the mail app's own browser rather than the one on screen. OAuth starts in the
 * browser the learner is already using and comes back to it, so the session
 * lands where they are looking. No email, no code, no rate limit, no spam
 * folder.
 *
 * For an anonymous browser this *links* Google to the existing user, so the
 * practice already recorded here survives. If that fails the caller is told
 * rather than quietly signed in as somebody else — a silent fallback would
 * abandon real history.
 */
export class GoogleLinkBlockedError extends Error {
  constructor(readonly detail: string) {
    super(
      "無法把 Google 帳號綁到這個瀏覽器的紀錄上。" +
        "可能這個 Google 帳號已經有另一組紀錄，或專案沒有開啟手動綁定。",
    );
    this.name = "GoogleLinkBlockedError";
  }
}

/**
 * Whether this anonymous browser has anything worth carrying into an account.
 *
 * Row level security scopes both counts to the current user, so there is no
 * owner filter — and no way to see anybody else's totals.
 */
async function anonymousHasHistory(): Promise<boolean> {
  const supabase = requireSupabase();

  const [sessions, topics] = await Promise.all([
    supabase.from("sessions").select("id", { count: "exact", head: true }),
    supabase.from("topics").select("id", { count: "exact", head: true }),
  ]);

  return (sessions.count ?? 0) > 0 || (topics.count ?? 0) > 0;
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = requireSupabase();

  // There has to be a user before there is anything to link to.
  await ensureAuthUserId();
  const state = await getAuthState();

  /**
   * Linking exists for one reason: to keep practice recorded before signing in.
   * With nothing recorded it is pure cost — a round trip through Google that can
   * come back refused because the address already has an account, which is not
   * something the learner can act on and not a choice worth showing them. So an
   * empty browser signs in the ordinary way and the question never comes up.
   */
  if (state.isAnonymous && (await anonymousHasHistory())) {
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    // On success the browser is already navigating to Google.
    if (!error) return;

    throw new GoogleLinkBlockedError(error.message);
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectTo() },
  });
  if (error) throw error;
}

/**
 * Google sign-in that does not try to keep this browser's anonymous history.
 *
 * Only offered after linking has already failed, and only behind a warning:
 * the rows recorded here belong to an auth user this sign-in walks away from,
 * and row level security will hide them afterwards.
 */
export async function signInWithGoogleFresh(): Promise<void> {
  const supabase = requireSupabase();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectTo() },
  });
  if (error) throw error;
}

/**
 * Completes sign-in with the code from the email, in this browser.
 *
 * The link in the same email also works, but on a phone it usually does not:
 * tapping it from a mail app opens the mail app's own browser, which is not
 * the one the learner was using. That browser gets the session and the one on
 * screen stays anonymous, so the app keeps asking for an email that has in
 * fact already been verified — repeatedly, which is what this fixes.
 *
 * `verifyType` comes from `requestMagicLink`, but the other type is tried too:
 * asking for a code twice through different paths is easy to do, and the older
 * email is the one people tend to reach for.
 */
export async function verifyCode(
  email: string,
  code: string,
  verifyType: VerifyType,
): Promise<void> {
  const supabase = requireSupabase();
  const token = code.replace(/\D/g, "");

  if (!token) throw new Error("請輸入信件中的驗證碼。");

  const { error } = await supabase.auth.verifyOtp({ email, token, type: verifyType });
  if (!error) return;

  const other: VerifyType =
    verifyType === "email" ? "email_change" : "email";
  const { error: retryError } = await supabase.auth.verifyOtp({
    email,
    token,
    type: other,
  });

  if (retryError) {
    throw new Error("驗證碼不正確或已過期，請重新寄送一次。");
  }
}

/**
 * The caller's Supabase access token, for authenticating requests to our own
 * API routes. Creates an anonymous session if there isn't one yet, so a
 * first-time visitor can still reach the voice gate and be told about the
 * trial limits rather than a login error.
 */
export async function getAccessToken(): Promise<string> {
  const supabase = requireSupabase();
  await ensureAuthUserId();

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("尚未建立登入狀態。");

  return token;
}

export async function signOut() {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
