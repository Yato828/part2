import { partFetch } from "../../lib/http";
import { readLocal, saveLocal } from "../../lib/validation";
import type {
  AstraResult,
  AstraStatus,
  ChatMessage,
  TokenContext,
} from "./types";
let session: string;
export function sessionId() {
  if (!session) {
    session = readLocal(
      "part.astra.session",
      (raw) =>
        typeof raw === "string" && /^[a-zA-Z0-9_-]{16,80}$/.test(raw)
          ? raw
          : crypto.randomUUID(),
      crypto.randomUUID(),
    );
    saveLocal("part.astra.session", session);
  }
  return session;
}
export async function astraStatus(signal?: AbortSignal): Promise<AstraStatus> {
  const res = await partFetch("/api/astra/status", {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(8000)])
      : AbortSignal.timeout(8000),
  });
  if (!res.ok || !res.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      "Astra server is unavailable. Open Settings to check the connection.",
    );
  return res.json();
}
export async function askAstra(
  messages: Pick<ChatMessage, "role" | "content">[],
  selectedToken: TokenContext | null,
  signal?: AbortSignal,
  selectedWallet: string | null = null,
): Promise<AstraResult> {
  const res = await partFetch("/api/astra/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Part-Session": sessionId(),
    },
    body: JSON.stringify({
      messages: messages
        .slice(-24)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 6000) })),
      selectedToken,
      selectedWallet,
    }),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(50000)])
      : AbortSignal.timeout(50000),
  });
  if (!res.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      "Astra backend is unavailable. Run npm run dev or configure the deployed API.",
    );
  const body = await res.json();
  if (!res.ok)
    throw new Error(
      typeof body.error === "string" ? body.error : "Astra request failed.",
    );
  if (typeof body.text !== "string" || typeof body.model !== "string")
    throw new Error("Invalid Astra response.");
  return body;
}

if (typeof window !== "undefined")
  window.addEventListener("part:clear-data", () => {
    session = "";
  });
