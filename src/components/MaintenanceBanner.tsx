import { isMaintenanceMode } from "@/lib/maintenance";

/**
 * Site-wide maintenance strip. Renders nothing when VITE_MAINTENANCE is off
 * so production layout is unchanged until the flag is explicitly enabled.
 */
export function MaintenanceBanner() {
  if (!isMaintenanceMode()) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="maintenance-banner"
      data-testid="maintenance-banner"
    >
      Under maintenance
    </div>
  );
}
