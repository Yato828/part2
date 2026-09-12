export type PartShell = "web" | "ext";

export function partShell(): PartShell {
  if (import.meta.env.VITE_PART_SHELL === "ext") return "ext";
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.id) return "ext";
  } catch {
    /* node tests */
  }
  return "web";
}

export function isExtension() {
  return partShell() === "ext";
}
