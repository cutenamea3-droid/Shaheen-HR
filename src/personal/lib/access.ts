/**
 * Client-side nav visibility for HR Personal.
 *
 * Honesty: this only hides the AppSwitcher link for ordinary company users.
 * It does NOT hide `/personal` from anyone who knows the URL, nor from
 * hosting/repo admins who can read the source or deploy config.
 * Real access control requires server auth (separate Personal account).
 */
const NAV_VISIBLE_KEY = "hr-personal-nav-visible-v1";

export function isPersonalNavVisible(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(NAV_VISIBLE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setPersonalNavVisible(visible: boolean) {
  if (typeof window === "undefined") return;
  if (visible) localStorage.setItem(NAV_VISIBLE_KEY, "1");
  else localStorage.removeItem(NAV_VISIBLE_KEY);
  window.dispatchEvent(new Event("hp-nav-change"));
}

/** Call when the owner unlocks Personal so the switcher can show the entry. */
export function revealPersonalNavForOwner() {
  setPersonalNavVisible(true);
}

export const PERSONAL_NAV_KEY = NAV_VISIBLE_KEY;
