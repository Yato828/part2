export const ASTRA_NAME = "Astra";
export const assistantLabel = (servedModel?: string) =>
  servedModel === "gpt-6-astra" || servedModel?.startsWith("gpt-6-astra-20")
    ? "ASTRA GPT-6"
    : ASTRA_NAME;
export type TokenContext = {
  chainId: "solana";
  mint: string;
  pool: string;
  symbol: string;
};
export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  at: number;
  model?: string;
};
export type AstraStatus = {
  configured: boolean;
  ready: boolean;
  model: string | null;
  label: string;
  reason: string;
  social: "not_connected";
  deployment: "disabled";
  rateLimit: "persistent" | "local" | "missing";
};
export type AstraResult = {
  text: string;
  model: string;
  at: number;
  sources: Array<{ name: string; at: string; ok: boolean }>;
};
