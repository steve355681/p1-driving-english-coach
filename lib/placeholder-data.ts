/**
 * PLACEHOLDER DATA — NOT REAL.
 *
 * Exists only so the Phase 1 UI skeleton has something to render. Every screen
 * that uses it shows a "示範資料" badge. Delete this file once Phase 2 (Supabase
 * schema) and Phase 5 (review generation) are in place.
 */

import type { Session, SessionReview } from "@/types";

export const IS_PLACEHOLDER_DATA = true;

/** Stand-in owner id. Real rows get one from Supabase anonymous sign-in. */
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";

export const placeholderSessions: Session[] = [
  {
    id: "demo-1",
    userId: DEMO_USER_ID,
    topic: "Work & Career",
    durationMinutes: 15,
    level: "B1",
    status: "completed",
    startedAt: "2026-07-24T08:12:00.000Z",
    endedAt: "2026-07-24T08:27:00.000Z",
    transcript: [],
    summary: "聊了目前專案的進度與卡關的地方。",
    scoreOverall: 72,
    scoreFluency: 68,
    scoreClarity: 75,
    scoreVocab: 70,
  },
  {
    id: "demo-2",
    userId: DEMO_USER_ID,
    topic: "Daily Life",
    durationMinutes: 10,
    level: "B1",
    status: "completed",
    startedAt: "2026-07-22T08:05:00.000Z",
    endedAt: "2026-07-22T08:15:00.000Z",
    transcript: [],
    summary: "描述週末行程，練習過去式。",
    scoreOverall: 66,
    scoreFluency: 62,
    scoreClarity: 70,
    scoreVocab: 65,
  },
  {
    id: "demo-3",
    userId: DEMO_USER_ID,
    topic: "Travel",
    durationMinutes: 20,
    level: "A2",
    status: "completed",
    startedAt: "2026-07-19T08:30:00.000Z",
    endedAt: "2026-07-19T08:50:00.000Z",
    transcript: [],
    summary: "模擬機場報到與問路情境。",
    scoreOverall: 61,
    scoreFluency: 58,
    scoreClarity: 64,
    scoreVocab: 60,
  },
];

export const placeholderReview: SessionReview = {
  sessionId: "demo-1",
  title: "Talking about a blocked project",
  summary:
    "你能清楚說明專案狀況，句子也講得完整。主要卡在時態一致性，以及描述「卡關」時詞彙選擇偏中式英文。",
  corrections: [
    {
      id: "c1",
      sessionId: "demo-1",
      type: "grammar",
      originalText: "Yesterday I am waiting for the review.",
      improvedText: "Yesterday I was waiting for the review.",
      explanation: "談過去的事情要用過去式 was。",
      severity: "high",
    },
    {
      id: "c2",
      sessionId: "demo-1",
      type: "word_choice",
      originalText: "The project is very stuck.",
      improvedText: "The project has stalled.",
      explanation: "stalled 更自然，也更接近母語者用法。",
      severity: "medium",
    },
    {
      id: "c3",
      sessionId: "demo-1",
      type: "fluency",
      originalText: "How to say... the thing about the deadline.",
      improvedText: "What I mean is, the deadline is tight.",
      explanation: "卡住時可以用 What I mean is 接下去，不要停下來翻譯。",
      severity: "medium",
    },
  ],
  alternatives: [
    "We're waiting on feedback from the team.",
    "It's been on hold for about a week.",
    "I'd rather push the deadline than ship something broken.",
    "Let me walk you through where we are.",
  ],
  vocabulary: [
    {
      id: "v1",
      sessionId: "demo-1",
      phrase: "stall",
      meaningZh: "停滯、卡住",
      exampleEn: "The project stalled after the review.",
      category: "work",
    },
    {
      id: "v2",
      sessionId: "demo-1",
      phrase: "on hold",
      meaningZh: "暫緩中",
      exampleEn: "The launch is on hold until next month.",
      category: "work",
    },
    {
      id: "v3",
      sessionId: "demo-1",
      phrase: "walk someone through",
      meaningZh: "帶某人逐步了解",
      exampleEn: "Let me walk you through the plan.",
      category: "work",
    },
    {
      id: "v4",
      sessionId: "demo-1",
      phrase: "tight deadline",
      meaningZh: "很趕的期限",
      exampleEn: "We're working with a tight deadline.",
      category: "work",
    },
    {
      id: "v5",
      sessionId: "demo-1",
      phrase: "wait on",
      meaningZh: "等待（某人回覆）",
      exampleEn: "I'm waiting on his reply.",
      category: "general",
    },
  ],
  nextRecommendation: "下次練習用過去式描述「上週做了什麼」，主題選 Work & Career。",
  transcriptTurns: 0,
};

/** Recurring error themes for the dashboard (Phase 6 will derive these for real). */
export const placeholderErrorThemes = [
  { label: "時態一致性", count: 12 },
  { label: "冠詞 a / the", count: 8 },
  { label: "中式英文用詞", count: 6 },
  { label: "介系詞搭配", count: 4 },
];
