import { useSyncExternalStore } from "react";

const KEY = "shaheen-work-mode";
const listeners = new Set<() => void>();
let on = false;
let read = false;

function get() {
  if (!read && typeof window !== "undefined") {
    read = true;
    on = localStorage.getItem(KEY) === "1";
  }
  return on;
}

export function setWorkMode(v: boolean) {
  on = v;
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export const useWorkMode = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    get,
    () => false,
  );
