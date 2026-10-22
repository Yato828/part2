import { describe, expect, it } from "vitest";
import { readTerminalLink, walletWebsiteHref } from "./siteLink";

const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
describe("extension terminal handoff", () => {
  it("preserves the exact mint in both the outgoing link and incoming selection", () => {
    const url = new URL(walletWebsiteHref(mint, "local"));
    expect(url.origin).toBe("http://localhost:4664");
    expect(readTerminalLink(url.search)).toEqual({ open: true, mint });
    expect(readTerminalLink(`?mint=${mint}`)).toEqual({ open: true, mint });
  });
  it("opens an empty terminal without accepting malformed addresses or markup", () => {
    expect(readTerminalLink("?terminal=1&mint=%3Cscript%3E")).toEqual({
      open: true,
      mint: null,
    });
    expect(readTerminalLink("?mint=0x1234")).toEqual({
      open: false,
      mint: null,
    });
    expect(readTerminalLink("?mint=" + "1".repeat(10000))).toEqual({
      open: false,
      mint: null,
    });
    expect(readTerminalLink("?terminal=yes")).toEqual({
      open: false,
      mint: null,
    });
  });
});
