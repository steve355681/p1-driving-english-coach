-- Reusable custom topics: notes the learner pastes in and practises against.
--
-- Unlike voice_entitlements and voice_usage, this table carries no privilege
-- and no metering, so its owner gets full read and write. The restriction that
-- matters here is simply that it is theirs.

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  title text not null check (char_length(btrim(title)) between 1 and 120),

  -- What was pasted, kept so it stays editable.
  notes text not null check (char_length(notes) between 1 and 20000),
  -- A shortened version, produced only when `notes` is too long to hand to the
  -- coach directly. Null means the notes are used as they are — which is the
  -- common case for notes that came out of a tool like NotebookLM, and costs
  -- nothing extra.
  brief text,

  -- Denormalised for the list ("練過 2 次"). Can drift if a write is lost;
  -- it is a label, not an accounting record, so that is acceptable.
  use_count integer not null default 0 check (use_count >= 0),
  last_used_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The list is always "mine, most recently practised first".
create index topics_user_recent_idx
  on public.topics (user_id, last_used_at desc nulls last, created_at desc);

create trigger topics_set_updated_at
  before update on public.topics
  for each row execute function public.set_updated_at();

alter table public.topics enable row level security;

create policy "own topics" on public.topics
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Sessions keep their own `topic` text as well as this reference. Deleting a
-- topic must not rewrite history, so the label survives the link.
alter table public.sessions
  add column topic_id uuid references public.topics (id) on delete set null;
