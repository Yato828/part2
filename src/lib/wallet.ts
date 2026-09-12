import { useEffect, useState } from "react";
import { CHAIN_ID, CHAIN_NAME, EXPLORER, RPC } from "./const";
import { isExtension } from "./env";
import { extensionWalletProvider } from "./walletBridge";

export const RH_CHAIN = {
  chainId: "0x" + CHAIN_ID.toString(16),
  chainName: CHAIN_NAME,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: [RPC],
  blockExplorerUrls: [EXPLORER],
};

export type Eth = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (ev: string, cb: (...a: unknown[]) => void) => void;
  removeListener?: (ev: string, cb: (...a: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isRabby?: boolean;
};

export type InjectedWallet = {
  rdns: string;
  name: string;
  icon?: string;
  provider: Eth;
};

type Snap = {
  wallets: InjectedWallet[];
  account: string;
  walletName: string;
  chain: string;
  bal: bigint;
};

let selected: Eth | null = null;
let snap: Snap = { wallets: [], account: "", walletName: "", chain: "", bal: 0n };
const subs = new Set<() => void>();
let discoveryOn = false;

function emit() {
  snap = { ...snap, wallets: [...snap.wallets] };
  subs.forEach((fn) => fn());
}

function upsertWallet(w: InjectedWallet) {
  const i = snap.wallets.findIndex((x) => x.rdns === w.rdns);
  if (i >= 0) snap.wallets[i] = w;
  else snap.wallets.push(w);
}

function fallbackFromWindow() {
  const eth = (window as unknown as { ethereum?: Eth & { providers?: Eth[] } }).ethereum;
  if (!eth) return;
  const list = eth.providers?.length ? eth.providers : [eth];
  for (const p of list) {
    if (p.isRabby) upsertWallet({ rdns: "io.rabby", name: "Rabby Wallet", provider: p });
    else if (p.isMetaMask) upsertWallet({ rdns: "io.metamask", name: "MetaMask", provider: p });
    else upsertWallet({ rdns: "injected", name: "Wallet", provider: p });
  }
}

export function bootWalletDiscovery() {
  if (discoveryOn || typeof window === "undefined") return;
  discoveryOn = true;
  window.addEventListener("eip6963:announceProvider", ((e: Event) => {
    const { info, provider } = (e as CustomEvent<{ info: { rdns: string; name: string; icon: string }; provider: Eth }>).detail;
    upsertWallet({ rdns: info.rdns, name: info.name, icon: info.icon, provider });
    emit();
  }) as EventListener);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  fallbackFromWindow();
  emit();
}

export function getEth(): Eth | null {
  return selected ?? snap.wallets[0]?.provider ?? (window as unknown as { ethereum?: Eth }).ethereum ?? (isExtension() ? (extensionWalletProvider() as Eth | null) : null);
}

export function subscribeWallet(fn: () => void) {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function walletSnap() {
  return snap;
}

async function refresh(acc: string, eth: Eth) {
  const [hex, id] = await Promise.all([
    eth.request({ method: "eth_getBalance", params: [acc, "latest"] }) as Promise<string>,
    eth.request({ method: "eth_chainId" }) as Promise<string>,
  ]);
  snap.bal = BigInt(hex);
  snap.chain = id;
  snap.account = acc;
  emit();
}

const bound = new WeakSet<Eth>();

function bindProvider(eth: Eth) {
  if (bound.has(eth)) return;
  bound.add(eth);
  eth.on?.("accountsChanged", (accs: unknown) => {
    const list = accs as string[];
    snap.account = list[0] ?? "";
    if (list[0]) void refresh(list[0], eth);
    else emit();
  });
  eth.on?.("chainChanged", (id: unknown) => {
    snap.chain = String(id);
    emit();
  });
}

export async function ensureRobinhood(eth = getEth()) {
  if (!eth) throw new Error("wallet not found — install MetaMask or Rabby");
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: RH_CHAIN.chainId }],
    });
  } catch (e) {
    const err = e as { code?: number };
    if (err.code === 4902) {
      await eth.request({ method: "wallet_addEthereumChain", params: [RH_CHAIN] });
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: RH_CHAIN.chainId }],
      });
      return;
    }
    throw e;
  }
}

export async function connectWallet(rdns?: string) {
  bootWalletDiscovery();
  const w =
    (rdns ? snap.wallets.find((x) => x.rdns === rdns) : null) ??
    snap.wallets.find((x) => /rabby/i.test(x.rdns + x.name)) ??
    snap.wallets.find((x) => /metamask/i.test(x.rdns + x.name)) ??
    snap.wallets[0];
  const eth = w?.provider ?? getEth() ?? (isExtension() ? (extensionWalletProvider() as Eth | null) : null);
  if (!eth) throw new Error("wallet not found — install MetaMask or Rabby");
  selected = eth;
  bindProvider(eth);
  const accs = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const account = accs[0];
  if (!account) throw new Error("no account");
  snap.walletName = w?.name ?? walletLabel(eth);
  await ensureRobinhood(eth);
  await refresh(account, eth);
  return account;
}

export function disconnectWallet() {
  snap.account = "";
  snap.bal = 0n;
  emit();
}

export function refreshAccount() {
  const eth = getEth();
  if (!eth || !snap.account) return Promise.resolve();
  return refresh(snap.account, eth);
}

export async function ethBalance(account: string) {
  const eth = getEth();
  if (!eth) return 0n;
  const hex = (await eth.request({
    method: "eth_getBalance",
    params: [account, "latest"],
  })) as string;
  return BigInt(hex);
}

export async function chainIdHex() {
  const eth = getEth();
  if (!eth) return "";
  return (await eth.request({ method: "eth_chainId" })) as string;
}

export function walletLabel(eth?: Eth | null) {
  const p = eth ?? getEth();
  if (!p) return "Wallet";
  if (p.isRabby) return "Rabby Wallet";
  if (p.isMetaMask) return "MetaMask";
  return snap.walletName || "Wallet";
}

export function useWallet() {
  const [s, setS] = useState(snap);
  useEffect(() => {
    bootWalletDiscovery();
    const unsub = subscribeWallet(() => setS({ ...walletSnap(), wallets: [...walletSnap().wallets] }));
    const eth = getEth();
    if (eth) {
      eth.request({ method: "eth_accounts" }).then((a) => {
        const accs = a as string[];
        if (accs[0]) {
          selected = selected ?? eth;
          snap.walletName = snap.walletName || walletLabel(eth);
          bindProvider(eth);
          void refresh(accs[0], eth);
        }
      });
    }
    return unsub;
  }, []);
  return s;
}
