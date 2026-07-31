import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/supabase/server";
import {
  CONDENSE_MODEL,
  CONDENSE_MODEL_FALLBACK,
  CONDENSE_PROMPT,
  needsCondensing,
  truncateNotes,
} from "@/lib/voice/condense";
import { TOPIC_NOTES_MAX } from "@/lib/constants";

/**
 * Shortens pasted notes to a brief the coach can be given cheaply.
 *
 * Requires a signed-in caller and caps the input, because this is an LLM call
 * on a public deployment: without both, the endpoint is a free summarising
 * service for anyone who finds it.
 */
export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }

  let body: { notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤。" }, { status: 400 });
  }

  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (!notes) {
    return NextResponse.json({ error: "沒有內容可以處理。" }, { status: 400 });
  }
  if (notes.length > TOPIC_NOTES_MAX) {
    return NextResponse.json(
      { error: `筆記太長了，上限是 ${TOPIC_NOTES_MAX} 字。` },
      { status: 400 },
    );
  }

  // Short enough already — the common case for notes from a summarising tool.
  if (!needsCondensing(notes)) {
    return NextResponse.json({ brief: null, condensed: false });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({
      brief: truncateNotes(notes),
      condensed: false,
      truncated: true,
    });
  }

  const ask = (model: string) =>
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: CONDENSE_PROMPT },
          { role: "user", content: notes },
        ],
      }),
    });

  try {
    let response = await ask(CONDENSE_MODEL);

    // A renamed or retired model answers 4xx. The catch below would still save
    // the topic, but with the notes merely truncated — worth one retry on the
    // previous model before settling for that.
    if (response.status >= 400 && response.status < 500) {
      console.error(
        `Condense model ${CONDENSE_MODEL} rejected`,
        await response.text(),
      );
      response = await ask(CONDENSE_MODEL_FALLBACK);
    }

    if (!response.ok) throw new Error(await response.text());

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const brief = payload.choices?.[0]?.message?.content?.trim();
    if (!brief) throw new Error("empty completion");

    return NextResponse.json({ brief, condensed: true });
  } catch (cause) {
    // A model that has been renamed or retired should not block saving a
    // topic. Fall back to trimming and let the caller say what happened.
    console.error("Could not condense notes", cause);
    return NextResponse.json({
      brief: truncateNotes(notes),
      condensed: false,
      truncated: true,
    });
  }
}
