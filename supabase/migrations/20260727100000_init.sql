-- P1 Driving English Coach — initial schema (Phase 2)
--
-- Mirrors the data model in docs/04-technical-architecture.md and the domain
-- types in types/index.ts. Those three must stay in sync.
--
-- Ownership model: every row belongs to a row in auth.users, including rows
-- created in anonymous demo mode — Supabase anonymous sign-in issues a real
-- auth.uid(), so `user_id` is NOT NULL and RLS can actually protect it. A
-- nullable owner would leave transcripts readable by anyone with the anon key.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
-- Empty search_path so the function can't be hijacked by a shadowing schema.
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- user_profiles
-- ---------------------------------------------------------------------------

create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  english_level text not null default 'intermediate'
    check (english_level in ('basic', 'intermediate', 'advanced')),
  interests text[] not null default '{}',
  preferred_topics text[] not null default '{}',
  preferred_feedback_style text not null default 'gentle'
    check (preferred_feedback_style in ('gentle', 'direct')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  topic text not null,
  -- 5–60 minutes in 5-minute steps, matching the launcher wheel and
  -- SessionDuration in types/index.ts.
  duration_minutes smallint not null
    check (duration_minutes between 5 and 60 and duration_minutes % 5 = 0),
  level text not null check (level in ('basic', 'intermediate', 'advanced')),

  -- Same union as SessionStatus so the client state machine can write its
  -- state straight through without a second vocabulary.
  status text not null default 'idle' check (status in (
    'idle', 'connecting', 'listening', 'ai_speaking',
    'paused', 'ending', 'completed', 'error'
  )),

  started_at timestamptz not null default now(),
  ended_at timestamptz,

  -- Array of { role, text, at }. Written incrementally during the session —
  -- docs/04 is explicit that we must not rely on end-of-session persistence.
  -- Raw audio is never stored; see docs/07.
  transcript jsonb not null default '[]'::jsonb
    check (jsonb_typeof(transcript) = 'array'),

  summary text,
  -- Review output that is 1:1 with the session. Kept as columns rather than a
  -- fifth table: they are short, always read with the session, and never
  -- queried on their own.
  alternatives text[] not null default '{}',
  next_recommendation text,

  -- Coarse 0–100 indicators, not precise scoring. See docs/07.
  score_overall smallint check (score_overall between 0 and 100),
  score_fluency smallint check (score_fluency between 0 and 100),
  score_clarity smallint check (score_clarity between 0 and 100),
  score_vocab smallint check (score_vocab between 0 and 100),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sessions_ended_after_started
    check (ended_at is null or ended_at >= started_at)
);

-- The dashboard's only read pattern: this user's sessions, newest first.
create index sessions_user_started_idx
  on public.sessions (user_id, started_at desc);

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- feedback_items
-- ---------------------------------------------------------------------------

create table public.feedback_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  type text not null
    check (type in ('grammar', 'word_choice', 'pronunciation', 'fluency')),
  original_text text not null,
  improved_text text not null,
  explanation text not null,
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

create index feedback_items_session_idx
  on public.feedback_items (session_id);

-- ---------------------------------------------------------------------------
-- vocabulary_items
-- ---------------------------------------------------------------------------

create table public.vocabulary_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  phrase text not null,
  meaning_zh text not null,
  example_en text not null,
  category text not null default 'general',
  created_at timestamptz not null default now()
);

create index vocabulary_items_session_idx
  on public.vocabulary_items (session_id);

-- ---------------------------------------------------------------------------
-- row level security
--
-- The app talks to Postgres directly from the browser with the anon key, so
-- RLS is the only thing standing between users. Every table is deny-by-default
-- and scoped to the owning auth.uid().
--
-- `(select auth.uid())` rather than a bare `auth.uid()`: the subquery form is
-- evaluated once per statement instead of once per row.
-- ---------------------------------------------------------------------------

alter table public.user_profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.feedback_items enable row level security;
alter table public.vocabulary_items enable row level security;

create policy "own profile" on public.user_profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "own sessions" on public.sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Child rows inherit ownership from their session.
create policy "own feedback items" on public.feedback_items
  for all to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = feedback_items.session_id
        and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = feedback_items.session_id
        and s.user_id = (select auth.uid())
    )
  );

create policy "own vocabulary items" on public.vocabulary_items
  for all to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = vocabulary_items.session_id
        and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = vocabulary_items.session_id
        and s.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- profile bootstrap
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
