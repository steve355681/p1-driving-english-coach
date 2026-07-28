/**
 * WebRTC connection to the OpenAI Realtime API.
 *
 * The browser never sees the OpenAI key. It asks our own route for a
 * short-lived credential, then talks to OpenAI directly — going through our
 * server for the audio itself would add a hop of latency to every turn, and
 * latency is what makes a spoken conversation feel broken.
 */

import type { VoiceTier } from "@/types";

const CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export type VoiceEvent =
  | { type: "connected" }
  | { type: "coach-speaking" }
  | { type: "coach-done" }
  | { type: "error"; error: Error }
  | { type: "closed" };

export interface VoiceGrant {
  grantedSeconds: number;
  tier: VoiceTier;
}

export interface VoiceConnection extends VoiceGrant {
  close: () => void;
}

/** Raised when the gate refused; carries the message meant for the user. */
export class VoiceDeniedError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "VoiceDeniedError";
  }
}

async function requestGrant(input: {
  sessionId: string;
  requestedSeconds: number;
  accessToken: string;
}) {
  const response = await fetch("/api/realtime/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify({
      sessionId: input.sessionId,
      requestedSeconds: input.requestedSeconds,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    value?: string;
    grantedSeconds?: number;
    model?: string;
    tier?: VoiceTier;
    error?: string;
  };

  if (!response.ok || !payload.value) {
    throw new VoiceDeniedError(
      payload.error ?? "無法開始語音練習。",
      response.status,
    );
  }

  return payload as Required<Pick<typeof payload, "value" | "model">> & {
    grantedSeconds: number;
    tier: VoiceTier;
  };
}

/**
 * Which server events mean "the coach started/stopped talking".
 *
 * Matched loosely on purpose. These names have already been renamed once
 * (`response.audio.delta` became `response.output_audio.delta`), and a rename
 * would otherwise strand the UI in the wrong state with no error to show —
 * a silent failure rather than a loud one.
 */
function classify(type: string): "speaking" | "done" | null {
  if (/audio\.delta$/.test(type)) return "speaking";
  if (/audio\.done$/.test(type) || type === "response.done") return "done";
  return null;
}

export async function connectVoice(input: {
  sessionId: string;
  requestedSeconds: number;
  accessToken: string;
  /** Where the coach's voice is played. Must already be in the document. */
  audioElement: HTMLAudioElement;
  onEvent: (event: VoiceEvent) => void;
}): Promise<VoiceConnection> {
  const grant = await requestGrant(input);

  let microphone: MediaStream;
  try {
    microphone = await navigator.mediaDevices.getUserMedia({
      // Stated explicitly rather than left to `audio: true`. This is used in a
      // moving car, on speakerphone, with no headset — the coach's voice comes
      // out of the same cabin the microphone is in, and there is constant road
      // noise. Browsers usually default these on, but the one place they are
      // load-bearing is the one place we should not be relying on a default.
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch {
    // Denied, dismissed, or no input device — all the same to the driver.
    throw new Error("需要麥克風權限才能練習口說。請在瀏覽器設定中允許，再試一次。");
  }

  const peer = new RTCPeerConnection();
  let speaking = false;
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    // Stopping the tracks is what actually releases the microphone. Closing
    // the peer connection alone leaves the recording indicator on.
    microphone.getTracks().forEach((track) => track.stop());
    peer.close();
    input.onEvent({ type: "closed" });
  };

  try {
    peer.ontrack = (event) => {
      input.audioElement.srcObject = event.streams[0];
      void input.audioElement.play().catch(() => {
        // Autoplay was blocked despite the user gesture that got us here.
        input.onEvent({
          type: "error",
          error: new Error("無法播放教練的聲音，請確認手機沒有靜音。"),
        });
      });
    };

    peer.addTrack(microphone.getTracks()[0], microphone);

    const channel = peer.createDataChannel("oai-events");
    channel.onopen = () => input.onEvent({ type: "connected" });
    channel.onmessage = (message) => {
      let event: { type?: string; error?: { message?: string } };
      try {
        event = JSON.parse(message.data as string);
      } catch {
        return;
      }
      if (!event.type) return;

      if (event.type === "error") {
        input.onEvent({
          type: "error",
          error: new Error(event.error?.message ?? "語音服務發生錯誤。"),
        });
        return;
      }

      const kind = classify(event.type);
      // Audio deltas arrive many times a second; only report the transitions.
      if (kind === "speaking" && !speaking) {
        speaking = true;
        input.onEvent({ type: "coach-speaking" });
      } else if (kind === "done" && speaking) {
        speaking = false;
        input.onEvent({ type: "coach-done" });
      }
    };

    peer.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(peer.connectionState)) {
        close();
      }
    };

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    const answer = await fetch(`${CALLS_URL}?model=${grant.model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${grant.value}`,
        "Content-Type": "application/sdp",
      },
    });

    if (!answer.ok) {
      throw new Error(`無法建立語音連線（${answer.status}）。`);
    }

    await peer.setRemoteDescription({
      type: "answer",
      sdp: await answer.text(),
    });

    return {
      close,
      grantedSeconds: grant.grantedSeconds,
      tier: grant.tier,
    };
  } catch (cause) {
    // Never leave the microphone open on a failed connection.
    close();
    throw cause;
  }
}
