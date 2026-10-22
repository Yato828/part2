import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
describe("bounded shared RPC reads", () => {
  it("deduplicates concurrent reads and shares a short cached snapshot", async () => {
    const mock = vi.fn(async () => Response.json({ result: 42 }));
    vi.stubGlobal("fetch", mock);
    const { rpc } = await import("./rpcFeed");
    expect(await Promise.all([rpc("getSlot"), rpc("getSlot")])).toEqual([
      42, 42,
    ]);
    expect(mock).toHaveBeenCalledTimes(2);
    expect(await rpc("getSlot")).toBe(42);
    expect(mock).toHaveBeenCalledTimes(2);
  });
  it("does not cache failed reads", async () => {
    const mock = vi.fn(async () =>
      Response.json({ error: { message: "rate limited" } }),
    );
    vi.stubGlobal("fetch", mock);
    const { rpc } = await import("./rpcFeed");
    await expect(rpc("getSlot")).rejects.toThrow("rate limited");
    mock.mockImplementation(async () => Response.json({ result: 7 }));
    expect(await rpc("getSlot")).toBe(7);
    expect(mock).toHaveBeenCalledTimes(4);
  });
  it("preserves exact-case arguments in request deduplication", async () => {
    const mock = vi.fn(async () => Response.json({ result: { value: {} } }));
    vi.stubGlobal("fetch", mock);
    const { rpc } = await import("./rpcFeed");
    await Promise.all([
      rpc("getTokenSupply", ["CaseSensitive"]),
      rpc("getTokenSupply", ["casesensitive"]),
    ]);
    expect(mock).toHaveBeenCalledTimes(4);
  });
  it("never shares simulation requests or signature checks as cached reads", async () => {
    const mock = vi.fn(async () => Response.json({ result: { value: [] } }));
    vi.stubGlobal("fetch", mock);
    const { rpc } = await import("./rpcFeed");
    await Promise.all([
      rpc("simulateTransaction", ["test"]),
      rpc("simulateTransaction", ["test"]),
    ]);
    expect(mock).toHaveBeenCalledTimes(4);
  });
});
