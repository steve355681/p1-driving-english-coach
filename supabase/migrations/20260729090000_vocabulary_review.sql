-- ---------------------------------------------------------------------------
-- Spaced review for the expression wall
--
-- The wall used to be a flat list of everything the reviews ever collected,
-- which gets less useful with every session — the phrases worth revisiting are
-- buried under the ones already known. These two columns turn it into a
-- schedule: each phrase surfaces again on the Ebbinghaus intervals in
-- `lib/progress/rhythm.ts`, and leaves the wall once it has been through all of
-- them.
--
-- No new table. Progress lives on the row the review already created, and the
-- existing row level security policy on vocabulary_items (ownership through
-- sessions) covers the update path unchanged.
-- ---------------------------------------------------------------------------

alter table public.vocabulary_items
  -- 0 = never reviewed. The upper bound is the number of intervals, at which
  -- point the phrase is done and drops off the wall; keep it in step with
  -- REVIEW_INTERVALS_DAYS.
  add column review_stage smallint not null default 0
    check (review_stage between 0 and 6),
  -- Null until the first review. `created_at` is the anchor before then, so a
  -- phrase is scheduled from the moment it was collected.
  add column last_reviewed_at timestamptz;

-- The wall reads every unfinished phrase for the user on each dashboard load.
create index vocabulary_items_unreviewed_idx
  on public.vocabulary_items (session_id)
  where review_stage < 6;
