/**
 * Build-time maintenance flag. Set VITE_MAINTENANCE=1 on Cloudflare Pages
 * (then redeploy) to show the banner. Unset / any other value → no banner.
 */
export function isMaintenanceMode(): boolean {
  return import.meta.env.VITE_MAINTENANCE === "1";
}
