/**
 * Feature flag for Personal secure auth + cloud persistence.
 * Default OFF so company prod stays on local mock until secrets + SQL are approved.
 */
import { isPersonalSupabaseConfigured } from "@/personal/integrations/supabase/client";

function flagOn(name: string): boolean {
  const v =
    (import.meta.env[name] as string | undefined) ||
    (typeof process !== "undefined" ? process.env[name] : undefined);
  return v === "1" || v === "true" || v === "yes";
}

/** True only when flag is set AND Personal Supabase URL/key are present. */
export function isPersonalSecureEnabled(): boolean {
  return flagOn("VITE_PERSONAL_AUTH_SECURE") && isPersonalSupabaseConfigured();
}

/** First-bootstrap signup (Preview only). Keep off after owner account exists. */
export function isPersonalSignupAllowed(): boolean {
  return isPersonalSecureEnabled() && flagOn("VITE_PERSONAL_ALLOW_SIGNUP");
}

export type PersonalAuthMode = "secure" | "local";

export function personalAuthMode(): PersonalAuthMode {
  return isPersonalSecureEnabled() ? "secure" : "local";
}
