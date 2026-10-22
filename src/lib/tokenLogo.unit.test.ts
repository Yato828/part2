import { describe, expect, it } from "vitest";
import { safeLogo } from "./tokenLogo";

describe("token artwork", () => {
  it("accepts HTTPS artwork and rejects unsafe or placeholder URLs", () => {
    expect(safeLogo("https://cdn.dexscreener.com/token.png")).toBe(
      "https://cdn.dexscreener.com/token.png",
    );
    expect(safeLogo("http://example.com/token.png")).toBeUndefined();
    expect(safeLogo("https://example.com/placeholder.png")).toBeUndefined();
  });
});
