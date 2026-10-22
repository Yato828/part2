import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACE, parseWorkspace } from "./store";
import { isSolanaAddress, safeUrl } from "../../lib/validation";
import { WSOL, USDC } from "../../lib/const";
import {
  draftAmount,
  EMPTY_DRAFT,
  parseDraft,
  websiteTemplate,
} from "../create/draft";
import { parseWatchlist, walletChanges } from "../intelligence/walletData";
describe("workspace recovery and Solana validation", () => {
  it("recovers malformed and old saved state", () => {
    for (const value of [null, "bad", [], { version: 0 }, { version: 99 }])
      expect(parseWorkspace(value)).toEqual(DEFAULT_WORKSPACE);
  });
  it("filters invalid modules, pins and chains without losing valid ordering", () => {
    const s = parseWorkspace({
      version: 1,
      open: ["terminal", "astra", "astra", "stocks", "watch"],
      active: "stocks",
      pinned: ["bogus", "watch", "astra"],
      selectedMint: "0x123",
    });
    expect(s.open).toEqual(["terminal", "astra", "watch"]);
    expect(s.active).toBe("terminal");
    expect(s.pinned).toEqual(["watch"]);
    expect(s.selectedMint).toBe("");
  });
  it("validates 32-byte base58 keys and rejects non-Solana addresses", () => {
    expect(isSolanaAddress(WSOL)).toBe(true);
    expect(isSolanaAddress(USDC)).toBe(true);
    expect(isSolanaAddress("1".repeat(32))).toBe(true);
    expect(isSolanaAddress("1".repeat(44))).toBe(false);
    expect(isSolanaAddress("0x" + "a".repeat(40))).toBe(false);
  });
  it("rejects javascript, data, relative and credential-bearing URLs", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>",
      "/relative",
      "https://user:password@host.test/",
    ])
      expect(safeUrl(url)).toBeUndefined();
    expect(safeUrl("https://solscan.io")).toBe("https://solscan.io/");
  });
  it("deduplicates exact-case watch addresses and bounds local lists", () => {
    expect(
      parseWatchlist([
        { address: WSOL, label: "Main" },
        { address: WSOL },
        { address: "0x123" },
      ]),
    ).toEqual([{ address: WSOL, label: "Main", pinned: false }]);
  });
});
describe("draft precision and safe page generation", () => {
  it("checks decimal supply and SPL u64 overflow without floating point", () => {
    const draft = {
      ...EMPTY_DRAFT,
      name: "Example",
      symbol: "TEST",
      supply: "1.000001",
    };
    expect(draftAmount(draft)).toBe(1000001n);
    expect(() => draftAmount({ ...draft, supply: "1.0000001" })).toThrow();
    expect(() =>
      draftAmount({ ...draft, supply: "18446744073709551616", decimals: 0 }),
    ).toThrow();
    expect(() => draftAmount({ ...draft, supply: "0" })).toThrow();
  });
  it("escapes generated metadata and rejects unsafe persisted image URLs", () => {
    const draft = parseDraft({
      ...EMPTY_DRAFT,
      name: "<script>alert(1)</script>",
      description: '" onload="alert(1)',
      image: "javascript:alert(1)",
    });
    expect(draft.image).toBe("");
    const html = websiteTemplate(draft);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("default-src 'none'");
  });
});
describe("wallet activity semantics", () => {
  it("labels net token and SOL changes without claiming swaps or PnL", () => {
    const rows = walletChanges(
      {
        blockTime: 1700000000,
        transaction: { message: { accountKeys: [{ pubkey: WSOL }] } },
        meta: {
          err: null,
          preBalances: [2e9],
          postBalances: [1e9],
          preTokenBalances: [],
          postTokenBalances: [
            {
              accountIndex: 0,
              mint: USDC,
              owner: WSOL,
              uiTokenAmount: { uiAmountString: "10" },
            },
          ],
        },
      },
      { address: WSOL, label: "Main", pinned: false },
      "sig",
    );
    expect(rows.map((r) => r.action)).toEqual([
      "Token net received",
      "SOL net delta (incl. fees)",
    ]);
    expect(rows[1].amount).toBe(-1);
  });
});
