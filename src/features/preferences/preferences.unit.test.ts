import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  featureEnabled,
  parsePreferences,
  accentInk,
} from "./preferences";
describe("persistent interface preferences", () => {
  it("keeps primary labels readable for dark and light custom accents", () => {
    expect(accentInk("#000000")).toBe("#ffffff");
    expect(accentInk("#eeeeee")).toBe("#09121d");
  });
  it("recovers invalid saved versions and rejects injected styles and unsupported refresh rates", () => {
    expect(parsePreferences(null)).toMatchObject({
      theme: "black",
      accent: "#eeeeee",
      upColor: "#22c55e",
      downColor: "#ef4444",
    });
    expect(
      parsePreferences({ version: 9, accent: "red;position:fixed" }),
    ).toEqual(DEFAULT_PREFERENCES);
    const value = parsePreferences({
      version: 1,
      theme: "url(attacker)",
      accent: "#000000;display:none",
      upColor: "javascript:alert(1)",
      downColor: "#ff0000",
      refreshSeconds: 0,
      defaultInterval: "1s",
      visibleCandles: 999999,
    });
    expect(value.accent).toBe(DEFAULT_PREFERENCES.accent);
    expect(value.theme).toBe("black");
    expect(value.downColor).toBe("#ff0000");
    expect(value.refreshSeconds).toBe(5);
    expect(value.defaultInterval).toBe("5m");
  });
  it("retains explicit off switches, colors and supported presets", () => {
    expect(
      parsePreferences({ version: 1, theme: "midnight", accent: "#77bdfb" }),
    ).toMatchObject({ theme: "midnight", accent: "#77bdfb" });
    const value = parsePreferences({
      version: 1,
      theme: "graphite",
      accent: "#ABCDEF",
      liveUpdates: false,
      showVolume: false,
      aiScenario: true,
      scenarioSteps: 12,
      refreshSeconds: 10,
      density: "compact",
      textSize: "large",
    });
    expect(value).toMatchObject({
      theme: "graphite",
      accent: "#ABCDEF",
      liveUpdates: false,
      showVolume: false,
      aiScenario: true,
      scenarioSteps: 12,
      refreshSeconds: 10,
      density: "compact",
      textSize: "large",
    });
  });
  it("gates related panels consistently without disabling trading or settings", () => {
    const value = {
      ...DEFAULT_PREFERENCES,
      holderTools: false,
      creationTools: false,
      tradeFeed: false,
    };
    for (const id of ["xray", "holders", "launch", "tweet", "website", "flow"])
      expect(featureEnabled(id, value)).toBe(false);
    for (const id of ["terminal", "swap", "markets", "astra", "settings"])
      expect(featureEnabled(id, value)).toBe(true);
  });
});
