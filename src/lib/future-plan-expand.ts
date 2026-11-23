/**
 * Session expand state for Future Plan / suggestion cells.
 * Collapsed by default; at most one cell expanded at a time (per-driver accordion).
 * Cleared when navigating away (module state resets on full remount; explicit clear on unmount).
 */

const SESSION_KEY = "shaheen.futurePlanExpand.v1";

type Listener = () => void;

let expandedKey: string | null = readSession();
const listeners = new Set<Listener>();

function readSession(): string | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const v = sessionStorage.getItem(SESSION_KEY);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}

function writeSession(key: string | null) {
  try {
    if (typeof sessionStorage === "undefined") return;
    if (key) sessionStorage.setItem(SESSION_KEY, key);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

function notify() {
  for (const l of listeners) l();
}

export function futurePlanExpandKey(sectionId: string, rowId: string, planCol: number): string {
  return `${sectionId}:${rowId}:${planCol}`;
}

export function getFuturePlanExpandedKey(): string | null {
  return expandedKey;
}

export function isFuturePlanExpanded(key: string): boolean {
  return expandedKey === key;
}

/** Expand this key (collapses any other). Pass null to collapse all. */
export function setFuturePlanExpanded(key: string | null) {
  if (expandedKey === key) return;
  expandedKey = key;
  writeSession(key);
  notify();
}

export function toggleFuturePlanExpanded(key: string) {
  setFuturePlanExpanded(expandedKey === key ? null : key);
}

/** If this key is open, collapse it (e.g. cell unmount / navigate away). */
export function clearFuturePlanExpandedIf(key: string) {
  if (expandedKey === key) setFuturePlanExpanded(null);
}

/** Collapse all Future Plan / suggestion panels (My Compliance Today view reset). */
export function clearAllFuturePlanExpanded() {
  setFuturePlanExpanded(null);
}

export function subscribeFuturePlanExpand(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Count badge for collapsed Plans control. */
export function futurePlanCollapsedCount(opts: {
  hasSuggestion: boolean;
  suggestionActionable: boolean;
  hasSavedPlan: boolean;
}): number {
  let n = 0;
  if (opts.suggestionActionable) n += 1;
  else if (opts.hasSuggestion) n += 1;
  if (opts.hasSavedPlan) n += 1;
  return n;
}
