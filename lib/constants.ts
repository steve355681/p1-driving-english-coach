import type {
  EnglishLevel,
  PresetTopic,
  SessionDuration,
  SessionStatus,
} from "@/types";

export const ROUTES = {
  landing: "/",
  launcher: "/app",
  session: (id: string) => `/session/${id}`,
  topics: "/topics",
  newTopic: "/topics/new",
  editTopic: (id: string) => `/topics/${id}`,
  review: (id: string) => `/review/${id}`,
  dashboard: "/dashboard",
  settings: "/settings",
} as const;

export const TOPICS: PresetTopic[] = [
  { id: "daily-life", label: "Daily Life", hint: "日常生活、通勤、週末" },
  { id: "work", label: "Work & Career", hint: "工作、同事、專案進度" },
  { id: "travel", label: "Travel", hint: "旅行、訂房、問路" },
  { id: "opinion", label: "Opinions", hint: "表達看法與理由" },
  { id: "interview", label: "Interview Practice", hint: "面試常見問題" },
  { id: "free-talk", label: "Free Talk", hint: "由教練帶話題" },
];

/** CEFR labels alone mean little to most learners, so each carries a
 *  plain-language hint about how the coach will actually behave. */
export const LEVELS: Array<{ value: EnglishLevel; label: string; hint: string }> =
  [
    { value: "A1", label: "A1 入門", hint: "極短句、很慢、大量引導" },
    { value: "A2", label: "A2 基礎", hint: "簡單句、放慢、常給提示" },
    { value: "B1", label: "B1 中級", hint: "一般語速、會追問理由" },
    { value: "B2", label: "B2 中高級", hint: "討論抽象話題、要你論述" },
    { value: "C1", label: "C1 高級", hint: "接近母語速度、少遷就" },
    { value: "C2", label: "C2 精通", hint: "母語速度、要求精準用字" },
  ];

export const DEFAULT_LEVEL: EnglishLevel = "B1";

/**
 * Notes longer than this are condensed before the coach sees them.
 *
 * The coach's brief is re-billed on every conversational turn, so a long
 * article pasted in whole would quietly undo the cost work. Notes that came
 * from a summarising tool are usually well under this, so the common case
 * costs nothing extra.
 */
/**
 * Whether the sign-in email carries a six-digit code as well as a link.
 *
 * Off unless `NEXT_PUBLIC_EMAIL_CODE=1`, because it depends on something no
 * code in this repo controls: editing Supabase's email templates requires
 * custom SMTP or a paid plan. Without that the code never arrives, and a field
 * the email cannot fill is worse than no field — it reads as a broken product
 * rather than a missing prerequisite.
 *
 * The link works either way. Turn this on once `{{ .Token }}` is actually in
 * both templates; see supabase/README.md.
 */
export const EMAIL_CODE_ENABLED = process.env.NEXT_PUBLIC_EMAIL_CODE === "1";

export const TOPIC_CONDENSE_THRESHOLD = 1500;
export const TOPIC_NOTES_MAX = 20000;

/** 5 → 60 minutes in 5-minute steps. Must stay in sync with `SessionDuration`. */
export const DURATIONS: SessionDuration[] = Array.from(
  { length: 12 },
  (_, index) => ((index + 1) * 5) as SessionDuration,
);

export const DEFAULT_DURATION: SessionDuration = 15;

/** Short, glanceable labels. Never longer than a few characters — this text is
 *  read while driving. */
export const SESSION_STATUS_LABELS: Record<
  SessionStatus,
  { label: string; hint: string }
> = {
  idle: { label: "準備中", hint: "尚未開始" },
  connecting: { label: "連線中", hint: "正在連線" },
  listening: { label: "請說話", hint: "教練正在聽" },
  ai_speaking: { label: "教練說話中", hint: "聽教練說" },
  paused: { label: "已暫停", hint: "隨時可繼續" },
  ending: { label: "結束中", hint: "正在收尾" },
  completed: { label: "已完成", hint: "可查看回顧" },
  error: { label: "連線異常", hint: "請靠邊停車再處理" },
};

/** Tailwind token per state, used by the live session indicator. */
export const SESSION_STATUS_COLOR: Record<SessionStatus, string> = {
  idle: "text-muted",
  connecting: "text-muted",
  listening: "text-state-listening",
  ai_speaking: "text-state-speaking",
  paused: "text-state-paused",
  ending: "text-muted",
  completed: "text-brand",
  error: "text-state-error",
};
