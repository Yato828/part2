import { describe, expect, it } from "vitest";
import { resolvePartUrl } from "./http";

describe("extension url map", () => {
  it("stays relative on the website", () => {
    expect(resolvePartUrl("/paprika/networks/robinhood/pools/0x1/ohlcv", "web")).toBe(
      "/paprika/networks/robinhood/pools/0x1/ohlcv"
    );
  });

  it("rewrites public APIs in the extension and leaves registry local", () => {
    expect(resolvePartUrl("/paprika/networks/robinhood/pools/0x1/ohlcv", "ext")).toBe(
      "https://api.dexpaprika.com/networks/robinhood/pools/0x1/ohlcv"
    );
    expect(resolvePartUrl("/dex/latest/dex/search?q=HOOD", "ext")).toBe(
      "https://api.dexscreener.com/latest/dex/search?q=HOOD"
    );
    expect(resolvePartUrl("/rpc", "ext")).toBe("https://rpc.mainnet.chain.robinhood.com/");
    expect(resolvePartUrl("/registry.json", "ext")).toBe("/registry.json");
  });
});
