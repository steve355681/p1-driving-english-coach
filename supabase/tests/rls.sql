-- Schema tests: row level security, check constraints, triggers, cascades.
--
-- RLS is the only thing separating users — the browser talks to PostgREST
-- directly with a public anon key — and a missing policy leaks data silently
-- rather than raising an error. So the isolation checks below are not optional
-- extras; re-run them whenever a table or policy changes.
--
-- Runs against a plain Postgres with a stand-in `auth` schema, so it needs no
-- Supabase project. See supabase/README.md for the command.

\set ON_ERROR_STOP off
\pset pager off

-- ---------------------------------------------------------------------------
-- stand-in for the parts of Supabase's auth schema the migration depends on
-- ---------------------------------------------------------------------------

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  is_anonymous boolean not null default false
);

-- Supabase reads the subject from the request JWT; here it comes from a GUC
-- the tests set, which mirrors how the real implementation works.
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant usage on schema public to anon, authenticated;

\ir ../migrations/20260727100000_init.sql
\ir ../migrations/20260728090000_voice_entitlements.sql

-- Supabase grants these to anon/authenticated out of the box; the stub has to
-- match, or every statement below fails on table permissions before RLS is
-- ever consulted — which would make the isolation tests pass for the wrong
-- reason.
grant all on all tables in schema public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- two anonymous users, as anonymous sign-in would create them
-- ---------------------------------------------------------------------------

insert into auth.users (id, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', true),
  ('22222222-2222-2222-2222-222222222222', true);

\echo '--- T1: signup trigger created a profile per user (expect 2)'
select count(*) as profiles from public.user_profiles;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

\echo '--- T2: A creates a session'
insert into public.sessions (user_id, topic, duration_minutes, level)
values ('11111111-1111-1111-1111-111111111111', 'Work & Career', 15, 'intermediate');

insert into public.feedback_items (session_id, type, original_text, improved_text, explanation)
select id, 'grammar', 'I am go', 'I go', 'present simple' from public.sessions limit 1;

\echo '--- T3: A sees their own rows (expect 1, 1)'
select count(*) as a_sessions from public.sessions;
select count(*) as a_feedback from public.feedback_items;

\echo '--- T4: A cannot create a session owned by B (expect RLS error)'
insert into public.sessions (user_id, topic, duration_minutes, level)
values ('22222222-2222-2222-2222-222222222222', 'Hijack', 15, 'basic');

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

\echo '--- T5: B sees none of As rows (expect 0, 0)'
select count(*) as b_sees_sessions from public.sessions;
select count(*) as b_sees_feedback from public.feedback_items;

\echo '--- T6: B cannot update As session (expect UPDATE 0)'
update public.sessions set summary = 'stolen';

\echo '--- T7: B cannot delete As session (expect DELETE 0)'
delete from public.sessions;

\echo '--- T8: B sees only their own profile (expect 1)'
select count(*) as b_profiles from public.user_profiles;

reset role;
\echo '--- T9: As data survived (expect 1 session, 0 summaries)'
select count(*) as still_there, count(summary) as summaries from public.sessions;

-- ---------------------------------------------------------------------------
-- constraints
-- ---------------------------------------------------------------------------

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

\echo '--- C1: duration off the 5-minute grid (7) -- expect reject'
insert into public.sessions (user_id, topic, duration_minutes, level)
values ('11111111-1111-1111-1111-111111111111','x',7,'basic');

\echo '--- C2: duration over the max (65) -- expect reject'
insert into public.sessions (user_id, topic, duration_minutes, level)
values ('11111111-1111-1111-1111-111111111111','x',65,'basic');

\echo '--- C3: both ends of the grid (5, 60) -- expect accept'
insert into public.sessions (user_id, topic, duration_minutes, level)
values ('11111111-1111-1111-1111-111111111111','x',5,'basic'),
       ('11111111-1111-1111-1111-111111111111','x',60,'advanced');

\echo '--- C4: unknown level -- expect reject'
insert into public.sessions (user_id, topic, duration_minutes, level)
values ('11111111-1111-1111-1111-111111111111','x',15,'fluent');

\echo '--- C5: unknown status -- expect reject'
insert into public.sessions (user_id, topic, duration_minutes, level, status)
values ('11111111-1111-1111-1111-111111111111','x',15,'basic','driving');

\echo '--- C6: score out of range (101) -- expect reject'
insert into public.sessions (user_id, topic, duration_minutes, level, score_overall)
values ('11111111-1111-1111-1111-111111111111','x',15,'basic',101);

\echo '--- C7: ended_at before started_at -- expect reject'
insert into public.sessions (user_id, topic, duration_minutes, level, started_at, ended_at)
values ('11111111-1111-1111-1111-111111111111','x',15,'basic', now(), now() - interval '1 hour');

\echo '--- C8: transcript must be an array -- expect reject'
insert into public.sessions (user_id, topic, duration_minutes, level, transcript)
values ('11111111-1111-1111-1111-111111111111','x',15,'basic','{"a":1}'::jsonb);

\echo '--- C9: updated_at trigger fires (expect t)'
update public.sessions set summary = 'touched' where duration_minutes = 5;
select updated_at > created_at as updated_at_moved
from public.sessions where duration_minutes = 5;

-- ---------------------------------------------------------------------------
-- voice entitlements: a privilege table, so the interesting case is whether the
-- user it restricts can raise it
-- ---------------------------------------------------------------------------

reset role;
insert into public.voice_entitlements (user_id, note)
values ('22222222-2222-2222-2222-222222222222', 'owner');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

\echo '--- V1: A cannot grant themselves full access -- expect reject'
insert into public.voice_entitlements (user_id, tier)
values ('11111111-1111-1111-1111-111111111111', 'full');

\echo '--- V2: A cannot upgrade an existing row -- expect UPDATE 0'
update public.voice_entitlements set tier = 'full';

\echo '--- V3: A cannot delete Bs entitlement -- expect DELETE 0'
delete from public.voice_entitlements;

\echo '--- V4: A cannot even see Bs entitlement (expect 0)'
select count(*) as visible from public.voice_entitlements;

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
\echo '--- V5: B sees their own entitlement (expect 1, full)'
select count(*) as visible, max(tier) as tier from public.voice_entitlements;

reset role;
\echo '--- C10: deleting the auth user cascades (expect 0, 0, 0)'
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select
  (select count(*) from public.sessions)       as sessions,
  (select count(*) from public.feedback_items) as feedback,
  (select count(*) from public.user_profiles
     where id = '11111111-1111-1111-1111-111111111111') as profile;
