/** Lightweight refresh bus so secure-mode UIs re-fetch after mutations. */
const listeners = new Set<() => void>();

export function notifyDriverHrRefresh() {
  listeners.forEach((l) => l());
}

export function subscribeDriverHrRefresh(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
