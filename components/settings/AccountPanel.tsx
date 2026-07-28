"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAsync } from "@/hooks/useAsync";
import { getVoiceTier } from "@/lib/db/entitlements";
import {
  getAuthState,
  requestMagicLink,
  signOut,
  type SignInOutcome,
} from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { toError } from "@/lib/utils";

const SENT_MESSAGE: Record<SignInOutcome["kind"], string> = {
  linked: "登入連結已寄出。點開之後，這個裝置上的紀錄會保留。",
  "signed-in": "登入連結已寄出，點開就完成登入。",
  "already-registered":
    "這個 email 已經有帳號了，登入連結已寄出。注意：這個裝置上以匿名身分留下的紀錄不會一起帶過去。",
};

export function AccountPanel() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const auth = useAsync(
    async () =>
      isSupabaseConfigured()
        ? {
            state: await getAuthState(),
            tier: await getVoiceTier(),
          }
        : null,
    [reloadKey],
  );

  if (!isSupabaseConfigured()) {
    return (
      <Card>
        <p className="text-sm text-fg">尚未連上資料庫</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          這份程式碼沒有設定 Supabase，所以登入功能不會運作。
        </p>
      </Card>
    );
  }

  if (auth.loading) {
    return (
      <Card>
        <p className="text-sm text-muted">載入中…</p>
      </Card>
    );
  }

  const signedIn = Boolean(auth.data?.state.email);
  const tier = auth.data?.tier ?? "trial";

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setSent(null);

    try {
      const outcome = await requestMagicLink(email.trim());
      setSent(SENT_MESSAGE[outcome.kind]);
    } catch (cause) {
      setError(toError(cause).message);
    } finally {
      setSending(false);
    }
  }

  async function leave() {
    try {
      await signOut();
      setReloadKey((key) => key + 1);
    } catch (cause) {
      setError(toError(cause).message);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg">
          {signedIn ? auth.data?.state.email : "目前為匿名試用模式"}
        </p>
        <Badge tone={tier === "full" ? "brand" : "neutral"}>
          {tier === "full" ? "完整存取" : "試用"}
        </Badge>
      </div>

      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        {signedIn
          ? "紀錄綁在這個帳號上，換裝置登入就看得到。"
          : "紀錄目前只綁在這個瀏覽器上。留下 email 就能在其他裝置繼續，既有紀錄會一起帶過去。"}
      </p>

      {signedIn ? (
        <Button
          variant="secondary"
          className="mt-4"
          fullWidth
          onClick={leave}
        >
          登出
        </Button>
      ) : (
        <form onSubmit={send} className="mt-4 flex flex-col gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="min-h-12 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
          <Button type="submit" fullWidth disabled={sending}>
            {sending ? "寄送中…" : "寄送登入連結"}
          </Button>
        </form>
      )}

      {sent ? (
        <p className="mt-3 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2 text-xs leading-relaxed text-brand">
          {sent}
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl border border-state-error/30 bg-state-error/5 px-3 py-2 text-xs text-state-error">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
