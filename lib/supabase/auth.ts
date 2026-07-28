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

export type SignInOutcome =
  | { kind: "linked" }
  | { kind: "signed-in" }
  /** The address already belongs to another account. */
  | { kind: "already-registered" };

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

    if (!error) return { kind: "linked" };

    // Supabase reports a taken address differently across versions; match on
    // the code and the message rather than trusting either alone.
    const taken =
      error.code === "email_exists" ||
      /already (been )?registered|already exists/i.test(error.message);

    if (!taken) throw error;

    await signInWithEmail(email);
    return { kind: "already-registered" };
  }

  await signInWithEmail(email);
  return { kind: "signed-in" };
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
