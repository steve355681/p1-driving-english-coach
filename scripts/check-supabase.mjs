/**
 * Preflight for a Supabase project.
 *
 * Checks the three things that have to be true before Phase 3 can persist
 * anything, and says which one is wrong rather than surfacing a raw Postgres
 * error:
 *   1. the migration has been applied
 *   2. anonymous sign-ins are enabled
 *   3. row level security isolates one anonymous user from another
 *
 * Run:  npm run check:supabase
 *
 * It creates one throwaway session row and deletes it again.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * A UTF-8 BOM makes the first variable in the file parse as "﻿NEXT_..."
 * instead of "NEXT_...", so it silently goes missing. Easy to hit on Windows —
 * PowerShell's `Set-Content -Encoding utf8` writes one — and the resulting
 * "not set" message points nowhere near the cause.
 */
function hasBom(path) {
  try {
    const head = readFileSync(path).subarray(0, 3);
    return head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf;
  } catch {
    return false;
  }
}

const pass = (m) => console.log(`  ok    ${m}`);
const fail = (m, hint) => {
  console.log(`  FAIL  ${m}`);
  if (hint) console.log(`        ${hint}`);
  process.exitCode = 1;
};

if (!url || !key) {
  if (hasBom(".env.local")) {
    console.log(
      "\n.env.local starts with a UTF-8 BOM, so the first variable in it is\n" +
        "not being read.\n\n" +
        "Re-save it as UTF-8 without BOM. In Notepad: File > Save as, set\n" +
        "Encoding to UTF-8 (not 'UTF-8 with BOM'). In VS Code: click the\n" +
        "encoding in the status bar > Save with Encoding > UTF-8.\n",
    );
  } else {
    console.log(
      "\nNEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.\n" +
        "Put them in .env.local — see .env.example.\n",
    );
  }
  process.exit(1);
}

console.log(`\nChecking ${url}\n`);

const clientA = createClient(url, key);
const clientB = createClient(url, key);

// --- 1. anonymous sign-in -----------------------------------------------
const signInA = await clientA.auth.signInAnonymously();

if (signInA.error) {
  const message = signInA.error.message ?? "";
  fail(
    `anonymous sign-in: ${message}`,
    /disabled|not enabled/i.test(message)
      ? "Enable it: Authentication -> Sign In / Providers -> Anonymous."
      : "Check the project URL and key.",
  );
  process.exit(1);
}

const userA = signInA.data.user.id;
pass(`anonymous sign-in works (user ${userA.slice(0, 8)}…)`);

// --- 2. schema + insert --------------------------------------------------
const insert = await clientA
  .from("sessions")
  .insert({
    user_id: userA,
    topic: "__preflight__",
    duration_minutes: 15,
    level: "intermediate",
  })
  .select()
  .single();

if (insert.error) {
  const { code, message } = insert.error;
  const hint =
    code === "42P01"
      ? "Table missing — apply supabase/migrations/ in the SQL editor."
      : code === "42501"
        ? "Blocked by RLS. Check the 'own sessions' policy was created."
        : undefined;
  fail(`create a session: ${message}`, hint);
  process.exit(1);
}

const sessionId = insert.data.id;
pass("schema is applied and a session can be created");

// --- 3. the owner can read it back --------------------------------------
const readBack = await clientA
  .from("sessions")
  .select()
  .eq("id", sessionId)
  .maybeSingle();

if (readBack.error || !readBack.data) {
  fail("owner can read their own session", readBack.error?.message);
} else {
  pass("owner can read their own session");
}

// --- 4. a different anonymous user cannot -------------------------------
const signInB = await clientB.auth.signInAnonymously();

if (signInB.error) {
  fail(`second anonymous sign-in: ${signInB.error.message}`);
} else {
  const leak = await clientB
    .from("sessions")
    .select()
    .eq("id", sessionId)
    .maybeSingle();

  if (leak.data) {
    fail(
      "another user could read this session",
      "RLS is not isolating users. Do not put real data in this project " +
        "until the policies in supabase/migrations/ are applied.",
    );
  } else {
    pass("another anonymous user cannot read it (RLS is working)");
  }
}

// --- cleanup -------------------------------------------------------------
const cleanup = await clientA.from("sessions").delete().eq("id", sessionId);
if (cleanup.error) {
  console.log(
    `\n  note  could not delete the test row ${sessionId}: ${cleanup.error.message}`,
  );
}

console.log(
  process.exitCode
    ? "\nSomething is not set up correctly — see above.\n"
    : "\nAll good. Phase 3 can persist to this project.\n",
);
