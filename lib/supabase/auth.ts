import { ensureAuthUserId, requireSupabase } from "@/lib/supabase/client";
import type { AuthState } from "@/types";

/** Where the magic link should land. */
function redirectTo() {
  return `${window.location.origin}/settings`;
}

export async function getAuthState(): Promise<AuthState> {
  const supabase = requireSupabase();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;

  if (!user) return { userId: null, email: null, isAnonymous: true };

  return {
    userId: user.id,
    email: user.email ?? null,
    // Supabase marks users created by signInAnonymously; falling back to "no
    // email" covers a session created before the flag existed.
    isAnonymous: user.is_anonymous ?? !user.email,
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
