import assert from "node:assert/strict";
import test from "node:test";

import {
  REVIEW_SCHEMA,
  TRANSCRIPT_MAX_CHARS,
  formatTranscript,
  reviewPrompt,
} from "@/lib/review/config";
import { generateReview } from "@/lib/review/generate";

/** Mirrors the documented constraints on strict-mode structured outputs. */
function checkStrict(schema, at = "root") {
  const unsupported = [
    "maxItems",
    "minItems",
    "minLength",
    "maxLength",
    "pattern",
    "minimum",
    "maximum",
    "format",
    "default",
    "oneOf",
    "allOf",
  ];

  for (const key of unsupported) {
    assert.ok(!(key in schema), `${at}: unsupported keyword "${key}"`);
  }

  if (schema.type === "object") {
    assert.equal(
      schema.additionalProperties,
      false,
      `${at}: needs additionalProperties:false`,
    );
    const properties = Object.keys(schema.properties ?? {});
    assert.deepEqual(
      [...(schema.required ?? [])].sort(),
      [...properties].sort(),
      `${at}: every property must be required`,
    );
    for (const [name, child] of Object.entries(schema.properties ?? {})) {
      checkStrict(child, `${at}.${name}`);
    }
  }

  if (schema.type === "array") checkStrict(schema.items, `${at}[]`);
}

function stubFetch(response) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return response;
  };
  return calls;
}

const ok = (content) => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content } }] }),
});

const args = {
  apiKey: "sk-test",
  topic: "Work & Career",
  level: "B1",
  transcript: [
    { role: "user", text: "Yesterday I am waiting for the review.", at: 3 },
    { role: "coach", text: "You were waiting for the review?", at: 6 },
  ],
};

test("the response schema satisfies strict mode", () => {
  checkStrict(REVIEW_SCHEMA);
});

test("transcript labels who spoke and keeps the most recent turns", () => {
  assert.equal(
    formatTranscript(args.transcript),
    "LEARNER: Yesterday I am waiting for the review.\n" +
      "COACH: You were waiting for the review?",
  );

  const long = Array.from({ length: 4000 }, (_, i) => ({
    role: "user",
    text: `turn ${i}`,
    at: i,
  }));
  const capped = formatTranscript(long);
  assert.equal(capped.length, TRANSCRIPT_MAX_CHARS);
  assert.ok(capped.endsWith("LEARNER: turn 3999"));
  assert.ok(!capped.includes("turn 0\n"));
});

test("the prompt carries topic, level and transcript", () => {
  const prompt = reviewPrompt({
    topic: args.topic,
    level: args.level,
    transcript: formatTranscript(args.transcript),
  });
  assert.ok(prompt.includes("Work & Career"));
  assert.ok(prompt.includes("CEFR B1"));
  assert.ok(prompt.includes("LEARNER: Yesterday I am waiting"));
});

test("a well-formed response maps straight through", async () => {
  const calls = stubFetch(
    ok(
      JSON.stringify({
        summary: "  聊了專案進度。  ",
        nextRecommendation: "下次練過去式。",
        alternatives: ["I was held up by the review.", "  "],
        corrections: [
          {
            type: "grammar",
            originalText: "Yesterday I am waiting for the review.",
            improvedText: "Yesterday I was waiting for the review.",
            explanation: "談過去要用過去式。",
            severity: "high",
          },
        ],
        vocabulary: [
          {
            phrase: "held up",
            meaningZh: "被耽擱",
            exampleEn: "The release was held up by the review.",
            category: "工作",
          },
        ],
      }),
    ),
  );

  const result = await generateReview(args);

  assert.equal(result.summary, "聊了專案進度。");
  assert.deepEqual(result.alternatives, ["I was held up by the review."]);
  assert.equal(result.corrections.length, 1);
  assert.equal(result.corrections[0].severity, "high");
  assert.equal(result.vocabulary[0].phrase, "held up");

  assert.equal(calls[0].body.response_format.json_schema.strict, true);
  assert.ok(calls[0].body.messages[0].content.includes("LEARNER:"));
});

test("junk is dropped or clamped, never written through", async () => {
  stubFetch(
    ok(
      JSON.stringify({
        summary: 42,
        nextRecommendation: null,
        alternatives: "not an array",
        corrections: [
          // no improvedText — a mistake with no fix is not worth a card
          { originalText: "I go yesterday", type: "grammar" },
          // unknown type and severity fall back rather than reject
          {
            originalText: "a",
            improvedText: "b",
            type: "telepathy",
            severity: "catastrophic",
          },
          ...Array.from({ length: 6 }, (_, i) => ({
            originalText: `o${i}`,
            improvedText: `i${i}`,
            type: "fluency",
            severity: "low",
          })),
        ],
        vocabulary: [{ meaningZh: "沒有片語" }, { phrase: "keep up" }],
      }),
    ),
  );

  const result = await generateReview(args);

  assert.equal(result.summary, "");
  assert.equal(result.nextRecommendation, "");
  assert.deepEqual(result.alternatives, []);

  assert.equal(result.corrections.length, 3, "clamped to MAX_CORRECTIONS");
  assert.equal(result.corrections[0].originalText, "a", "incomplete one dropped");
  assert.equal(result.corrections[0].type, "grammar");
  assert.equal(result.corrections[0].severity, "medium");

  assert.equal(result.vocabulary.length, 1);
  assert.equal(result.vocabulary[0].phrase, "keep up");
  assert.equal(result.vocabulary[0].exampleEn, "");
});

test("pronunciation is not an option the model can pick", () => {
  const types = REVIEW_SCHEMA.properties.corrections.items.properties.type.enum;
  assert.ok(!types.includes("pronunciation"));
});

test("an API failure throws rather than returning an empty review", async () => {
  stubFetch({ ok: false, text: async () => "429 slow down" });
  await assert.rejects(generateReview(args), /429 slow down/);

  stubFetch(ok(""));
  await assert.rejects(generateReview(args), /returned nothing/);
});
