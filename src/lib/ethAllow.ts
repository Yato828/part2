const SIGN = /sign/i;

export function isEthMethodAllowed(method: string) {
  const m = method.trim();
  if (!m) return false;
  if (m === "eth_sendRawTransaction") return false;
  if (SIGN.test(m) && m !== "eth_sendTransaction") return false;
  return m.startsWith("eth_") || m.startsWith("wallet_") || m === "net_version";
}
