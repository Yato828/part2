import { describe, expect, it } from "vitest";
import { isEthMethodAllowed } from "./ethAllow";

describe("wallet rpc allowlist", () => {
  it("allows swap send and chain switch", () => {
    expect(isEthMethodAllowed("eth_sendTransaction")).toBe(true);
    expect(isEthMethodAllowed("eth_requestAccounts")).toBe(true);
    expect(isEthMethodAllowed("wallet_switchEthereumChain")).toBe(true);
    expect(isEthMethodAllowed("eth_call")).toBe(true);
  });

  it("blocks signing and raw tx injection", () => {
    expect(isEthMethodAllowed("personal_sign")).toBe(false);
    expect(isEthMethodAllowed("eth_sign")).toBe(false);
    expect(isEthMethodAllowed("eth_signTypedData_v4")).toBe(false);
    expect(isEthMethodAllowed("eth_sendRawTransaction")).toBe(false);
    expect(isEthMethodAllowed("")).toBe(false);
  });
});
