/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PART_SHELL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const chrome:
  | {
      runtime?: { id?: string };
      tabs?: {
        create: (props: { url: string; active?: boolean }) => Promise<{ id?: number } | undefined>;
        get?: (id: number) => Promise<unknown>;
        onRemoved?: { addListener: (fn: (id: number) => void) => void };
        onUpdated?: {
          addListener: (fn: (id: number, info: { status?: string }) => void) => void;
          removeListener: (fn: (id: number, info: { status?: string }) => void) => void;
        };
      };
      scripting?: {
        executeScript: (opts: {
          target: { tabId: number };
          world?: "MAIN" | "ISOLATED";
          func: (method: string, params: unknown[] | undefined) => Promise<unknown>;
          args?: [string, unknown[] | undefined];
        }) => Promise<Array<{ result?: unknown }>>;
      };
    }
  | undefined;
