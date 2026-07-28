-- Tests the basic/intermediate/advanced -> CEFR migration against rows that
-- already exist, which is the only situation where it can lose anything.
--
-- Run against a fresh database:
--   createdb cefr_test && psql -d cefr_test -f tests/cefr-migration.sql

\set ON_ERROR_STOP off
\pset pager off

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  is_anonymous boolean not null default false
);
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public to anon, authenticated;

\ir ../migrations/20260727100000_init.sql

-- Sessions recorded before the change, one per old band.
insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111');

insert into public.sessions (user_id, topic, duration_minutes, level, summary)
values
  ('11111111-1111-1111-1111-111111111111', 'Travel', 10, 'basic', 'keep me'),
  ('11111111-1111-1111-1111-111111111111', 'Work & Career', 15, 'intermediate', 'keep me'),
  ('11111111-1111-1111-1111-111111111111', 'Opinions', 20, 'advanced', 'keep me');

\echo '--- M0: three sessions exist beforehand (expect 3)'
select count(*) as before from public.sessions;

\echo '--- M1: the profile default is the old value (expect intermediate)'
select english_level as profile_level from public.user_profiles;

\ir ../migrations/20260728150000_cefr_levels.sql

\echo '--- M2: nothing was lost (expect 3, and every summary intact)'
select count(*) as after, count(summary) as summaries from public.sessions;

\echo '--- M3: each band mapped to the middle of its range'
select topic, level from public.sessions order by duration_minutes;
-- expect Travel=A2, Work & Career=B1, Opinions=C1

\echo '--- M4: the existing profile was migrated too (expect B1)'
select english_level as profile_level from public.user_profiles;

\echo '--- M5: no old value survives anywhere (expect 0)'
select count(*) as stragglers from public.sessions
where level in ('basic', 'intermediate', 'advanced');

\echo '--- M6: the new constraint rejects an old value -- expect reject'
insert into public.sessions (user_id, topic, duration_minutes, level)
values ('11111111-1111-1111-1111-111111111111', 'x', 15, 'intermediate');

\echo '--- M7: every CEFR level is accepted -- expect accept'
insert into public.sessions (user_id, topic, duration_minutes, level)
values
  ('11111111-1111-1111-1111-111111111111', 'x', 15, 'A1'),
  ('11111111-1111-1111-1111-111111111111', 'x', 15, 'A2'),
  ('11111111-1111-1111-1111-111111111111', 'x', 15, 'B1'),
  ('11111111-1111-1111-1111-111111111111', 'x', 15, 'B2'),
  ('11111111-1111-1111-1111-111111111111', 'x', 15, 'C1'),
  ('11111111-1111-1111-1111-111111111111', 'x', 15, 'C2');

\echo '--- M8: a new profile defaults to B1 (expect B1)'
insert into auth.users (id) values ('22222222-2222-2222-2222-222222222222');
select english_level as new_profile_default from public.user_profiles
where id = '22222222-2222-2222-2222-222222222222';
