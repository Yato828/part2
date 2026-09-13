import { fableMessages, parseFableFacts } from "./fableCore";

export const FABLE_MODEL = "gpt-4o-mini";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Cache-Control": "no-store",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function openaiKey() {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env?.OPENAI_API_KEY ?? "";
}

export async function handleFable(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const key = openaiKey();
  if (!key) return json(503, { error: "offline" });

  const len = Number(req.headers.get("content-length") || 0);
  if (len > 4096) return json(413, { error: "too large" });

  let facts;
  try {
    facts = parseFableFacts(await req.json());
  } catch {
    return json(400, { error: "bad json" });
  }
  if (!facts) return json(400, { error: "bad facts" });

  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: FABLE_MODEL,
      stream: true,
      temperature: 0.2,
      max_tokens: 72,
      messages: fableMessages(facts),
    }),
    signal: req.signal,
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.warn("fable upstream", upstream.status, detail.slice(0, 180));
    return json(upstream.status || 502, { error: upstream.status === 429 ? "busy" : "upstream" });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...CORS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
