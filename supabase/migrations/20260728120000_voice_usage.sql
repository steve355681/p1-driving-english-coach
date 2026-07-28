-- Metered voice grants (Phase 4b).
--
-- Every ephemeral token handed out is recorded here, and the quota is computed
-- from these rows. That makes this table the thing standing between a curious
-- visitor and an unbounded OpenAI bill.
--
-- So, like voice_entitlements, it is readable by its owner and writable by
-- nobody: PostgREST offers no insert, update or delete path to anon or
-- authenticated. If users could write here they could delete their own rows and
-- reset their own quota, which is the same escalation as granting themselves a
-- tier. Only the API route writes, using the service role.

create table public.voice_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  /** How many seconds of voice the grant authorised, not how many were used. */
  granted_seconds integer not null check (granted_seconds between 1 and 3600),
  tier text not null check (tier in ('trial', 'full')),
  created_at timestamptz not null default now()
);

-- The quota query is always "this user, since a cutoff".
create index voice_usage_user_created_idx
  on public.voice_usage (user_id, created_at desc);

alter table public.voice_usage enable row level security;

create policy "read own usage" on public.voice_usage
  for select to authenticated
  using ((select auth.uid()) = user_id);
