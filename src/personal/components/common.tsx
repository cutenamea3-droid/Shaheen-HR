import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`hp-panel ${className}`}>{children}</section>;
}

export function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="hp-title text-lg font-bold tracking-tight sm:text-xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-[var(--hp-muted)]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  accent = "violet",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "violet" | "teal" | "blue" | "amber";
}) {
  const ring =
    accent === "teal"
      ? "border-[var(--hp-teal)]/35"
      : accent === "blue"
        ? "border-[var(--hp-blue)]/35"
        : accent === "amber"
          ? "border-[var(--hp-amber)]/35"
          : "border-[var(--hp-violet)]/35";
  return (
    <div
      className={`hp-stat rounded-md border ${ring} bg-[var(--hp-elevated)] p-3 shadow-[var(--hp-shadow)] sm:p-4`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--hp-muted)]">
        {label}
      </div>
      <div className="hp-title mt-1 text-2xl font-bold tabular-nums text-[var(--hp-ink)]">{value}</div>
      {hint ? <div className="mt-1 text-xs text-[var(--hp-muted)]">{hint}</div> : null}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--hp-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Btn({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "teal";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const v =
    variant === "ghost"
      ? "hp-btn-ghost"
      : variant === "danger"
        ? "hp-btn-danger"
        : variant === "teal"
          ? "hp-btn-teal"
          : "hp-btn-primary";
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${v} ${className}`}>
      {children}
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--hp-border)] px-4 py-8 text-center text-sm text-[var(--hp-muted)]">
      {children}
    </div>
  );
}

export function courseLabel(
  courses: { id: string; code: string }[],
  id: string,
): string {
  if (id === "general") return "General";
  return courses.find((c) => c.id === id)?.code ?? id;
}
