"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAsync } from "@/hooks/useAsync";
import { getVoiceTier } from "@/lib/db/entitlements";
import {
  GoogleLinkBlockedError,
  explainRedirectError,
  getAuthState,
  requestMagicLink,
  signInWithGoogle,
  signInWithGoogleFresh,
  signOut,
  takeRedirectError,
  verifyCode,
  type SignInOutcome,
} from "@/lib/supabase/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { toError } from "@/lib/utils";

const SENT_MESSAGE: Record<SignInOutcome["kind"], string> = {
  linked: "驗證信已寄出。完成後，這個裝置上的紀錄會保留。",
  "signed-in": "驗證信已寄出。",
  "already-registered":
    "這個 email 已經有帳號了，驗證信已寄出。注意：這個裝置上以匿名身分留下的紀錄不會一起帶過去。",
};

export function AccountPanel() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  /**
   * Set once an email has gone out. Its presence is what swaps the form over
   * to the code field, and it carries which OTP flow the code belongs to.
   */
  const [pending, setPending] = useState<SignInOutcome | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  /** Google is the recommended path; the email form is opt-in behind it. */
  const [showEmail, setShowEmail] = useState(false);
  /** Set when linking Google to this browser's anonymous user was refused. */
  const [linkBlocked, setLinkBlocked] = useState(false);

  /**
   * A refused OAuth round trip comes back as error parameters on this URL, and
   * the failure is invisible without showing them. `linkBlocked` goes up too,
   * so the way forward — signing in without keeping this browser's anonymous
   * history — is on screen next to the explanation.
   */
  useEffect(() => {
    const failure = takeRedirectError();
    if (!failure) return;

    setLinkBlocked(true);
    setError(explainRedirectError(failure));
  }, []);

  /**
   * Returning from Google lands back on this page with the session in the URL
   * fragment, which the client consumes asynchronously. Without listening for
   * it, the panel can render its signed-out state over a session that arrived
   * a moment later.
   */
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setReloadKey((key) => key + 1);
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

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
      setPending(outcome);
      setSent(SENT_MESSAGE[outcome.kind]);
    } catch (cause) {
      setError(toError(cause).message);
    } finally {
      setSending(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!pending) return;

    setVerifying(true);
    setError(null);

    try {
      await verifyCode(email.trim(), code, pending.verifyType);
      setPending(null);
      setSent(null);
      setCode("");
      setReloadKey((key) => key + 1);
    } catch (cause) {
      setError(toError(cause).message);
    } finally {
      setVerifying(false);
    }
  }

  async function google(fresh = false) {
    setError(null);
    setSending(true);
    try {
      // Both of these navigate away on success, so there is nothing to do
      // after them and no loading state to clear.
      if (fresh) await signInWithGoogleFresh();
      else await signInWithGoogle();
    } catch (cause) {
      if (cause instanceof GoogleLinkBlockedError) setLinkBlocked(true);
      setError(toError(cause).message);
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
      ) : pending ? (
        /* The code, not the link. On a phone the link opens in the mail app's
           own browser, which signs in a browser the learner is not looking at
           — and this panel then asks again for an address already verified. */
        <form onSubmit={verify} className="mt-4 flex flex-col gap-2">
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6 位數驗證碼"
            inputMode="numeric"
            // Lets iOS and Android offer the code straight from the email
            // rather than making someone memorise it between two apps.
            autoComplete="one-time-code"
            maxLength={8}
            className="min-h-12 rounded-xl border border-line bg-surface-2 px-3 text-center text-lg tracking-[0.3em] tabular-nums text-fg placeholder:text-sm placeholder:tracking-normal placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
          <Button type="submit" fullWidth disabled={verifying}>
            {verifying ? "驗證中…" : "完成登入"}
          </Button>
          {/* For a link that did open in this browser, and for an email with
              no code in it because the Supabase template has not been edited
              yet. Re-reads the auth state rather than asking for anything. */}
          <button
            type="button"
            onClick={() => {
              setPending(null);
              setSent(null);
              setCode("");
              setError(null);
              setReloadKey((key) => key + 1);
            }}
            className="min-h-11 text-xs text-muted underline underline-offset-2"
          >
            我已經點了信裡的連結，重新檢查
          </button>
          <button
            type="button"
            onClick={() => {
              setPending(null);
              setSent(null);
              setCode("");
              setError(null);
            }}
            className="min-h-11 text-xs text-muted underline underline-offset-2"
          >
            改用其他 email
          </button>
        </form>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          <Button fullWidth disabled={sending} onClick={() => google()}>
            用 Google 登入
          </Button>

          {linkBlocked ? (
            <Button
              variant="secondary"
              fullWidth
              disabled={sending}
              onClick={() => google(true)}
            >
              仍要直接登入（不保留這個瀏覽器的紀錄）
            </Button>
          ) : null}

          {showEmail ? (
            <form onSubmit={send} className="mt-2 flex flex-col gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="min-h-12 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
              <Button
                type="submit"
                variant="secondary"
                fullWidth
                disabled={sending}
              >
                {sending ? "寄送中…" : "寄送驗證碼"}
              </Button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowEmail(true)}
              className="min-h-11 text-xs text-muted underline underline-offset-2"
            >
              改用 email 收驗證碼
            </button>
          )}
        </div>
      )}

      {sent ? (
        <p className="mt-3 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2 text-xs leading-relaxed text-brand">
          {sent}
          <span className="mt-1 block text-muted">
            在上面輸入信中的驗證碼就完成了。信裡的連結也可以用，但在手機上通常會在信箱
            App 自己的瀏覽器開啟，那邊登入了、這邊還是匿名。
          </span>
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
