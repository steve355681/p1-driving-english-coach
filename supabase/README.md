# Supabase

Schema for P1 Driving English Coach. Mirrors `docs/04-technical-architecture.md`.

## Tables
| Table | Holds |
| --- | --- |
| `user_profiles` | level, interests, feedback style. Created automatically on sign-up by a trigger on `auth.users`. |
| `sessions` | one practice session: settings, status, transcript, summary, scores |
| `feedback_items` | corrections for a session |
| `vocabulary_items` | phrases worth keeping from a session |

## Setup

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migration — either paste `migrations/20260727100000_init.sql` into
   the SQL editor, or with the CLI:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
3. **Enable anonymous sign-ins**: Authentication → Sign In / Providers →
   Anonymous. Without this the app cannot create sessions — see below.
4. Copy the project URL and anon key into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

Then check all three steps landed:

```bash
npm run check:supabase
```

It signs in anonymously, creates a throwaway session, confirms a second
anonymous user cannot read it, and deletes it again — so it catches a missing
migration, a disabled Anonymous provider, and broken RLS separately rather than
as one opaque error later.

The app runs fine without any of this — it stays on placeholder data and shows
a 示範資料 badge. See `isSupabaseConfigured()` in `lib/supabase/client.ts`.

## Why anonymous sign-in rather than a nullable owner

`docs/07` picks anonymous demo mode over auth-first. The naive way to do that is
to leave `sessions.user_id` null until someone signs up — but a null owner
cannot be expressed in a row level security policy, so every anonymous
transcript would be readable by anyone holding the anon key, which is public by
design.

Supabase anonymous sign-in issues a real `auth.users` row and a real
`auth.uid()`, so `user_id` is `NOT NULL` and RLS works normally. Adding a real
identity later links to the same user, so no rows need migrating.

## Row level security

Every table is RLS-enabled and deny-by-default, scoped to the owning
`auth.uid()`. `feedback_items` and `vocabulary_items` inherit ownership from
their session.

RLS is the only thing separating users here: the browser talks to PostgREST
directly with the anon key, so a missing policy is a data leak, not a bug that
surfaces as an error. If you add a table, enable RLS on it in the same
migration.

## Testing the schema

`tests/rls.sql` exercises the policies, constraints, triggers and cascades
against a plain Postgres — no Supabase project needed. It stubs the parts of
the `auth` schema the migration depends on, then applies the migration.

Run it against a **fresh** database (the migration is not idempotent):

```bash
createdb schema_test
psql -d schema_test -f tests/rls.sql
```

Expect exactly 8 errors, each one directly under a line marked
`expect reject` / `expect RLS error`. Any other error is a real failure. The
counted assertions print their expected value in the label.

Worth re-running on any change to a table or policy: a missing policy does not
raise an error, it just returns other people's rows.

## Keeping types in sync

`types/database.ts` is hand-written and must match these migrations. Once the
CLI is set up locally, replace it:

```bash
supabase gen types typescript --linked > types/database.ts
```

Note that generated output uses `type` aliases, not `interface` — that matters,
and the file explains why.
