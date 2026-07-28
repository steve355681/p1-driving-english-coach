import { NextResponse } from "next/server";
import { getRequestUser, serviceClient } from "@/lib/supabase/server";
import { decideGrant, denialMessage } from "@/lib/voice/policy";
import {
  REALTIME_MODEL,
  TRANSCRIPTION_MODEL,
  TRUNCATION,
  coachInstructions,
} from "@/lib/voice/config";
import type { VoiceTier } from "@/types";

/**
 * Mints a short-lived OpenAI credential for the browser to open a Realtime
 * connection with.
 *
 * This route exists because the OpenAI key must never reach the browser, and
 * it is the only place voice spending is authorised. Everything it decides is
 * recomputed from the database — tier, remaining quota, session ownership —
 * because every input from the client is attacker-controlled. The requested
 * duration is a request, not an instruction.
 */

const OPENAI_URL = "https://api.openai.com/v1/realtime/client_secrets";

export async function POST(request: Request) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json(
      { error: "語音功能尚未設定。" },
      { status: 503 },
    );
  }

  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }

  let body: { sessionId?: unknown; requestedSeconds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤。" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
  const requestedSeconds = Number(body.requestedSeconds);
  if (!sessionId) {
    return NextResponse.json({ error: "缺少練習編號。" }, { status: 400 });
  }

  const admin = serviceClient();

  // The session must exist and belong to the caller. Without this check a
  // valid token for one account could bill voice against another account's
  // session, which would also corrupt that account's usage history.
  const { data: session, error: sessionError } = await admin
    .from("sessions")
    .select("id, user_id, level, topic, topic_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json({ error: "無法讀取練習。" }, { status: 500 });
  }
  if (!session || session.user_id !== user.id) {
    // Same response either way: telling a caller that a session exists but
    // belongs to someone else is more than they need to know.
    return NextResponse.json({ error: "找不到這次練習。" }, { status: 404 });
  }

  const { data: entitlement } = await admin
    .from("voice_entitlements")
    .select("tier")
    .eq("user_id", user.id)
    .maybeSingle();

  const tier: VoiceTier = entitlement?.tier ?? "trial";

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: usageError } = await admin
    .from("voice_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);

  if (usageError) {
    // Fail closed. An unreadable usage table means the quota is unknown, and
    // an unknown quota must not be treated as an empty one.
    return NextResponse.json({ error: "無法確認額度。" }, { status: 500 });
  }

  const decision = decideGrant({
    tier,
    requestedSeconds,
    grantsToday: count ?? 0,
  });

  if (!decision.allowed) {
    return NextResponse.json(
      { error: denialMessage(decision.reason, tier), reason: decision.reason },
      { status: decision.reason === "daily_limit" ? 429 : 400 },
    );
  }

  // Saved topics carry the learner's own notes. Read server-side rather than
  // trusting the client to send them: the brief goes straight into a metered
  // prompt, so its size and content must not be caller-controlled.
  let material: string | null = null;
  if (session.topic_id) {
    const { data: topic } = await admin
      .from("topics")
      .select("brief, notes, user_id")
      .eq("id", session.topic_id)
      .maybeSingle();

    if (topic && topic.user_id === user.id) {
      material = topic.brief ?? topic.notes;
    }
  }

  const baseSession = {
    type: "realtime",
    model: REALTIME_MODEL,
    instructions: coachInstructions({
      topic: session.topic,
      level: session.level,
      material,
    }),
  };

  const mint = (session: Record<string, unknown>) =>
    fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // The credential dies with the grant, so a leaked one cannot outlive
        // the session it was issued for.
        expires_after: {
          anchor: "created_at",
          seconds: decision.grantedSeconds,
        },
        session,
      }),
    });

  const withTranscription = {
    ...baseSession,
    audio: { input: { transcription: { model: TRANSCRIPTION_MODEL } } },
  };

  /**
   * Two optional pieces of session config, each of which the API could reject
   * on its own — both have shapes that have changed before. They are dropped
   * one at a time rather than together, so a rejected truncation setting does
   * not silently cost the transcript as well. Losing either costs a feature;
   * losing the session costs the drive.
   */
  const attempts = [
    { session: { ...withTranscription, truncation: TRUNCATION }, transcription: true, truncation: true },
    { session: withTranscription, transcription: true, truncation: false },
    { session: baseSession, transcription: false, truncation: false },
  ];

  let openaiResponse = await mint(attempts[0].session);
  let active = attempts[0];

  for (let i = 1; i < attempts.length && openaiResponse.status === 400; i++) {
    console.error(
      `Realtime session rejected (attempt ${i})`,
      await openaiResponse.text(),
    );
    active = attempts[i];
    openaiResponse = await mint(active.session);
  }

  const transcription = active.transcription;

  if (!openaiResponse.ok) {
    const detail = await openaiResponse.text();
    console.error("Realtime token request failed", openaiResponse.status, detail);
    return NextResponse.json(
      { error: "無法連線到語音服務。" },
      { status: 502 },
    );
  }

  const secret = (await openaiResponse.json()) as {
    value?: string;
    expires_at?: number;
  };

  if (!secret.value) {
    return NextResponse.json({ error: "語音服務回應異常。" }, { status: 502 });
  }

  // Recorded only after the grant actually exists, so a failure upstream does
  // not consume the user's daily allowance.
  const { error: insertError } = await admin.from("voice_usage").insert({
    user_id: user.id,
    session_id: session.id,
    granted_seconds: decision.grantedSeconds,
    tier,
  });

  if (insertError) {
    // The credential is already live and billable, so refusing now would cost
    // money and give the user nothing. Hand it over and make the gap loud.
    console.error("Voice grant issued but not recorded", insertError);
  }

  return NextResponse.json({
    value: secret.value,
    expiresAt: secret.expires_at ?? null,
    grantedSeconds: decision.grantedSeconds,
    model: REALTIME_MODEL,
    tier,
    transcription,
    truncation: active.truncation,
  });
}
