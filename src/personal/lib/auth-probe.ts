import { isPreviewIsolated } from "@/lib/preview-isolated";
import { PERSONAL_SB_AUTH_STORAGE_KEY } from "@/personal/integrations/supabase/client";

/**
 * Probe Personal owner seat without bridging company JWTs.
 * Must use the same storage adapter as the Personal client — custom storage
 * prefixes keys as `${PERSONAL_SB_AUTH_STORAGE_KEY}:…`, so a bare getItem on
 * the storageKey alone misses the real session and a second createClient without
 * that adapter can split-brain Auth into a different localStorage slot.
 */
export async function probePersonalOwnerSeat(): Promise<boolean> {
  if (isPreviewIsolated()) return true;
  if (typeof window === "undefined") return false;

  // Fast path: any Personal-prefixed auth blob with an access_token.
  try {
    const prefix = `${PERSONAL_SB_AUTH_STORAGE_KEY}:`;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (k === PERSONAL_SB_AUTH_STORAGE_KEY || k.startsWith(prefix)) {
        const raw = window.localStorage.getItem(k);
        if (raw && raw.includes("access_token")) return true;
      }
    }
  } catch {
    /* ignore */
  }

  // Same Personal client + storage adapter (never Driver/Admin; never a 2nd client).
  try {
    const { getPersonalSupabase } = await import("@/personal/integrations/supabase/client");
    const client = getPersonalSupabase();
    if (!client) return false;
    const { data } = await client.auth.getSession();
    return Boolean(data.session?.user);
  } catch {
    return false;
  }
}

export function shouldShowPersonalSwitcherLink(isOnPersonalRoute: boolean): boolean {
  return isOnPersonalRoute;
}
