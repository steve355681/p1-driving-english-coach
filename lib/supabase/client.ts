import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Browser Supabase client.
 *
 * Deliberately lazy and optional: `NEXT_PUBLIC_*` values are inlined at build
 * time, and the GitHub Pages build has no Supabase project attached. Creating
 * the client at module scope would break that build, so nothing is constructed
 * until something actually asks for it, and callers can check
 * `isSupabaseConfigured()` to stay on placeholder data instead.
 *
 * There is no server client yet — the Pages deploy is a static export with no
 * route handlers. One arrives with the move to Vercel in Phase 4.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cached: SupabaseClient<Database> | null = null;

export function isSupabaseConfigured() {
  return Boolean(url && anonKey);
}

/** Returns null when the app is running without a Supabase project. */
export function getSupabase() {
  if (!url || !anonKey) return null;
  cached ??= createClient<Database>(url, anonKey);
  return cached;
}

export function requireSupabase() {
  const client = getSupabase();
  if (!client) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    );
  }
  return client;
}

/**
 * Anonymous demo mode (docs/07, open question 1). Signs in anonymously the
 * first time so every row has a real owner for RLS to key off; later sessions
 * reuse the persisted auth session. Linking a real identity on top of the same
 * user is what turns this into a proper account, without migrating rows.
 */
export async function ensureAuthUserId() {
  const supabase = requireSupabase();

  const { data: existing } = await supabase.auth.getSession();
  if (existing.session) return existing.session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error("Anonymous sign-in returned no user.");

  return data.user.id;
}
