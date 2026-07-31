/**
 * Shortening pasted notes so the coach's brief stays cheap.
 *
 * The brief is re-billed on every conversational turn, so pasting a whole
 * article would quietly undo the cost work behind choosing the mini model.
 * Notes that came out of a summarising tool are usually already short enough,
 * in which case nothing happens and nothing is spent.
 */

import { TOPIC_CONDENSE_THRESHOLD } from "@/lib/constants";

/**
 * A cheap text model; this is a summarising job, not a reasoning one.
 *
 * Kept in step with `REVIEW_MODEL` — same reasoning, same fallback. Notes are
 * condensed once when a topic is saved, so this runs far less often than
 * anything else here.
 */
export const CONDENSE_MODEL = "gpt-5.6-luna";
export const CONDENSE_MODEL_FALLBACK = "gpt-4o-mini";

export function needsCondensing(notes: string) {
  return notes.trim().length > TOPIC_CONDENSE_THRESHOLD;
}

export const CONDENSE_PROMPT = [
  "You are preparing notes for an English speaking coach to run a conversation from.",
  "",
  `Rewrite the material below in under ${TOPIC_CONDENSE_THRESHOLD} characters.`,
  "",
  "- Keep the specific claims, numbers and names. They are what gives the",
  "  learner something concrete to talk about; generic summaries produce",
  "  generic conversations.",
  "- Keep any tension or disagreement in the material. That is what a",
  "  conversation can actually go somewhere with.",
  "- Write it as notes, not prose. No preamble, no 'this article discusses'.",
  "- Keep the original language of the material.",
].join("\n");

/**
 * Last resort when the model is unavailable.
 *
 * Cutting the end off loses material, but a topic the learner can half use
 * beats an error at the roadside. The caller says so rather than hiding it.
 */
export function truncateNotes(notes: string) {
  const trimmed = notes.trim();
  if (trimmed.length <= TOPIC_CONDENSE_THRESHOLD) return trimmed;

  const cut = trimmed.slice(0, TOPIC_CONDENSE_THRESHOLD);
  // Prefer a sentence or line boundary so the brief does not end mid-word.
  const boundary = Math.max(
    cut.lastIndexOf("\n"),
    cut.lastIndexOf("。"),
    cut.lastIndexOf(". "),
  );
  return boundary > TOPIC_CONDENSE_THRESHOLD * 0.6
    ? cut.slice(0, boundary + 1)
    : cut;
}
