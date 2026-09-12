import { EXPLORER } from "./const";
import { isExtension } from "./env";
import { isEthMethodAllowed } from "./ethAllow";

type BridgeEth = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

let tabId: number | undefined;
let bridging = false;
let cached: BridgeEth | null | undefined;

function tabs() {
  return typeof chrome !== "undefined" ? chrome.tabs : undefined;
}

function scripting() {
  return typeof chrome !== "undefined" ? chrome.scripting : undefined;
}

async function waitReady(id: number) {
  const api = tabs();
  if (!api?.onUpdated) {
    await new Promise((r) => setTimeout(r, 1200));
    return;
  }
  const updated = api.onUpdated;
  if (!updated) {
    await new Promise((r) => setTimeout(r, 1200));
    return;
  }
  await new Promise<void>((resolve) => {
    const t = setTimeout(() => {
      updated.removeListener(onUp);
      resolve();
    }, 8000);
    const onUp = (tid: number, info: { status?: string }) => {
      if (tid !== id || info.status !== "complete") return;
      clearTimeout(t);
      updated.removeListener(onUp);
      resolve();
    };
    updated.addListener(onUp);
  });
}

async function ensureTab() {
  const api = tabs();
  if (!api?.create) throw new Error("wallet bridge unavailable");
  if (tabId != null) {
    try {
      await api.get?.(tabId);
      return tabId;
    } catch {
      tabId = undefined;
    }
  }
  const tab = await api.create({ url: EXPLORER, active: true });
  if (tab?.id == null) throw new Error("wallet bridge tab failed");
  tabId = tab.id;
  api.onRemoved?.addListener((id: number) => {
    if (id === tabId) tabId = undefined;
  });
  await waitReady(tab.id);
  await new Promise((r) => setTimeout(r, 400));
  return tab.id;
}

async function pageRequest(method: string, params?: unknown[]) {
  const inject = scripting()?.executeScript;
  if (!inject) throw new Error("wallet bridge unavailable");
  const id = await ensureTab();
  const [hit] = await inject({
    target: { tabId: id },
    world: "MAIN",
    func: async (m: string, p: unknown[] | undefined) => {
      const eth = (globalThis as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!eth?.request) throw new Error("wallet not found — open MetaMask/Rabby on this tab");
      return eth.request({ method: m, params: p });
    },
    args: [method, params],
  });
  return hit?.result;
}

export function extensionWalletProvider(): BridgeEth | null {
  if (!isExtension()) return null;
  if (cached !== undefined) return cached;
  if (!scripting()?.executeScript || !tabs()?.create) {
    cached = null;
    return null;
  }
  cached = {
    request: async ({ method, params }) => {
      if (!isEthMethodAllowed(method)) throw new Error("blocked rpc method");
      if (bridging) throw new Error("wallet busy");
      bridging = true;
      try {
        return await pageRequest(method, params);
      } finally {
        bridging = false;
      }
    },
  };
  return cached;
}
