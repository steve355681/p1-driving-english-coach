-- Replace basic/intermediate/advanced with CEFR levels (A1–C2).
--
-- Reverses the recommendation in docs/07 to defer CEFR. The reason for
-- deferring was calibration effort, but nothing here calibrates anyone: the
-- learner picks their own level and it only shapes how the coach speaks. The
-- three-band system was too coarse for that — "intermediate" covers learners
-- who need every question rephrased and learners who can argue a position.
--
-- Existing rows are mapped rather than dropped. The bands are wider than CEFR
-- levels, so each maps to the middle of its range: a learner who called
-- themselves "intermediate" is more likely B1 than B2.

-- Order matters: the constraint has to go before the data can be rewritten,
-- and the default has to go before the column's old value is invalid.
alter table public.sessions drop constraint sessions_level_check;
alter table public.user_profiles drop constraint user_profiles_english_level_check;
alter table public.user_profiles alter column english_level drop default;

update public.sessions set level = case level
  when 'basic' then 'A2'
  when 'intermediate' then 'B1'
  when 'advanced' then 'C1'
  else level
end;

update public.user_profiles set english_level = case english_level
  when 'basic' then 'A2'
  when 'intermediate' then 'B1'
  when 'advanced' then 'C1'
  else english_level
end;

alter table public.sessions add constraint sessions_level_check
  check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

alter table public.user_profiles add constraint user_profiles_english_level_check
  check (english_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

alter table public.user_profiles alter column english_level set default 'B1';
