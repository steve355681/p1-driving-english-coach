-- ---------------------------------------------------------------------------
-- Three review intervals instead of six
--
-- The schedule was 0/1/3/7/14/30 days. It is now 1/7/30 — a day, a week, a
-- month, which is where the forgetting curve actually bends and as much as
-- anyone can hold in their head. Six stages also meant six taps before a
-- phrase left the wall, and the wall is meant to empty.
--
-- Written to be safe whether or not 20260729090000_vocabulary_review.sql has
-- already been applied: the columns are added if missing, and the old
-- constraint is dropped only if it exists.
-- ---------------------------------------------------------------------------

alter table public.vocabulary_items
  add column if not exists review_stage smallint not null default 0,
  add column if not exists last_reviewed_at timestamptz;

alter table public.vocabulary_items
  drop constraint if exists vocabulary_items_review_stage_check;

-- Anything past the new ceiling has finished the schedule under either set of
-- intervals, so clamping it to "done" loses nothing.
update public.vocabulary_items
  set review_stage = 3
  where review_stage > 3;

alter table public.vocabulary_items
  add constraint vocabulary_items_review_stage_check
  check (review_stage between 0 and 3);

drop index if exists public.vocabulary_items_unreviewed_idx;

create index vocabulary_items_unreviewed_idx
  on public.vocabulary_items (session_id)
  where review_stage < 3;
