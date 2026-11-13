import { useEffect, useState } from "react";

/**
 * False during SSR and the first client render; true after mount.
 *
 * Cloudflare Pages serves a single SPA shell prerendered for `/` (see vite.config
 * `tanstackStart.spa`). Path-dependent markup in the root shell must match that
 * shell on the first client paint, or React 19 throws hydration error #418.
 *
 * Confirmed Prod (`638cf53` / `index-CfkCmF_H.js`): #418 on F5 for /admin,
 * /personal, /dispatch — mismatched components are `AppSwitcher` (active /
 * aria-current) and `RootComponent` LockGate presence. The throw is in the
 * root route, so `errorComponent` replaces the whole portal (full-page failure).
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
