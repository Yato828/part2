import { describe, expect, it } from "vitest";
import { resolvePartUrl } from "./http";

describe("extension url map", () => {
  it("keeps local Astra routing explicit and never redirects website APIs or market data", () => {
    expect(resolvePartUrl("/api/astra/chat", "ext", "local")).toBe(
      "http://localhost:4664/api/astra/chat",
    );
    expect(resolvePartUrl("/api/astra/chat", "web", "local")).toBe(
      "/api/astra/chat",
    );
    expect(resolvePartUrl("/rpc", "ext", "local")).toBe(
      "https://api.mainnet-beta.solana.com/",
    );
  });
  it("stays relative on the website", () => {
    expect(
      resolvePartUrl("/paprika/networks/solana/pools/0x1/ohlcv", "web"),
    ).toBe("/paprika/networks/solana/pools/0x1/ohlcv");
  });

  it("rewrites public APIs in the extension and leaves static assets local", () => {
    expect(
      resolvePartUrl("/paprika/networks/solana/pools/0x1/ohlcv", "ext"),
    ).toBe("https://api.dexpaprika.com/networks/solana/pools/0x1/ohlcv");
    expect(resolvePartUrl("/dex/latest/dex/search?q=SOL", "ext")).toBe(
      "https://api.dexscreener.com/latest/dex/search?q=SOL",
    );
    expect(resolvePartUrl("/rpc", "ext")).toBe(
      "https://api.mainnet-beta.solana.com/",
    );
    expect(resolvePartUrl("/hero/logo.jpg", "ext")).toBe("/hero/logo.jpg");
    expect(resolvePartUrl("/api/fable", "ext")).toMatch(/\/api\/fable$/);
  });
});
