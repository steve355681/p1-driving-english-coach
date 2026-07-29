import type { EnglishLevel, FeedbackType, TranscriptTurn } from "@/types";

/**
 * Turning a transcript into the after-drive review (FR-4).
 *
 * A text model, not the realtime one: the conversation is over, nobody is
 * waiting on a response, and the input is already text. This is the cheap half
 * of the product — a whole review costs a fraction of a cent against roughly
 * $0.33 for the drive itself.
 */

/**
 * The single lever on review quality.
 *
 * Same family as the condensing model, for the same reason: this is extraction
 * and rewriting, not reasoning. If real reviews turn out shallow, moving to a
 * stronger model here is a one-line change that costs roughly $0.02 a session
 * instead of $0.001 — still small next to the voice bill.
 */
export const REVIEW_MODEL = "gpt-4o-mini";

/**
 * A 60-minute session can produce more transcript than the review needs. The
 * cap is generous enough that a normal commute is never trimmed; when it does
 * bite, the most recent turns are kept, since those are the ones the learner
 * still remembers.
 */
export const TRANSCRIPT_MAX_CHARS = 24000;

export const MAX_CORRECTIONS = 3;
export const MAX_ALTERNATIVES = 5;
export const MAX_VOCABULARY = 5;

/**
 * What the model may pick from — the whole of `FeedbackType`.
 *
 * This list once existed to hold `pronunciation` out. It is now the full set,
 * because pronunciation left the product rather than just this schema: see the
 * decision in `docs/07`. Kept as its own constant so the JSON schema below and
 * the domain type cannot drift apart silently.
 */
export const REVIEW_FEEDBACK_TYPES = [
  "grammar",
  "word_choice",
  "fluency",
] as const satisfies readonly FeedbackType[];

/**
 * The response shape, enforced by the API in strict mode.
 *
 * Strict mode does not support `maxItems`, so the counts live in the prompt and
 * are enforced again in code. That split is deliberate: a guaranteed *shape* is
 * worth more here than a guaranteed length, because a wrong shape breaks
 * parsing while a long list is just trimmed.
 */
export const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "corrections",
    "alternatives",
    "vocabulary",
    "nextRecommendation",
  ],
  properties: {
    summary: {
      type: "string",
      description:
        "Two or three sentences in Traditional Chinese: what the learner " +
        "talked about, and what stood out about how they said it.",
    },
    corrections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "type",
          "originalText",
          "improvedText",
          "explanation",
          "severity",
        ],
        properties: {
          type: { type: "string", enum: REVIEW_FEEDBACK_TYPES },
          originalText: {
            type: "string",
            description: "What the learner actually said, quoted verbatim.",
          },
          improvedText: {
            type: "string",
            description: "The same idea said correctly and naturally.",
          },
          explanation: {
            type: "string",
            description: "One sentence in Traditional Chinese saying why.",
          },
          severity: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
    alternatives: {
      type: "array",
      items: { type: "string" },
      description:
        "Better ways to say things the learner reached for. English only.",
    },
    vocabulary: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["phrase", "meaningZh", "exampleEn", "category"],
        properties: {
          phrase: { type: "string" },
          meaningZh: { type: "string" },
          exampleEn: {
            type: "string",
            description: "One short sentence using the phrase.",
          },
          category: {
            type: "string",
            description: "A one- or two-word Traditional Chinese label.",
          },
        },
      },
    },
    nextRecommendation: {
      type: "string",
      description:
        "One or two sentences in Traditional Chinese: what to practise next " +
        "time, and why.",
    },
  },
} as const;

/**
 * Renders the transcript for the model.
 *
 * Roles are labelled rather than left implicit because almost everything the
 * review says is about the learner's turns specifically — quoting the coach
 * back as a learner mistake would be worse than saying nothing.
 */
export function formatTranscript(turns: TranscriptTurn[]) {
  const lines = turns.map(
    (turn) => `${turn.role === "user" ? "LEARNER" : "COACH"}: ${turn.text}`,
  );

  const text = lines.join("\n");
  if (text.length <= TRANSCRIPT_MAX_CHARS) return text;

  return text.slice(text.length - TRANSCRIPT_MAX_CHARS);
}

export function reviewPrompt(input: {
  topic: string;
  level: EnglishLevel;
  transcript: string;
}) {
  return [
    "You are reviewing an English speaking practice session for a learner",
    "whose first language is Traditional Chinese.",
    "",
    `The topic was: ${input.topic}.`,
    `The learner has set their level to CEFR ${input.level}. Judge them`,
    "against that level, not against a native speaker.",
    "",
    "Read the transcript and produce the review.",
    "",
    "How to read the transcript:",
    "- It came from automatic speech recognition, so it is imperfect. Some of",
    "  what looks like a mistake is the transcriber mis-hearing a word that was",
    "  said correctly. Only report something as a mistake when it is clearly a",
    "  language error and not a plausible mis-transcription.",
    "- Only the LEARNER lines are the learner's English. Never quote a COACH",
    "  line as something the learner needs to fix.",
    "- Quote the learner verbatim in originalText. Do not tidy it up first, and",
    "  do not invent a sentence they did not say.",
    "",
    "What to produce:",
    `- At most ${MAX_CORRECTIONS} corrections — the ones worth the learner's`,
    "  attention, not the first ones you find. Prefer a mistake they made more",
    "  than once, or one that made them hard to understand.",
    `- At most ${MAX_ALTERNATIVES} better phrasings, drawn from moments where`,
    "  they were understood but said it awkwardly or unnaturally.",
    `- At most ${MAX_VOCABULARY} words or phrases worth remembering, chosen for`,
    "  this topic and this level. They may be words the learner reached for and",
    "  could not find.",
    "- A summary and a recommendation for next time, both in Traditional",
    "  Chinese.",
    "",
    "If the learner barely spoke, return fewer items or none at all. An honest",
    "short review is more useful than a padded one, and inventing mistakes to",
    "fill three slots teaches the wrong thing.",
    "",
    "Write every explanation in Traditional Chinese. Keep English text in",
    "English — the phrases, the corrections and the examples are what the",
    "learner practises.",
    "",
    "--- transcript ---",
    input.transcript,
    "--- end of transcript ---",
  ].join("\n");
}
