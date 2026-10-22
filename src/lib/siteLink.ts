import { isSolanaAddress } from "./validation";

/** Only valid, case-preserved mainnet mint addresses may enter token discovery. */
export function readTerminalLink(search: string) {
  const params = new URLSearchParams(search);
  const value = params.get("mint");
  const mint = isSolanaAddress(value) ? value : null;
  return { open: params.get("terminal") === "1" || Boolean(mint), mint };
}

/** Wallets inject into the website, so extension signing stays in a website tab. */
export function walletWebsiteHref(
  mint?: string,
  backend: "hosted" | "local" = "hosted",
) {
  const url = new URL(
    backend === "local" || import.meta.env.DEV
      ? "http://localhost:4664/"
      : "https://part-woad.vercel.app/",
  );
  url.searchParams.set("terminal", "1");
  if (mint) url.searchParams.set("mint", mint);
  return url.href;
}
