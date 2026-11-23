import { useEffect, useSyncExternalStore } from "react";
import {
  clearFuturePlanExpandedIf,
  isFuturePlanExpanded,
  subscribeFuturePlanExpand,
  toggleFuturePlanExpanded,
  getFuturePlanExpandedKey,
} from "@/lib/future-plan-expand";

function getSnapshot() {
  return getFuturePlanExpandedKey();
}

/**
 * Accordion expand for one Future Plan cell. Starts collapsed; opening this key
 * collapses any other. Clears itself on unmount (navigate away) unless disabled
 * (embedded suggestion panels must not clear the parent cell's open key).
 */
export function useFuturePlanExpand(key: string, opts?: { clearOnUnmount?: boolean }) {
  const clearOnUnmount = opts?.clearOnUnmount !== false;
  const expandedKey = useSyncExternalStore(subscribeFuturePlanExpand, getSnapshot, () => null);
  const open = expandedKey === key;

  useEffect(() => {
    if (!clearOnUnmount) return;
    return () => {
      clearFuturePlanExpandedIf(key);
    };
  }, [key, clearOnUnmount]);

  return {
    open,
    toggle: () => toggleFuturePlanExpanded(key),
    isOpen: (k: string) => isFuturePlanExpanded(k),
  };
}
