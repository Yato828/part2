import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RPC } from "./const";
import { fetchTrades } from "./api";
import { loadCandleResult } from "./axiom";
describe.skipIf(!process.env.PART_LIVE_TESTS)("Solana mainnet RPC",()=>{
 it("returns a confirmed slot",async()=>{
 const res=await fetch(RPC,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getSlot",params:[{commitment:"confirmed"}]})});
 const body=await res.json();expect(body.error).toBeUndefined();expect(body.result).toBeGreaterThan(0);
 });
});

describe.skipIf(!process.env.PART_LIVE_TESTS)("live terminal data", () => {
 const nativeFetch = globalThis.fetch;
 beforeAll(() => {
   const base = process.env.PART_LIVE_BASE || "http://localhost:4664";
   globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
     const url = typeof input === "string" && input.startsWith("/") ? base + input : input;
     return nativeFetch(url, init);
   }) as typeof fetch;
 });
 afterAll(() => { globalThis.fetch = nativeFetch; });
 const pool = "6RXwMiLq8Qrsn3HWh6715T8iMtvmh9a7s4rqTkx2C3Jf";
 const mint = "26QZsh7sjrCTin8WkSZtx28mkZ3fzzXxgDE87wzipump";
 it("loads real Flow rows from the selected pool", async () => {
   // Flow needs a currently active pool; the historical memecoin fixture can go quiet.
   const rows = await fetchTrades("Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE", "So11111111111111111111111111111111111111112");
   expect(rows.length).toBeGreaterThan(0);
   expect(rows[0].hash.length).toBeGreaterThan(60);
   expect(rows[0].amount).toBeGreaterThan(0);
 });
 it("loads source-backed short candles without current-price anchoring", async () => {
   const result = await loadCandleResult(pool, "5m", mint, undefined, 0.0000154);
   expect(result.bars.length).toBeGreaterThan(0);
   expect(result.bars.every((b) => b.h >= b.l && b.c > 0)).toBe(true);
 });
 it("loads 1h, 4h and 1d without exposing provider errors", async () => {
   const pool = "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE";
   for (const interval of ["1h", "4h", "1d"]) {
     const result = await loadCandleResult(pool, interval, "So11111111111111111111111111111111111111112", undefined, 121);
     expect(result.bars.length).toBeGreaterThan(0);
   }
 });
});
