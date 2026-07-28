import { getAccessToken } from "@/lib/supabase/auth";

/**
 * Asks the server to generate this session's review.
 *
 * Returns nothing useful on success — the caller re-reads the review through
 * the normal path afterwards, so there is one shape of review on screen whether
 * it was just generated or already existed.
 */

/**
 * A refusal the user can act on, as opposed to a failure they can retry.
 *
 * `empty` means nothing was recorded and `insufficient` means too little was
 * said; neither gets better by trying again, so the screen must stop rather
 * than offer a button that cannot work.
 */
export class ReviewUnavailableError extends Error {
  constructor(
    message: string,
    readonly reason: "empty" | "insufficient",
  ) {
    super(message);
    this.name = "ReviewUnavailableError";
  }
}

export async function requestReview(sessionId: string): Promise<void> {
  const accessToken = await getAccessToken();

  const response = await fetch("/api/review", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ sessionId }),
  });

  if (response.ok) return;

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    reason?: string;
  };

  const message = payload.error ?? "無法產生回顧。";

  if (payload.reason === "empty" || payload.reason === "insufficient") {
    throw new ReviewUnavailableError(message, payload.reason);
  }

  throw new Error(message);
}
