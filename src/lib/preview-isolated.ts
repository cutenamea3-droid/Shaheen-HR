/**
 * Local visual-preview gate. Never set on Cloudflare / .env.production.
 * Used by Driver Compliance and Admin & Attendance shells only.
 */
export function isPreviewIsolated(): boolean {
  return import.meta.env.VITE_PREVIEW_ISOLATED === "1";
}
