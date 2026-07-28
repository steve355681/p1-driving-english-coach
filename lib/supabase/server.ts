import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase access, for route handlers only.
 *
 * Two clients, deliberately kept apart:
 *
 * - `userClient` runs as the caller, so row level security still applies. Use
 *   it for anything derived from the request.
 * - `serviceClient` bypasses row level security entirely. It exists for one
 *   thing: writing rows the user must not be able to write, such as usage
 *   records. If users could write those they could delete them and reset their
 *   own quota.
 *
 * `server-only` makes importing this from a client component a build error,
 * rather than a service role key that quietly ships to the browser.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function required(name: string, value: string | undefined) {
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Reads as the caller. Row level security applies. */
export function userClient(accessToken: string) {
  return createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL", url),
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey),
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/** Bypasses row level security. Never expose its results verbatim. */
export function serviceClient() {
  return createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL", url),
    required("SUPABASE_SERVICE_ROLE_KEY", serviceKey),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Resolves the bearer token in an Authorization header to a user, by asking
 * Supabase. Returns null for a missing, malformed or expired token.
 */
export async function getRequestUser(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return null;

  const { data, error } = await userClient(token).auth.getUser(token);
  if (error || !data.user) return null;

  return { id: data.user.id, accessToken: token };
}
