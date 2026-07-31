import "server-only";

import {
  MAX_ALTERNATIVES,
  MAX_CORRECTIONS,
  MAX_VOCABULARY,
  REVIEW_FEEDBACK_TYPES,
  REVIEW_MODEL,
  REVIEW_MODEL_FALLBACK,
  REVIEW_SCHEMA,
  formatTranscript,
  reviewPrompt,
} from "@/lib/review/config";
import type { ReviewContent } from "@/lib/review/persist";
import type {
  EnglishLevel,
  FeedbackSeverity,
  FeedbackType,
  TranscriptTurn,
} from "@/types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const SEVERITIES: FeedbackSeverity[] = ["low", "medium", "high"];

/**
 * Generates a review from a transcript.
 *
 * The schema is enforced twice: once by the API in strict mode, and again here.
 * The second pass is not redundant — strict mode is a per-model capability, so
 * a model change or an API-side fallback can quietly return free-form JSON, and
 * this content goes straight into the database and then onto the screen as
 * fact. Anything that does not fit the shape is dropped rather than repaired.
 */
export async function generateReview(input: {
  apiKey: string;
  topic: string;
  level: EnglishLevel;
  transcript: TranscriptTurn[];
}): Promise<ReviewContent> {
  let response = await ask(input, REVIEW_MODEL);

  // A renamed or retired model answers 4xx, and this repo cannot reach the API
  // to find out before shipping. Retrying on the previous model turns that into
  // a slightly older review instead of no review at all — which would land
  // after the drive, with the transcript already recorded.
  if (response.status >= 400 && response.status < 500) {
    console.error(
      `Review model ${REVIEW_MODEL} rejected`,
      await response.text(),
    );
    response = await ask(input, REVIEW_MODEL_FALLBACK);
  }

  if (!response.ok) {
    throw new Error(`review model rejected the request: ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("review model returned nothing");

  return coerce(JSON.parse(content) as unknown);
}

function ask(
  input: {
    apiKey: string;
    topic: string;
    level: EnglishLevel;
    transcript: TranscriptTurn[];
  },
  model: string,
) {
  return fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: reviewPrompt({
            topic: input.topic,
            level: input.level,
            transcript: formatTranscript(input.transcript),
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "session_review",
          strict: true,
          schema: REVIEW_SCHEMA,
        },
      },
    }),
  });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function coerce(raw: unknown): ReviewContent {
  const root = (raw ?? {}) as Record<string, unknown>;

  return {
    summary: text(root.summary),
    nextRecommendation: text(root.nextRecommendation),
    alternatives: array(root.alternatives)
      .map(text)
      .filter(Boolean)
      .slice(0, MAX_ALTERNATIVES),
    corrections: array(root.corrections)
      .map(toCorrection)
      .filter((item) => item !== null)
      .slice(0, MAX_CORRECTIONS),
    vocabulary: array(root.vocabulary)
      .map(toVocabulary)
      .filter((item) => item !== null)
      .slice(0, MAX_VOCABULARY),
  };
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toCorrection(value: unknown): ReviewContent["corrections"][number] | null {
  const item = (value ?? {}) as Record<string, unknown>;

  const originalText = text(item.originalText);
  const improvedText = text(item.improvedText);
  // A correction without both halves shows the learner a mistake with no fix,
  // or a fix with nothing to compare it against. Neither is worth a card.
  if (!originalText || !improvedText) return null;

  const type = text(item.type) as FeedbackType;
  const severity = text(item.severity) as FeedbackSeverity;

  return {
    originalText,
    improvedText,
    explanation: text(item.explanation),
    // Unknown values fall back rather than reject: the correction itself is
    // still useful, and these two only drive a label and a colour.
    type: (REVIEW_FEEDBACK_TYPES as readonly string[]).includes(type)
      ? type
      : "grammar",
    severity: SEVERITIES.includes(severity) ? severity : "medium",
  };
}

function toVocabulary(value: unknown): ReviewContent["vocabulary"][number] | null {
  const item = (value ?? {}) as Record<string, unknown>;

  const phrase = text(item.phrase);
  if (!phrase) return null;

  return {
    phrase,
    meaningZh: text(item.meaningZh),
    exampleEn: text(item.exampleEn),
    category: text(item.category),
  };
}
