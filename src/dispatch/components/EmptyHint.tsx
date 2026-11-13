export function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-[color:var(--dispatch-border)] bg-white/60 px-3 py-4 text-sm text-[color:var(--dispatch-muted)]">{children}</p>;
}

export function SectionHelp({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-sm leading-relaxed text-[color:var(--dispatch-muted)]">{children}</p>;
}

export function StaleBadge() {
  return (
    <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
      Stale update
    </span>
  );
}
