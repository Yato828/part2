import { readLocal, saveLocal, safeUrl } from "../../lib/validation";
export type TokenDraft = {
  version: 1;
  name: string;
  symbol: string;
  description: string;
  image: string;
  supply: string;
  decimals: number;
  mintAuthority: boolean;
  freezeAuthority: boolean;
  story: string;
  socialPost: string;
};
export const EMPTY_DRAFT: TokenDraft = {
  version: 1,
  name: "",
  symbol: "",
  description: "",
  image: "",
  supply: "1000000",
  decimals: 6,
  mintAuthority: false,
  freezeAuthority: false,
  story: "",
  socialPost: "",
};
export function parseDraft(raw: unknown): TokenDraft {
  if (!raw || typeof raw !== "object") return { ...EMPTY_DRAFT };
  const r = raw as Record<string, unknown>;
  return {
    ...EMPTY_DRAFT,
    name: typeof r.name === "string" ? r.name.slice(0, 32) : "",
    symbol: typeof r.symbol === "string" ? r.symbol.slice(0, 10) : "",
    description:
      typeof r.description === "string" ? r.description.slice(0, 1500) : "",
    story: typeof r.story === "string" ? r.story.slice(0, 3000) : "",
    socialPost:
      typeof r.socialPost === "string" ? r.socialPost.slice(0, 500) : "",
    image: safeUrl(r.image) ?? "",
    supply:
      typeof r.supply === "string" && /^\d{1,20}(\.\d{1,9})?$/.test(r.supply)
        ? r.supply
        : EMPTY_DRAFT.supply,
    decimals:
      Number.isInteger(r.decimals) &&
      Number(r.decimals) >= 0 &&
      Number(r.decimals) <= 9
        ? Number(r.decimals)
        : 6,
    mintAuthority: r.mintAuthority === true,
    freezeAuthority: r.freezeAuthority === true,
  };
}
export const loadDraft = () =>
  readLocal("part.tokenDraft.v1", parseDraft, { ...EMPTY_DRAFT });
export const storeDraft = (draft: TokenDraft) =>
  saveLocal("part.tokenDraft.v1", draft);
export function draftAmount(draft: TokenDraft): bigint {
  if (
    !draft.name.trim() ||
    !/^[A-Za-z0-9_$-]{1,10}$/.test(draft.symbol) ||
    !/^\d+(\.\d+)?$/.test(draft.supply)
  )
    throw new Error(
      "Enter a name, a 1–10 character ticker and a positive supply.",
    );
  const [whole, frac = ""] = draft.supply.split(".");
  if (frac.length > draft.decimals)
    throw new Error("Supply exceeds the selected decimal precision.");
  const amount =
    BigInt(whole) * 10n ** BigInt(draft.decimals) +
    BigInt(frac.padEnd(draft.decimals, "0") || "0");
  if (amount <= 0n || amount > 18446744073709551615n)
    throw new Error("Supply must fit the SPL token u64 range.");
  return amount;
}
export function downloadFile(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const STYLE =
  "*{box-sizing:border-box}body{margin:0;background:#0a0a0a;color:#eee;font:16px system-ui;line-height:1.7}main{max-width:960px;margin:auto;padding:70px 28px}h1{font-size:clamp(48px,9vw,100px);line-height:1;letter-spacing:-4px}h2{font-size:28px}section{padding:28px 0;border-top:1px solid #333}p{max-width:680px;color:#bbb}a{color:#fff}small{letter-spacing:3px}nav{display:flex;gap:20px}footer{margin-top:60px;color:#999}";
const CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; connect-src 'none'";
export function websiteTemplate(draft: TokenDraft, idea = "") {
  const e = escapeHtml;
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${CSP}"><title>${e(draft.name || "Solana project")} · ${e(draft.symbol || "DRAFT")}</title><meta name="description" content="${e(draft.description)}"><meta property="og:title" content="${e(draft.name)}"><meta property="og:description" content="${e(draft.description)}"><style>${STYLE}</style></head><body><main><small>SOLANA MAINNET · PROJECT DRAFT</small><h1>${e(draft.name || "Your next idea.")}</h1><p>${e(draft.description || idea || "Add a description to make this page yours.")}</p><section><h2>${e(draft.symbol || "TOKEN")} / Token details</h2><p>Proposed supply: ${e(draft.supply)} · Decimals: ${draft.decimals}</p><p>Mint address: not deployed. No token purchase is offered by this draft.</p></section><section><h2>Our story</h2><p>${e(draft.story || idea || "Describe the idea, the people and the purpose.")}</p></section><section><h2>Roadmap</h2><p>Draft concept → review metadata and permissions → verify deployment support → publish confirmed mint details.</p></section><section><h2>FAQ</h2><h3>Which network?</h3><p>Solana mainnet.</p><h3>Is the token live?</h3><p>This is an editable project draft. Deployment and availability have not been verified.</p></section><footer>Independent project draft. Verify all information. No affiliation or investment guarantees.</footer></main></body></html>`;
}
/** Rebuild editable HTML from an allowlist; discard scripts, CSS, embeds and event handlers. */
export function sanitizePreview(source: string): string {
  const doc = new DOMParser().parseFromString(
    source.slice(0, 100000),
    "text/html",
  );
  const allowed = new Set([
    "MAIN",
    "SECTION",
    "HEADER",
    "FOOTER",
    "NAV",
    "DIV",
    "SPAN",
    "H1",
    "H2",
    "H3",
    "H4",
    "P",
    "SMALL",
    "STRONG",
    "EM",
    "B",
    "I",
    "UL",
    "OL",
    "LI",
    "BR",
    "HR",
    "A",
    "BLOCKQUOTE",
    "PRE",
    "CODE",
    "DETAILS",
    "SUMMARY",
  ]);
  const clean = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE)
      return escapeHtml(node.textContent ?? "");
    if (!(node instanceof Element) || !allowed.has(node.tagName)) return "";
    const tag = node.tagName.toLowerCase();
    const link = tag === "a" ? safeUrl(node.getAttribute("href")) : undefined;
    return `<${tag}${link ? ` href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer"` : ""}>${Array.from(node.childNodes).map(clean).join("")}</${tag}>`;
  };
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${CSP}"><title>${escapeHtml(doc.title || "Solana project draft")}</title><meta name="description" content="${escapeHtml(doc.querySelector('meta[name="description"]')?.getAttribute("content")?.slice(0, 1500) || "Solana project draft")}"><style>${STYLE}</style></head><body>${Array.from(doc.body.childNodes).map(clean).join("")}</body></html>`;
}
