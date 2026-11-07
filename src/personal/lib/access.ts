/**
 * Client-side nav visibility for HR Personal.
 *
 * Strongest SPA gates without a new Personal backend:
 * - Never show HR Personal in the company AppSwitcher (ordinary users).
 * - Link appears only while already on `/personal` (so you can navigate back within Personal).
 * - Study UI is code-split and mounts only after local credential success.
 *
 * Honesty: this does NOT hide `/personal` from hosting/repo admins, anyone who knows
 * the URL, or anyone who can read the JS bundle. Button-hide is not security.
 * True URL ACL requires server auth (approval needed — not in this PR).
 */
const NAV_VISIBLE_KEY = "hr-personal-nav-visible-v1";

/** Opt-in flag retained for Vault testing — AppSwitcher ignores it on company routes. */
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

/** @deprecated Nav is never revealed on company routes. */
export function revealPersonalNavForOwner() {
  // Intentionally no-op for company switcher privacy.
}

export const PERSONAL_NAV_KEY = NAV_VISIBLE_KEY;

/** Ordinary company users never see the Personal switcher entry. */
export function shouldShowPersonalSwitcherLink(isOnPersonalRoute: boolean): boolean {
  return isOnPersonalRoute;
}
