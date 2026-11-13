import { useEffect, useState } from "react";

/**
 * False during SSR and the first client render; true after mount.
 *
 * Cloudflare Pages serves a single SPA shell prerendered for `/` (see vite.config
 * `tanstackStart.spa`). Path-dependent markup in the root shell must match that
 * shell on the first client paint, or React 19 throws hydration error #418 and
 * the root error boundary can take down the whole portal.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
