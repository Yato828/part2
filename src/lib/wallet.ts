import { useEffect, useState } from "react";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import type { StandardConnectFeature, StandardDisconnectFeature } from "@wallet-standard/features";
import type { SolanaSignAndSendTransactionFeature } from "@solana/wallet-standard-features";
import type { VersionedTransaction } from "@solana/web3.js";
import { rpc } from "./rpcFeed";

const MAINNET = "solana:mainnet";
export type SolProvider = {
  publicKey?: { toString(): string } | null;
  connect(): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  signAndSendTransaction(tx: VersionedTransaction): Promise<{ signature: string } | string>;
  on?(event: string, fn: (arg?: { toString(): string } | null) => void): void;
};
export type InjectedWallet = { rdns: string; name: string; provider: SolProvider };
type Snap = { wallets: InjectedWallet[]; account: string; walletName: string; bal: number | null };
let snap: Snap = { wallets: [], account: "", walletName: "", bal: null };
let selected: SolProvider | null = null;
const listeners = new Set<() => void>();
const bound = new WeakSet<SolProvider>();
const standardAdapters = new WeakMap<Wallet, SolProvider>();

function base58(bytes: Uint8Array) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry) { digits.push(carry % 58); carry = Math.floor(carry / 58); }
  }
  for (let i = 0; i < bytes.length - 1 && bytes[i] === 0; i++) digits.push(0);
  return digits.reverse().map((d) => alphabet[d]).join("");
}

function standardProvider(wallet: Wallet): SolProvider | null {
  const cached = standardAdapters.get(wallet);
  if (cached) return cached;
  const features = wallet.features as Wallet["features"] & StandardConnectFeature &
    StandardDisconnectFeature & SolanaSignAndSendTransactionFeature;
  if (!features["standard:connect"]?.connect ||
      !features["solana:signAndSendTransaction"]?.signAndSendTransaction) return null;
  let account: WalletAccount | undefined = wallet.accounts.find((a) => a.chains.includes(MAINNET));
  const provider: SolProvider = {
    get publicKey() { return account ? { toString: () => account!.address } : null; },
    async connect() {
      const result = await features["standard:connect"].connect();
      account = result.accounts.find((a) => a.chains.includes(MAINNET));
      if (!account) throw new Error(`${wallet.name} has no Solana mainnet account.`);
      return { publicKey: { toString: () => account!.address } };
    },
    async disconnect() {
      await features["standard:disconnect"]?.disconnect?.();
      account = undefined;
    },
    async signAndSendTransaction(tx) {
      if (!account) throw new Error("Wallet account is no longer connected.");
      const [result] = await features["solana:signAndSendTransaction"].signAndSendTransaction({
        account, chain: MAINNET, transaction: tx.serialize(),
        options: { preflightCommitment: "confirmed", maxRetries: 3 },
      });
      if (!result?.signature) throw new Error("Wallet returned no transaction signature.");
      return { signature: base58(result.signature) };
    },
  };
  standardAdapters.set(wallet, provider);
  return provider;
}

function emit() { snap = { ...snap }; listeners.forEach((fn) => fn()); }
export function discoverWallets(win: Window = window) {
  const injected = win as unknown as { phantom?: { solana?: SolProvider }; solflare?: SolProvider };
  const wallets: InjectedWallet[] = [];
  const seen = new Set<string>();
  for (const wallet of getWallets().get()) {
    if (!wallet.chains.includes(MAINNET)) continue;
    const provider = standardProvider(wallet);
    if (!provider) continue;
    const key = wallet.name.toLowerCase();
    seen.add(key);
    wallets.push({ rdns: `standard:${key}`, name: wallet.name, provider });
  }
  const addLegacy = (rdns: string, name: string, provider?: SolProvider) => {
    if (provider && !seen.has(name.toLowerCase())) wallets.push({ rdns, name, provider });
  };
  addLegacy("phantom", "Phantom", injected.phantom?.solana);
  addLegacy("solflare", "Solflare", injected.solflare);
  return wallets;
}
export function bootWalletDiscovery() {
  const wallets = discoverWallets();
  if (wallets.map((w) => w.rdns).join() !== snap.wallets.map((w) => w.rdns).join()) {
    snap.wallets = wallets; emit();
  }
}
export const getSolana = () => selected;
export const walletSnap = () => snap;
export async function refreshAccount() {
  const account = snap.account;
  if (!account) return;
  try {
    const b = await rpc<{ value: number }>("getBalance", [account, { commitment: "confirmed" }]);
    if (snap.account === account) { snap.bal = b.value / 1e9; emit(); }
  } catch { if (snap.account === account) { snap.bal = null; emit(); } }
}
export async function connectWallet(rdns?: string) {
  bootWalletDiscovery();
  const wallet = snap.wallets.find((w) => w.rdns === rdns) ?? snap.wallets[0];
  if (!wallet) throw new Error("Install a Solana Wallet Standard wallet, then refresh this page.");
  const result = await wallet.provider.connect();
  selected = wallet.provider;
  snap.account = result.publicKey.toString(); snap.walletName = wallet.name; emit();
  if (!bound.has(selected)) {
    const provider = selected; bound.add(provider);
    provider.on?.("accountChanged", (key) => {
      if (selected !== provider) return;
      snap.account = key?.toString() ?? ""; snap.bal = null; emit(); void refreshAccount();
    });
    provider.on?.("disconnect", () => {
      if (selected !== provider) return;
      snap.account = ""; snap.bal = null; selected = null; emit();
    });
  }
  void refreshAccount();
  return snap.account;
}
export async function disconnectWallet() {
  await selected?.disconnect(); selected = null; snap.account = ""; snap.walletName = ""; snap.bal = null; emit();
}
export function useWallet() {
  const [value, setValue] = useState(snap);
  useEffect(() => {
    const fn = () => setValue({ ...snap }); listeners.add(fn);
    const registry = getWallets();
    const offRegister = registry.on("register", bootWalletDiscovery);
    const offUnregister = registry.on("unregister", bootWalletDiscovery);
    bootWalletDiscovery();
    return () => { listeners.delete(fn); offRegister(); offUnregister(); };
  }, []);
  return value;
}
