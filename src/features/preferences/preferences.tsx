import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { CANDLE_IVS, type Interval } from "../../lib/axiom";
import { readLocal, saveLocal } from "../../lib/validation";
import { validStreamUrl } from "../../lib/poolStream";
export type Preferences = {
  version: 1;
  theme: "midnight" | "graphite" | "black";
  accent: string;
  density: "comfortable" | "compact";
  textSize: "normal" | "large";
  upColor: string;
  downColor: string;
  showVolume: boolean;
  showGrid: boolean;
  showCrosshair: boolean;
  hollowCandles: boolean;
  liveUpdates: boolean;
  streamPrices: boolean;
  streamCommitment: "processed" | "confirmed";
  streamEndpoint: string;
  astraBackend: "hosted" | "local";
  refreshSeconds: 5 | 10 | 15 | 30;
  defaultInterval: Interval;
  visibleCandles: 80 | 120 | 200;
  followLatest: boolean;
  showMetrics: boolean;
  reducedMotion: boolean;
  tokenArtwork: boolean;
  aiScenario: boolean;
  scenarioSteps: 6 | 12;
  tradeFeed: boolean;
  holderTools: boolean;
  creationTools: boolean;
};
export const DEFAULT_PREFERENCES: Preferences = {
  version: 1,
  theme: "black",
  accent: "#eeeeee",
  density: "comfortable",
  textSize: "normal",
  upColor: "#22c55e",
  downColor: "#ef4444",
  showVolume: true,
  showGrid: true,
  showCrosshair: true,
  hollowCandles: false,
  liveUpdates: true,
  streamPrices: true,
  streamCommitment: "processed",
  streamEndpoint: "",
  astraBackend: "hosted",
  refreshSeconds: 5,
  defaultInterval: "5m",
  visibleCandles: 120,
  followLatest: true,
  showMetrics: true,
  reducedMotion: false,
  tokenArtwork: true,
  aiScenario: false,
  scenarioSteps: 6,
  tradeFeed: true,
  holderTools: true,
  creationTools: true,
};
export const isColor = (raw: unknown): raw is string =>
  typeof raw === "string" && /^#[\da-f]{6}$/i.test(raw);
export function parsePreferences(raw: unknown): Preferences {
  if (!raw || typeof raw !== "object" || (raw as Preferences).version !== 1)
    return { ...DEFAULT_PREFERENCES };
  const r = raw as Preferences,
    next = { ...DEFAULT_PREFERENCES };
  for (const key of Object.keys(next) as Array<keyof Preferences>) {
    const v = r[key];
    if (typeof next[key] === "boolean" && typeof v === "boolean")
      (next as Record<string, unknown>)[key] = v;
  }
  if (["midnight", "graphite", "black"].includes(r.theme)) next.theme = r.theme;
  if (["comfortable", "compact"].includes(r.density)) next.density = r.density;
  if (["normal", "large"].includes(r.textSize)) next.textSize = r.textSize;
  if (["processed", "confirmed"].includes(r.streamCommitment))
    next.streamCommitment = r.streamCommitment;
  next.streamEndpoint = validStreamUrl(r.streamEndpoint);
  if (["hosted", "local"].includes(r.astraBackend))
    next.astraBackend = r.astraBackend;
  for (const key of ["accent", "upColor", "downColor"] as const)
    if (isColor(r[key])) next[key] = r[key];
  if ([5, 10, 15, 30].includes(r.refreshSeconds))
    next.refreshSeconds = r.refreshSeconds;
  if (CANDLE_IVS.includes(r.defaultInterval))
    next.defaultInterval = r.defaultInterval;
  if ([80, 120, 200].includes(r.visibleCandles))
    next.visibleCandles = r.visibleCandles;
  if ([6, 12].includes(r.scenarioSteps)) next.scenarioSteps = r.scenarioSteps;
  return next;
}
const Context = createContext<{
  preferences: Preferences;
  update: (patch: Partial<Preferences>) => void;
  reset: () => void;
  storageError: boolean;
} | null>(null);
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(() =>
    readLocal("part.preferences.v1", parsePreferences, {
      ...DEFAULT_PREFERENCES,
    }),
  );
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    setStorageError(!saveLocal("part.preferences.v1", preferences));
  }, [preferences]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== "part.preferences.v1") return;
      try {
        setPreferences(parsePreferences(JSON.parse(event.newValue ?? "null")));
      } catch {
        /* Ignore malformed cross-tab updates. */
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return (
    <Context.Provider
      value={{
        preferences,
        update: (patch) =>
          setPreferences((p) => parsePreferences({ ...p, ...patch })),
        reset: () =>
          setPreferences((p) => ({
            ...DEFAULT_PREFERENCES,
            streamEndpoint: p.streamEndpoint,
            astraBackend: p.astraBackend,
          })),
        storageError,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function usePreferences() {
  const value = useContext(Context);
  if (!value) throw new Error("Preferences provider is missing");
  return value;
}
export function featureEnabled(id: string, p: Preferences) {
  return !(
    (id === "flow" && !p.tradeFeed) ||
    (["holders", "xray"].includes(id) && !p.holderTools) ||
    (["launch", "tweet", "website"].includes(id) && !p.creationTools)
  );
}
export const THEME = {
  midnight: {
    background: "#0b1018",
    panel: "#101824",
    raised: "#182232",
    edge: "#273447",
    text: "#e6edf7",
    muted: "#92a3b9",
  },
  graphite: {
    background: "#131619",
    panel: "#1b1f24",
    raised: "#252c34",
    edge: "#35404a",
    text: "#edf0f4",
    muted: "#9ca8b6",
  },
  black: {
    background: "#090909",
    panel: "#111111",
    raised: "#202020",
    edge: "#353535",
    text: "#eeeeee",
    muted: "#999999",
  },
} as const;

export function accentInk(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const n = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  const luminance =
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return (luminance + 0.05) / 0.055 > 1.05 / (luminance + 0.05)
    ? "#09121d"
    : "#ffffff";
}
