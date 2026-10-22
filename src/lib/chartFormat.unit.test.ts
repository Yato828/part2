import { describe, expect, it } from "vitest";
import { chartPrecision, chartPrice } from "./chartFormat";

describe("readable chart prices", () => {
  it("keeps useful decimals for tiny Solana tokens", () => {
    expect(chartPrecision(0.00001234)).toBe(10);
    expect(chartPrice(0.00001234)).toBe("$0.0000123400");
  });

  it("uses grouped fixed labels for normal prices", () => {
    expect(chartPrice(119.5, 3)).toBe("$119.500");
    expect(chartPrice(12_345, 2)).toBe("$12,345.00");
  });
});
