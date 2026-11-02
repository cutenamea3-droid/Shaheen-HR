import { Link, useRouterState } from "@tanstack/react-router";
import { FileCheck2, UsersRound } from "lucide-react";

/** Top bar that switches between the two separate systems. Each keeps its own data. */
export function AppSwitcher() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname.startsWith("/admin");
  const isCv = pathname === "/cv";
  const base =
    "ui-press inline-flex h-8 items-center justify-center gap-2 rounded-md px-2 text-[13px] font-semibold transition-colors sm:px-3";
  const on = "bg-primary text-primary-foreground shadow-sm";
  const off = "text-muted-foreground hover:bg-muted hover:text-foreground";
  return (
    <header
      className="app-switcher sticky top-0 z-50 flex items-center gap-3 border-b border-border bg-card px-3"
      style={{ height: 44, fontSize: 13 }}
    >
      <img src="/logo.jpg" alt="Shaheen Transport LLC" className="h-8 w-8 rounded object-contain" />
      <span className="hidden font-display text-[13px] font-bold text-foreground lg:inline">
        Shaheen Transport
      </span>
      <nav aria-label="Main navigation" className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-background p-1 sm:ml-4">
        <Link
          to="/"
          aria-label="Driver Compliance"
          title="Driver Compliance"
          className={`${base} ${!isAdmin && !isCv ? on : off}`}
        >
          <FileCheck2 className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Driver Compliance</span>
        </Link>
        <Link
          to="/admin"
          aria-label="Admin & Attendance"
          title="Admin & Attendance"
          className={`${base} ${isAdmin ? on : off}`}
        >
          <UsersRound className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Admin &amp; Attendance</span>
        </Link>
      </nav>
    </header>
  );
}
