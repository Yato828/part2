import { useEffect, useRef, useState } from "react";
import { MODULES, type ModuleId, type Workspace } from "./store";
import { usePreferences, featureEnabled } from "../preferences/preferences";

export function Navigation({
  state,
  open,
  launcher,
}: {
  state: Workspace;
  open: (id: ModuleId) => void;
  launcher: () => void;
}) {
  const { preferences } = usePreferences();
  const activeGroup = MODULES.find((m) => m.id === state.active)?.group;
  return (
    <nav
      className={`workspace-nav ${state.collapsed ? "collapsed" : ""}`}
      aria-label="Workspace navigation"
    >
      <div className="nav-intro">
        <small>YOUR WORKSPACE</small>
      </div>
      {(
        [
          ["Terminal", "terminal", "T", "Chart & trade"],
          ["Intelligence", "astra", "A", "Research & AI"],
          ["Discover", "markets", "D", "Explore markets"],
          ["Create", "launch", "+", "Create"],
          ["Workspace", "settings", "S", "Settings"],
        ] as const
      ).map(([group, id, icon, label]) => (
        <div className="nav-group" key={id}>
          <button
            title={label}
            aria-label={
              group === "Terminal" ? "Back to Terminal" : `Open ${group}`
            }
            className={activeGroup === group ? "selected" : ""}
            onClick={() => open(id)}
          >
            <b>{icon}</b>
            <span>{label}</span>
          </button>
          {!state.collapsed && activeGroup === group && (
            <div className="nav-submodules">
              {MODULES.filter((m) => m.group === group && m.id !== id).map(
                (m) => (
                  <button
                    key={m.id}
                    disabled={!featureEnabled(m.id, preferences)}
                    className={state.active === m.id ? "selected" : ""}
                    onClick={() => open(m.id)}
                    title={
                      featureEnabled(m.id, preferences)
                        ? m.detail
                        : "Disabled in Settings"
                    }
                  >
                    {m.title}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
      <button
        className="nav-all-tools"
        title="All tools (Ctrl/Cmd+K)"
        aria-label="Add Panel"
        onClick={launcher}
      >
        <b>⌕</b>
        <span>
          All tools <kbd>⌘ K</kbd>
        </span>
      </button>
    </nav>
  );
}

export function Launcher({
  onOpen,
  onClose,
}: {
  onOpen: (id: ModuleId) => void;
  onClose: () => void;
}) {
  const { preferences } = usePreferences();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const filtered = MODULES.filter((m) =>
    `${m.title} ${m.group} ${m.detail}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    root.current?.querySelector("input")?.focus();
    return () => prior?.focus();
  }, []);
  useEffect(() => {
    root.current
      ?.querySelector(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);
  return (
    <div
      className="launcher-shade"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="module-launcher"
        role="dialog"
        aria-modal="true"
        aria-label="Add a panel"
        ref={root}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndex((i) => Math.min(i + 1, filtered.length - 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndex((i) => Math.max(0, i - 1));
          }
          if (
            e.key === "Enter" &&
            filtered[index] &&
            featureEnabled(filtered[index].id, preferences)
          ) {
            e.preventDefault();
            onOpen(filtered[index].id);
            onClose();
          }
          if (e.key === "Tab") {
            const nodes =
              root.current?.querySelectorAll<HTMLElement>("input, button");
            if (!nodes?.length) return;
            if (e.shiftKey && document.activeElement === nodes[0]) {
              e.preventDefault();
              nodes[nodes.length - 1].focus();
            } else if (
              !e.shiftKey &&
              document.activeElement === nodes[nodes.length - 1]
            ) {
              e.preventDefault();
              nodes[0].focus();
            }
          }
        }}
      >
        <div className="launcher-search">
          <input
            aria-label="Find a module"
            placeholder="Search tools, panels, settings…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
          />
          <button aria-label="Close launcher" onClick={onClose}>
            Esc
          </button>
        </div>
        <div className="launcher-results">
          {filtered.map((m, i) => (
            <button
              key={m.id}
              data-index={i}
              className={i === index ? "selected" : ""}
              disabled={!featureEnabled(m.id, preferences)}
              title={
                !featureEnabled(m.id, preferences)
                  ? "Disabled in Settings"
                  : undefined
              }
              onClick={() => {
                onOpen(m.id);
                onClose();
              }}
            >
              <span>
                <small>{m.group}</small>
                <b>{m.title}</b>
                <em>{m.detail}</em>
              </span>
              <span>↗</span>
            </button>
          ))}
          {!filtered.length && <p>No matching tools.</p>}
        </div>
        <footer>
          Solana mainnet <span>↑ ↓ to navigate · Enter to open</span>
        </footer>
      </div>
    </div>
  );
}
