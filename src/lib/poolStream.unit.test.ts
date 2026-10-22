import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribePoolSpot, validStreamUrl } from "./poolStream";
import { poolAccount } from "../../tests/poolFixture";
import { WSOL, USDC } from "./const";
import { rpc } from "./rpcFeed";
vi.mock("./rpcFeed", () => ({
  rpc: vi.fn(async () => {
    throw new Error("No HTTP fixture");
  }),
}));
class Socket {
  static OPEN = 1;
  static all: Socket[] = [];
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  onopen?: () => void;
  onclose?: () => void;
  onerror?: () => void;
  onmessage?: (event: { data: string }) => void;
  constructor(public url: string) {
    Socket.all.push(this);
  }
  send(raw: string) {
    this.sent.push(JSON.parse(raw));
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(raw: unknown) {
    this.onmessage?.({ data: JSON.stringify(raw) });
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}
const pool = "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE";
const notification = (price: number, slot = 123, subscription = 77) => ({
  method: "accountNotification",
  params: {
    subscription,
    result: { context: { slot }, value: poolAccount(price) },
  },
});
beforeEach(() => {
  Socket.all = [];
  vi.stubGlobal("WebSocket", Socket);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("event-driven pool feed lifecycle", () => {
  it("does not label a REST bootstrap as a live push or discard the first notification behind another node snapshot", async () => {
    vi.mocked(rpc).mockResolvedValueOnce({
      context: { slot: 200 },
      value: [poolAccount(110)],
    });
    const onTick = vi.fn(),
      onStatus = vi.fn();
    const stop = subscribePoolSpot({
      pool,
      mint: WSOL,
      commitment: "processed",
      onTick,
      onStatus,
    });
    const socket = Socket.all[0];
    socket.open();
    socket.receive({ id: 1, result: 77 });
    await vi.advanceTimersByTimeAsync(0);
    expect(onTick).not.toHaveBeenCalled();
    expect(onStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: "waiting" }),
    );
    socket.receive(notification(100, 190));
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(onTick.mock.calls[0][0].slot).toBe(190);
    stop();
  });

  it("emits a real decoded update immediately without waiting for the REST refresh timer", async () => {
    const onTick = vi.fn(),
      onStatus = vi.fn();
    const stop = subscribePoolSpot({
      pool,
      mint: WSOL,
      commitment: "processed",
      onTick,
      onStatus,
    });
    const socket = Socket.all[0];
    socket.open();
    expect(socket.sent[0]).toMatchObject({
      method: "accountSubscribe",
      params: [pool, { encoding: "base64", commitment: "processed" }],
    });
    socket.receive({ id: 1, result: 77 });
    socket.receive(notification(100));
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(onTick.mock.calls[0][0]).toMatchObject({
      price: expect.closeTo(100, 8),
      slot: 123,
      commitment: "processed",
    });
    socket.receive(notification(101, 122));
    socket.receive(notification(999, 124, 999));
    socket.receive(null);
    expect(onTick).toHaveBeenCalledTimes(1);
    stop();
    socket.receive(notification(102, 125));
    expect(onTick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30000);
    expect(Socket.all).toHaveLength(1);
  });
  it("fails over on disconnect with bounded backoff and tears down reconnect timers", async () => {
    const stop = subscribePoolSpot({
      pool,
      mint: WSOL,
      commitment: "confirmed",
      onTick: vi.fn(),
      onStatus: vi.fn(),
    });
    Socket.all[0].close();
    await vi.advanceTimersByTimeAsync(500);
    expect(Socket.all).toHaveLength(2);
    expect(Socket.all[1].url).not.toBe(Socket.all[0].url);
    stop();
    await vi.advanceTimersByTimeAsync(60000);
    expect(Socket.all).toHaveLength(2);
  });
  it("refuses an unrelated mint and never emits fabricated prices for unknown layouts", () => {
    const onTick = vi.fn(),
      onStatus = vi.fn();
    let stop = subscribePoolSpot({
      pool,
      mint: "11111111111111111111111111111111",
      commitment: "processed",
      onTick,
      onStatus,
    });
    let socket = Socket.all[0];
    socket.open();
    socket.receive({ id: 1, result: 77 });
    socket.receive(notification(100));
    expect(onTick).not.toHaveBeenCalled();
    expect(onStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: "error" }),
    );
    stop();
    stop = subscribePoolSpot({
      pool,
      mint: USDC,
      commitment: "processed",
      onTick,
      onStatus,
    });
    socket = Socket.all[1];
    socket.open();
    socket.receive({ id: 1, result: 77 });
    const n = notification(100);
    n.params.result.value.owner = WSOL;
    socket.receive(n);
    expect(onStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: "unsupported" }),
    );
    expect(onTick).not.toHaveBeenCalled();
    stop();
  });
  it("accepts only secure WSS URLs and keeps credentials out of provider labels", () => {
    for (const value of [
      "javascript:alert(1)",
      "https://node.example",
      "ws://node.example",
      "wss://user:pass@node.example",
      "wss://node.example/#secret",
    ])
      expect(validStreamUrl(value)).toBe("");
    expect(
      validStreamUrl("wss://node.example/path?api-key=browser-scoped"),
    ).toContain("wss://node.example/");
  });
});
