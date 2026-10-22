import { describe, expect, it } from "vitest";
import {
  buildScenario,
  parseScenarioRequest,
  scenarioPrompt,
} from "./scenario";
import { WSOL } from "../../lib/const";
const request = parseScenarioRequest({
  chainId: "solana",
  mint: WSOL,
  pool: "11111111111111111111111111111111",
  interval: "5m",
  steps: 6,
});
const bars = [{ t: 1700000000000, o: 100, h: 110, l: 90, c: 100, v: 1000 }];
const output = {
  changesPct: [1, -1, 2, -2, 3, 0],
  explanation: "A hypothetical path; either direction remains possible.",
  assumptions: ["Liquidity and market conditions may change."],
};
describe("separate hypothetical chart paths", () => {
  it("uses the observed anchor and exact future intervals without altering source bars", () => {
    const before = JSON.stringify(bars);
    const result = buildScenario(
      output,
      request,
      bars,
      "GeckoTerminal",
      Date.now(),
      "gpt-6-astra",
    );
    expect(result.hypothetical).toBe(true);
    expect(result.points.map((p) => p.price)).toEqual([
      101, 99, 102, 98, 103, 100,
    ]);
    expect(result.points[0].t).toBe(bars[0].t + 300000);
    expect(JSON.stringify(bars)).toBe(before);
  });
  it("rejects unsupported networks, addresses, intervals and horizons", () => {
    for (const patch of [
      { chainId: "ethereum" },
      { mint: "https://attacker.example" },
      { interval: "1s" },
      { interval: "toString" },
      { interval: "__proto__" },
      { steps: 600 },
      { steps: "6" },
    ])
      expect(() => parseScenarioRequest({ ...request, ...patch })).toThrow();
  });
  it("rejects nonfinite, excessive or wrong-length paths instead of substituting a local prediction", () => {
    for (const changesPct of [
      [1, 2],
      [0, 1, 2, 3, 4, Infinity],
      [0, 1, 2, 3, 4, -100],
      [0, 1, 2, 3, 4, "5"],
    ])
      expect(() =>
        buildScenario(
          { ...output, changesPct },
          request,
          bars,
          "Source",
          Date.now(),
          "gpt-6-astra",
        ),
      ).toThrow();
  });
  it("sends only observed candle numbers with explicit uncertainty instructions", () => {
    const prompt = scenarioPrompt(request, bars, "GeckoTerminal", Date.now());
    expect(prompt).toContain("not an investment forecast");
    expect(prompt).toContain("exactly 6");
    expect(prompt).toContain(
      JSON.stringify([bars[0].t, 100, 110, 90, 100, 1000]),
    );
  });
});
