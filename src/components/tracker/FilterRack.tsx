import { cn } from "@/lib/utils";

/** Labeled filter groups — presentation only. */
export function FilterRack({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("tracker-filter-rack", className)}>{children}</div>;
}

export function FilterGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("tracker-filter-rack-group", className)} role="group" aria-label={label}>
      <span className="tracker-filter-rack-label">{label}</span>
      {children}
    </div>
  );
}
