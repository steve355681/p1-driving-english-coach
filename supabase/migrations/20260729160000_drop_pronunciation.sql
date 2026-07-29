-- ---------------------------------------------------------------------------
-- Pronunciation is no longer a kind of feedback this product gives
--
-- Phase 5 stopped offering `pronunciation` to the review model, because from a
-- text transcript there is no way to tell a mispronunciation from a
-- transcription error. Practice then showed the live coach doing the same thing
-- out loud, and being wrong more often than right — the learner had said the
-- word correctly and the recognition had misheard it.
--
-- That settled the product position rather than just the implementation: this
-- app teaches sentence patterns and word choice. Pronunciation work needs a
-- quiet room and audio the model can trust, which is the opposite of a phone on
-- speakerphone in a moving car.
--
-- So the value comes out of the schema too. Leaving it in the constraint would
-- leave the database able to store something the app can no longer produce or
-- display, which is exactly the drift that makes a schema stop being the truth.
-- ---------------------------------------------------------------------------

alter table public.feedback_items
  drop constraint feedback_items_type_check;

-- Should affect zero rows: nothing has ever been able to write this value,
-- since the review's response schema never offered it. Here so the constraint
-- below cannot fail on a database with history this migration cannot see.
update public.feedback_items
  set type = 'word_choice'
  where type = 'pronunciation';

alter table public.feedback_items
  add constraint feedback_items_type_check
  check (type in ('grammar', 'word_choice', 'fluency'));
