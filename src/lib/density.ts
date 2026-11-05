import { useSyncExternalStore } from "react";

/** UI-only table/card density — never synced as business data. */
export type Density = "compact" | "comfortable";

const KEY = "shaheen-ui-density";
const listeners = new Set<() => void>();
let value: Density = "comfortable";
let read = false;

function get(): Density {
  if (!read && typeof window !== "undefined") {
    read = true;
    const raw = localStorage.getItem(KEY);
    value = raw === "compact" ? "compact" : "comfortable";
    applyDom(value);
  }
  return value;
}

function applyDom(v: Density) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.density = v;
}

export function setDensity(v: Density) {
  value = v;
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* ignore */
  }
  applyDom(v);
  listeners.forEach((l) => l());
}

export function toggleDensity() {
  setDensity(get() === "compact" ? "comfortable" : "compact");
}

export const useDensity = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    get,
    () => "comfortable" as Density,
  );
