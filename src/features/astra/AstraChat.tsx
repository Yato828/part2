import { useEffect, useRef, useState } from "react";
import { askAstra, astraStatus } from "./client";
import {
  assistantLabel,
  type ChatMessage,
  type TokenContext,
  type AstraStatus,
} from "./types";
import { errorMessage, readLocal, saveLocal } from "../../lib/validation";
type Thread = { id: string; name: string; messages: ChatMessage[] };
const fresh = (): Thread => ({
  id: crypto.randomUUID(),
  name: "New conversation",
  messages: [],
});
export function parseThreads(raw: unknown): Thread[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 10)
    .filter(
      (t) =>
        t &&
        typeof t.id === "string" &&
        typeof t.name === "string" &&
        Array.isArray(t.messages),
    )
    .map((t) => ({
      id: t.id.slice(0, 80),
      name: t.name.slice(0, 80),
      messages: t.messages
        .filter(
          (m: ChatMessage) =>
            m &&
            ["user", "assistant"].includes(m.role) &&
            typeof m.content === "string" &&
            Number.isFinite(m.at),
        )
        .slice(-24)
        .map((m: ChatMessage) => ({
          ...m,
          content: m.content.slice(0, 6000),
          model: typeof m.model === "string" ? m.model.slice(0, 80) : undefined,
        })),
    }));
}
const chips = [
  "Analyze this token",
  "Explain recent transfers",
  "Who holds this asset?",
  "Summarize liquidity risks",
  "Explain this chart",
];
export default function AstraChat({
  context,
  wallet,
  onSettings,
}: {
  context: TokenContext | null;
  wallet: string | null;
  onSettings: () => void;
}) {
  const [threads, setThreads] = useState<Thread[]>(() => {
    const saved = readLocal("part.astra.threads.v1", parseThreads, []);
    return saved.length ? saved : [fresh()];
  });
  const [id, setId] = useState(threads[0].id);
  const [input, setInput] = useState("");
  const [attached, setAttached] = useState<TokenContext | null>(context);
  const [attachedWallet, setAttachedWallet] = useState(wallet);
  const [status, setStatus] = useState<AstraStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [copied, setCopied] = useState(-1);
  const abort = useRef<AbortController | null>(null);
  const thread = threads.find((t) => t.id === id) ?? threads[0];
  const messages = thread.messages;
  useEffect(() => {
    setAttachedWallet(wallet);
  }, [wallet]);
  useEffect(() => {
    setAttached(context);
  }, [context?.mint, context?.pool]);
  useEffect(() => {
    setStorageError(!saveLocal("part.astra.threads.v1", threads));
  }, [threads]);
  useEffect(() => {
    const ac = new AbortController();
    void astraStatus(ac.signal)
      .then(setStatus)
      .catch((e) => {
        if (!ac.signal.aborted) setError(errorMessage(e));
      });
    return () => {
      ac.abort();
      abort.current?.abort();
    };
  }, []);
  const send = async (text: string, base = messages) => {
    if (!text.trim() || busy) return;
    const next = [
      ...base,
      { role: "user" as const, content: text.trim(), at: Date.now() },
    ].slice(-23);
    while (
      (next.reduce((n, m) => n + m.content.length, 0) > 22000 ||
        new TextEncoder().encode(JSON.stringify(next)).length > 28000) &&
      next.length > 1
    )
      next.shift();
    setThreads((ts) =>
      ts.map((t) => (t.id === thread.id ? { ...t, messages: next } : t)),
    );
    setInput("");
    setError("");
    setBusy(true);
    const ac = new AbortController();
    abort.current = ac;
    try {
      const result = await askAstra(next, attached, ac.signal, attachedWallet);
      if (!ac.signal.aborted)
        setThreads((ts) =>
          ts.map((t) =>
            t.id === thread.id
              ? {
                  ...t,
                  messages: [
                    ...next,
                    {
                      role: "assistant" as const,
                      content: result.text,
                      at: result.at,
                      model: result.model,
                    },
                  ].slice(-24),
                }
              : t,
          ),
        );
    } catch (e) {
      setError(
        ac.signal.aborted
          ? "Request stopped. No answer was saved."
          : errorMessage(e),
      );
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };
  const regenerate = () => {
    const lastUser = messages.findLastIndex((m) => m.role === "user");
    if (lastUser >= 0)
      void send(messages[lastUser].content, messages.slice(0, lastUser));
  };
  return (
    <section className="tool-page astra-chat">
      <header className="tool-heading">
        <div>
          <small>PART / SOLANA INTELLIGENCE</small>
          <h1>
            {assistantLabel(
              messages.findLast((m) => m.role === "assistant")?.model,
            )}
          </h1>
          <p>
            {status?.ready
              ? `Configured model: ${status.model} · read-only tools`
              : (status?.reason ?? "Checking server connection…")}
          </p>
        </div>
        <button onClick={onSettings}>API status ↗</button>
      </header>
      <div className="tool-actions">
        <select
          aria-label="Conversation"
          value={thread.id}
          disabled={busy}
          onChange={(e) => setId(e.target.value)}
        >
          {threads.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          disabled={busy || threads.length >= 10}
          onClick={() => {
            const t = fresh();
            setThreads((ts) => [t, ...ts].slice(0, 10));
            setId(t.id);
          }}
        >
          New thread
        </button>
        <input
          aria-label="Thread name"
          maxLength={80}
          value={thread.name}
          disabled={busy}
          onChange={(e) =>
            setThreads((ts) =>
              ts.map((t) =>
                t.id === thread.id ? { ...t, name: e.target.value } : t,
              ),
            )
          }
        />
        <button
          disabled={busy}
          onClick={() => {
            setThreads((ts) =>
              ts.map((t) => (t.id === thread.id ? { ...t, messages: [] } : t)),
            );
            setError("");
          }}
        >
          Clear history
        </button>
      </div>
      <div className="context-chip">
        {attached ? (
          <>
            <span>
              Solana · {attached.symbol} · {attached.mint}
            </span>
            <button
              aria-label="Remove token context"
              onClick={() => setAttached(null)}
            >
              Remove
            </button>
          </>
        ) : (
          <span>No asset attached</span>
        )}
        {context && !attached && (
          <button onClick={() => setAttached(context)}>
            Attach selected token
          </button>
        )}
      </div>
      {wallet && (
        <div className="context-chip">
          <span>
            {attachedWallet
              ? `Solana wallet · ${attachedWallet}`
              : "No wallet attached"}
          </span>
          <button
            aria-label={
              attachedWallet
                ? "Remove wallet context"
                : "Attach selected wallet"
            }
            onClick={() => setAttachedWallet(attachedWallet ? null : wallet)}
          >
            {attachedWallet ? "Remove" : "Attach selected wallet"}
          </button>
        </div>
      )}
      {storageError && (
        <p role="alert">
          Local storage unavailable. This conversation will not survive reload.
        </p>
      )}
      <div className="chat-messages" aria-live="polite">
        {!messages.length && (
          <div className="tool-empty">
            <span className="astra-empty-mark" aria-hidden="true">
              ✳
            </span>
            <h2>A clearer view of your market.</h2>
            <p>
              Ask about a selected Solana asset. Current facts come from
              connected sources; unavailable data stays unavailable.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <article key={`${m.at}-${i}`} className={`chat-message ${m.role}`}>
            <div>
              <b>{m.role === "user" ? "You" : assistantLabel(m.model)}</b>
              <time>
                {new Date(m.at).toISOString().replace("T", " ").slice(0, 19)}{" "}
                UTC
              </time>
              <button
                onClick={() => {
                  void navigator.clipboard
                    .writeText(m.content)
                    .then(() => setCopied(i))
                    .catch(() => setError("Clipboard unavailable."));
                }}
              >
                {copied === i ? "Copied" : "Copy"}
              </button>
            </div>
            <p>{m.content}</p>
          </article>
        ))}
      </div>
      <div className="prompt-chips">
        {chips.map((text) => (
          <button key={text} disabled={busy} onClick={() => setInput(text)}>
            {text}
          </button>
        ))}
      </div>
      {error && (
        <p className="tool-error" role="alert">
          {error}
        </p>
      )}
      <form
        className="chat-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
          aria-label="Message Astra"
          maxLength={6000}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Astra about this market…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        <div>
          {busy ? (
            <button
              type="button"
              className="primary-action"
              onClick={() => abort.current?.abort()}
            >
              Stop generating
            </button>
          ) : (
            <button className="primary-action" disabled={!input.trim()}>
              Send
            </button>
          )}
          <button
            type="button"
            disabled={busy || !messages.some((m) => m.role === "user")}
            onClick={regenerate}
          >
            Regenerate
          </button>
        </div>
      </form>
      <small className="tool-disclaimer">
        AI-generated analysis. Verify market data before trading. History stays
        in this browser; messages and attached context are sent to the
        configured server and OpenAI when you press Send. Text responses are
        displayed safely; HTML is never executed.
      </small>
    </section>
  );
}
