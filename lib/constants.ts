import type {
  EnglishLevel,
  SessionDuration,
  SessionStatus,
  Topic,
} from "@/types";

export const ROUTES = {
  landing: "/",
  launcher: "/app",
  session: (id: string) => `/session/${id}`,
  review: (id: string) => `/review/${id}`,
  dashboard: "/dashboard",
  settings: "/settings",
} as const;

export const TOPICS: Topic[] = [
  { id: "daily-life", label: "Daily Life", hint: "日常生活、通勤、週末" },
  { id: "work", label: "Work & Career", hint: "工作、同事、專案進度" },
  { id: "travel", label: "Travel", hint: "旅行、訂房、問路" },
  { id: "opinion", label: "Opinions", hint: "表達看法與理由" },
  { id: "interview", label: "Interview Practice", hint: "面試常見問題" },
  { id: "free-talk", label: "Free Talk", hint: "由教練帶話題" },
];

export const LEVELS: Array<{ value: EnglishLevel; label: string; hint: string }> =
  [
    { value: "basic", label: "Basic", hint: "簡單句、慢速、多引導" },
    { value: "intermediate", label: "Intermediate", hint: "一般語速、會追問" },
    { value: "advanced", label: "Advanced", hint: "接近母語者速度、少提示" },
  ];

export const DURATIONS: SessionDuration[] = [10, 15, 20];

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
