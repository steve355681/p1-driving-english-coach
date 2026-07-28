import { NextResponse } from "next/server";
import { getRequestUser, serviceClient } from "@/lib/supabase/server";
import { generateReview } from "@/lib/review/generate";
import { writeReview } from "@/lib/review/persist";

/**
 * Turns a finished session's transcript into its review (FR-4).
 *
 * Called from the review page when it finds nothing to show, rather than at the
 * end of the drive. Two reasons: the driver should not be held on a spinner
 * while a model writes, and a session nobody ever opens costs nothing.
 *
 * Like the voice token route, everything is recomputed server-side. The
 * transcript is read from the database rather than accepted from the client —
 * it is the entire prompt, so letting the caller supply it would turn this into
 * an open text endpoint billed to us.
 */

export async function POST(request: Request) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: "回顧功能尚未設定。" }, { status: 503 });
  }

  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }

  let body: { sessionId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤。" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
  if (!sessionId) {
    return NextResponse.json({ error: "缺少練習編號。" }, { status: 400 });
  }

  const admin = serviceClient();

  const { data: session, error: sessionError } = await admin
    .from("sessions")
    .select("id, user_id, topic, level, transcript, summary")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json({ error: "無法讀取練習。" }, { status: 500 });
  }
  if (!session || session.user_id !== user.id) {
    // Same answer either way — whether a session exists is not the caller's
    // business unless it is theirs.
    return NextResponse.json({ error: "找不到這次練習。" }, { status: 404 });
  }

  // Already generated. Returning instead of regenerating makes this endpoint
  // idempotent and caps it at one model call per session, so a client that
  // retries — or someone poking at it — cannot run up a bill.
  if (session.summary) {
    return NextResponse.json({ status: "exists" });
  }

  const transcript = session.transcript ?? [];
  if (transcript.length === 0) {
    return NextResponse.json(
      { error: "這次沒有錄到對話內容，沒有東西可以回顧。", reason: "empty" },
      { status: 422 },
    );
  }

  let content;
  try {
    content = await generateReview({
      apiKey: openaiKey,
      topic: session.topic,
      level: session.level,
      transcript,
    });
  } catch (cause) {
    console.error("Could not generate review", cause);
    return NextResponse.json({ error: "產生回顧時失敗了。" }, { status: 502 });
  }

  // A review with no summary and no items is a model failure, not a valid
  // result. Writing it would set `summary` and permanently lock the session
  // out of the regeneration path above.
  if (
    !content.summary &&
    content.corrections.length === 0 &&
    content.vocabulary.length === 0
  ) {
    return NextResponse.json(
      { error: "這次的內容不足以產生回顧。", reason: "insufficient" },
      { status: 422 },
    );
  }

  try {
    await writeReview(admin, sessionId, content);
  } catch (cause) {
    console.error("Could not save review", cause);
    return NextResponse.json({ error: "無法儲存回顧。" }, { status: 500 });
  }

  return NextResponse.json({ status: "created" });
}
