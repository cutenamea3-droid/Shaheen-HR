import { isPreviewIsolated } from "@/lib/preview-isolated";

/**
 * Probe Personal owner seat without bridging company JWTs.
 * Full secure Personal Auth lives on PR #16 (`VITE_PERSONAL_*` + Personal project).
 * This shell only detects an existing Personal session storage key when present.
 */
export async function probePersonalOwnerSeat(): Promise<boolean> {
  if (isPreviewIsolated()) return true;
  if (typeof window === "undefined") return false;

  // Secure Personal session namespace (PR #16 design) — never Driver/Admin keys.
  try {
    const raw = window.localStorage.getItem("hr-personal-sb-auth-v1");
    if (raw && raw.includes("access_token")) return true;
  } catch {
    /* ignore */
  }

  // Optional Personal client when env is configured (does not use Driver/Admin clients).
  try {
    const url = (import.meta.env as Record<string, string | undefined>).VITE_PERSONAL_SUPABASE_URL;
    const key = (import.meta.env as Record<string, string | undefined>).VITE_PERSONAL_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return false;
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(url, key, {
      auth: {
        storageKey: "hr-personal-sb-auth-v1",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    const { data } = await client.auth.getSession();
    return Boolean(data.session?.user);
  } catch {
    return false;
  }
}

export function shouldShowPersonalSwitcherLink(isOnPersonalRoute: boolean): boolean {
  return isOnPersonalRoute;
}
