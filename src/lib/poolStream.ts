import { rpc } from "./rpcFeed";
import { isSolanaAddress } from "./validation";
import { USDC, WSOL } from "./const";
import {
  decodePoolPrice,
  knownDecimals,
  poolQuote,
  SOL_USDC_POOL,
  type PoolPriceState,
  type RpcAccount,
} from "./poolPrice";
export const PUBLIC_STREAMS = [
  "wss://api.mainnet-beta.solana.com",
  "wss://solana-rpc.publicnode.com",
];
export type StreamCommitment = "processed" | "confirmed";
export type SpotTick = {
  price: number;
  receivedAt: number;
  slot: number;
  provider: string;
  commitment: StreamCommitment;
  kind: string;
  quote: string;
};
export type StreamStatus = {
  state:
    | "connecting"
    | "waiting"
    | "live"
    | "reconnecting"
    | "unsupported"
    | "error";
  message: string;
  provider: string;
};
export function validStreamUrl(raw: unknown): string {
  if (typeof raw !== "string" || raw.length > 2048) return "";
  try {
    const url = new URL(raw.trim());
    return url.protocol === "wss:" &&
      !url.username &&
      !url.password &&
      !url.hash
      ? url.href
      : "";
  } catch {
    return "";
  }
}
/** Read-only account PubSub. Never interprets metadata, logs or a spot price as a wallet instruction. */
export function subscribePoolSpot(options: {
  pool: string;
  mint: string;
  commitment: StreamCommitment;
  endpoint?: string;
  onTick: (tick: SpotTick) => void;
  onStatus: (status: StreamStatus) => void;
}) {
  const { pool, mint, commitment, onTick, onStatus } = options;
  if (!isSolanaAddress(pool) || !isSolanaAddress(mint))
    throw new Error("Invalid Solana stream context");
  const custom = validStreamUrl(options.endpoint);
  const endpoints = [
    ...new Set([...(custom ? [custom] : []), ...PUBLIC_STREAMS]),
  ];
  let disposed = false,
    socket: WebSocket | undefined,
    reconnect: ReturnType<typeof setTimeout> | undefined,
    handshake: ReturnType<typeof setTimeout> | undefined,
    heartbeat: ReturnType<typeof setInterval> | undefined,
    attempt = 0,
    epoch = 0;
  const decimals = new Map<string, number>([
    [WSOL, 9],
    [USDC, 6],
  ]);
  const metadata = new Map<string, Promise<void>>();
  const metadataRetryAt = new Map<string, number>();
  let lastTick: SpotTick | undefined;
  let lastStatus: StreamStatus | undefined;
  const status = (
    state: StreamStatus["state"],
    message: string,
    provider: string,
  ) => {
    if (
      !disposed &&
      (!lastStatus ||
        lastStatus.state !== state ||
        lastStatus.message !== message ||
        lastStatus.provider !== provider)
    ) {
      lastStatus = { state, message, provider };
      onStatus(lastStatus);
    }
  };
  const connect = () => {
    if (disposed) return;
    const generation = ++epoch,
      endpoint = endpoints[attempt % endpoints.length],
      provider = new URL(endpoint).hostname;
    const states = new Map<
        string,
        { state: PoolPriceState; slot: number; at: number; push: boolean }
      >(),
      subscriptions = new Map<number, string>(),
      requests = new Map<number, string>(),
      subscribed = new Set<string>();
    let id = 0,
      closed = false,
      incompatible = false,
      lastMessage = Date.now(),
      bootstrapDone = false;
    status(
      attempt ? "reconnecting" : "connecting",
      attempt ? "Reconnecting to pool feed…" : "Connecting to pool feed…",
      provider,
    );
    const active = () =>
      !disposed && generation === epoch && !closed && !incompatible;
    const send = (address: string) => {
      if (
        !active() ||
        socket?.readyState !== WebSocket.OPEN ||
        subscribed.has(address)
      )
        return;
      subscribed.add(address);
      const requestId = ++id;
      requests.set(requestId, address);
      socket.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: requestId,
          method: "accountSubscribe",
          params: [address, { encoding: "base64", commitment }],
        }),
      );
    };
    const emit = () => {
      if (!active()) return;
      const selected = states.get(pool);
      if (!selected) return;
      if (!selected.push) {
        status(
          "waiting",
          "Connected; waiting for an on-chain pool notification…",
          provider,
        );
        return;
      }
      const s = selected.state,
        da = s.decimalsA ?? decimals.get(s.mintA),
        db = s.decimalsB ?? decimals.get(s.mintB);
      if (da == null || db == null) return;
      const quote = poolQuote(s, mint, da, db);
      if (!quote) {
        status(
          "unsupported",
          "Pool does not contain the selected mint or has invalid price data.",
          provider,
        );
        return;
      }
      let price = quote.price,
        slot = selected.slot,
        at = selected.at,
        quoteLabel = "USDC ≈ USD";
      if (quote.quoteMint === WSOL) {
        const reference = states.get(SOL_USDC_POOL);
        if (!reference?.push || Date.now() - reference.at > 30000) {
          status(
            "waiting",
            "Waiting for a fresh SOL/USDC conversion…",
            provider,
          );
          return;
        }
        const conversion = poolQuote(
          reference.state,
          WSOL,
          knownDecimals(reference.state.mintA) ?? -1,
          knownDecimals(reference.state.mintB) ?? -1,
        );
        if (!conversion || conversion.quoteMint !== USDC) return;
        price *= conversion.price;
        at = Math.max(at, reference.at);
        slot = Math.max(slot, reference.slot);
        quoteLabel = "SOL × live SOL/USDC ≈ USD";
      } else if (quote.quoteMint !== USDC) {
        status(
          "unsupported",
          "Live USD conversion is unavailable for this quote mint; historical source remains active.",
          provider,
        );
        return;
      }
      if (!Number.isFinite(price) || price <= 0) return;
      if (lastTick && at <= lastTick.receivedAt && price === lastTick.price)
        return;
      const tick = {
        price,
        receivedAt: at,
        slot,
        provider,
        commitment,
        kind: s.kind,
        quote: quoteLabel,
      };
      lastTick = tick;
      attempt = 0;
      status(
        "live",
        "Pool spot prices are streaming. USDC is treated as approximately USD.",
        provider,
      );
      onTick(tick);
    };
    const accept = (
      address: string,
      account: RpcAccount,
      slot: number,
      push = false,
    ) => {
      if (!active() || !Number.isSafeInteger(slot) || slot <= 0) return;
      const old = states.get(address);
      if (old?.push && slot < old.slot) return;
      const state = decodePoolPrice(account);
      if (!state) {
        if (address === pool) {
          incompatible = true;
          status(
            "unsupported",
            "No spot decoder for this pool. Historical candle updates remain active.",
            provider,
          );
          socket?.close();
        }
        return;
      }
      if (address === pool && state.mintA !== mint && state.mintB !== mint) {
        incompatible = true;
        status("error", "Stream pool does not match selected mint.", provider);
        socket?.close();
        return;
      }
      states.set(address, { state, slot, at: Date.now(), push });
      const other = state.mintA === mint ? state.mintB : state.mintA;
      if (address === pool && other === WSOL && pool !== SOL_USDC_POOL) {
        send(SOL_USDC_POOL);
        void bootstrap([SOL_USDC_POOL]);
      }
      const missing = [state.mintA, state.mintB].filter(
        (m, i) =>
          (i === 0 ? state.decimalsA : state.decimalsB) == null &&
          !decimals.has(m),
      );
      if (missing.length) {
        const key = missing.join(":");
        if (
          !metadata.has(key) &&
          (metadataRetryAt.get(key) ?? 0) <= Date.now()
        ) {
          metadataRetryAt.set(key, Date.now() + 15000);
          const job = rpc<{
            value: Array<{
              owner?: string;
              data?: {
                parsed?: { type?: string; info?: { decimals?: number } };
              };
            } | null>;
          }>("getMultipleAccounts", [
            missing,
            { encoding: "jsonParsed", commitment: "confirmed" },
          ])
            .then((result) => {
              result.value.forEach((account, i) => {
                const d = account?.data?.parsed?.info?.decimals;
                if (
                  account?.data?.parsed?.type === "mint" &&
                  [
                    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
                  ].includes(account.owner ?? "") &&
                  Number.isInteger(d) &&
                  d! >= 0 &&
                  d! <= 18
                )
                  decimals.set(missing[i], d!);
              });
            })
            .catch(() => {})
            .finally(() => {
              metadata.delete(key);
              emit();
            });
          metadata.set(key, job);
        }
        status("waiting", "Resolving on-chain mint decimals…", provider);
      }
      emit();
    };
    const bootstrapped = new Set<string>();
    const bootstrap = async (addresses: string[]) => {
      const needed = addresses.filter((a) => !bootstrapped.has(a));
      if (!needed.length) return;
      needed.forEach((a) => bootstrapped.add(a));
      try {
        const result = await rpc<{
          context: { slot: number };
          value: Array<RpcAccount | null>;
        }>(
          "getMultipleAccounts",
          [needed, { encoding: "base64", commitment }],
          true,
        );
        if (!active()) return;
        result.value.forEach((account, i) => {
          if (account && !states.has(needed[i]))
            accept(needed[i], account, result.context.slot);
        });
      } catch {
        /* PubSub notifications can still supply state when HTTP is restricted. */
      }
      bootstrapDone = true;
    };
    const fail = () => {
      if (closed) return;
      closed = true;
      clearTimeout(handshake);
      clearInterval(heartbeat);
      if (!disposed && !incompatible && generation === epoch) {
        attempt++;
        status(
          "reconnecting",
          "Feed disconnected; retrying. Historical source remains available.",
          provider,
        );
        reconnect = setTimeout(
          connect,
          Math.min(20000, 500 * 2 ** Math.min(attempt - 1, 5)),
        );
      }
    };
    try {
      socket = new WebSocket(endpoint);
    } catch {
      fail();
      return;
    }
    const ws = socket;
    handshake = setTimeout(() => {
      if (active()) {
        ws.close();
        fail();
      }
    }, 10000);
    ws.onopen = () => {
      if (!active()) {
        ws.close();
        return;
      }
      send(pool);
      void bootstrap([pool]);
      heartbeat = setInterval(() => {
        if (!active()) return;
        if (Date.now() - lastMessage > 45000) {
          // A slot ping checks idle connections without inventing pool ticks.
          if (Date.now() - lastMessage > 60000) {
            ws.close();
            fail();
            return;
          }
          ws.send(
            JSON.stringify({
              jsonrpc: "2.0",
              id: 999999,
              method: "slotSubscribe",
              params: [],
            }),
          );
        }
      }, 15000);
    };
    ws.onmessage = (event) => {
      if (
        !active() ||
        typeof event.data !== "string" ||
        event.data.length > 40000
      )
        return;
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!message || typeof message !== "object") return;
      lastMessage = Date.now();
      if (message.id === 999999 && Number.isInteger(message.result)) {
        ws.send(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 999998,
            method: "slotUnsubscribe",
            params: [message.result],
          }),
        );
        return;
      }
      if (requests.has(message.id)) {
        const address = requests.get(message.id)!;
        requests.delete(message.id);
        if (message.error || !Number.isInteger(message.result)) {
          ws.close();
          fail();
          return;
        }
        subscriptions.set(message.result, address);
        clearTimeout(handshake);
        if (!lastTick)
          status(
            "waiting",
            bootstrapDone
              ? "Waiting for the next pool update…"
              : "Connected; loading pool state…",
            provider,
          );
        return;
      }
      if (message.method !== "accountNotification") return;
      const address = subscriptions.get(message.params?.subscription);
      const result = message.params?.result;
      if (address && result?.value)
        accept(address, result.value, result.context?.slot, true);
    };
    ws.onerror = () => {
      ws.close();
      fail();
    };
    ws.onclose = fail;
  };
  connect();
  return () => {
    disposed = true;
    epoch++;
    clearTimeout(reconnect);
    clearTimeout(handshake);
    clearInterval(heartbeat);
    socket?.close();
  };
}
