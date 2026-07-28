-- Who is allowed to spend money on voice (Phase 4a).
--
-- Deliberately NOT a column on user_profiles: that table's policy is `for all`,
-- so a user can update their own row. A privilege stored there could be raised
-- by the user it restricts — one PATCH to /rest/v1/user_profiles and anyone has
-- unlimited access to a metered API.
--
-- This table has a SELECT policy and nothing else. PostgREST refuses anything
-- without a matching policy, so there is no insert, update or delete path for
-- anon or authenticated at all. Access is granted from the SQL editor or with
-- the service role, both of which bypass RLS.

create table public.voice_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- 'trial' is also the default for anyone with no row here, so granting is an
  -- insert and revoking is a delete.
  tier text not null default 'full' check (tier in ('trial', 'full')),
  note text,
  created_at timestamptz not null default now()
);

alter table public.voice_entitlements enable row level security;

create policy "read own entitlement" on public.voice_entitlements
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Grant yourself full access after signing in:
--
--   insert into public.voice_entitlements (user_id, note)
--   select id, 'owner' from auth.users where email = 'you@example.com';
