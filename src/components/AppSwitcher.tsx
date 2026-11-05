import { Link, useRouterState } from "@tanstack/react-router";
import { Brain, FileCheck2, UsersRound } from "lucide-react";

/** Top bar that switches between separate systems. Each keeps its own data. */
export function AppSwitcher() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname.startsWith("/admin");
  const isPersonal = pathname.startsWith("/personal");
  const isCv = pathname === "/cv";
  const isDriver = !isAdmin && !isPersonal && !isCv;
  const base =
    "ui-press inline-flex h-8 items-center justify-center gap-2 rounded-md px-2.5 text-[13px] font-semibold tracking-tight transition-colors sm:px-3";
  const on = "bg-primary text-primary-foreground shadow-sm";
  const off = "text-muted-foreground hover:bg-muted hover:text-foreground";
  return (
    <header
      className="app-switcher sticky top-0 z-50 flex items-center gap-3 border-b border-border bg-card px-3"
      style={{ height: 44, fontSize: 13 }}
    >
      {isPersonal ? (
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded bg-[#8B5CF6] text-[11px] font-bold text-white"
          aria-hidden
        >
          HP
        </span>
      ) : (
        <img src="/logo.jpg" alt="Shaheen Transport LLC" className="h-8 w-8 rounded object-contain" />
      )}
      <div className="min-w-0 leading-tight">
        {isPersonal ? (
          <>
            <span className="hidden font-display text-[13px] font-bold tracking-tight text-foreground sm:inline">
              HR Personal
            </span>
            <span className="ml-2 hidden text-[11px] font-semibold text-muted-foreground lg:inline">
              Private study
            </span>
          </>
        ) : (
          <>
            <span className="hidden font-display text-[13px] font-bold tracking-tight text-foreground sm:inline">
              Shaheen Transport
            </span>
            <span className="ml-2 hidden text-[11px] font-semibold text-muted-foreground lg:inline">
              Management Portal
            </span>
          </>
        )}
      </div>
      <nav aria-label="System switcher" className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-background p-1 sm:ml-4">
        <Link
          to="/"
          aria-label="Driver Compliance"
          title="Driver Compliance"
          aria-current={isDriver ? "page" : undefined}
          className={`${base} ${isDriver ? on : off}`}
        >
          <FileCheck2 className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Driver Compliance</span>
        </Link>
        <Link
          to="/admin"
          aria-label="Admin & Attendance"
          title="Admin & Attendance"
          aria-current={isAdmin ? "page" : undefined}
          className={`${base} ${isAdmin ? on : off}`}
        >
          <UsersRound className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Admin &amp; Attendance</span>
        </Link>
        <Link
          to="/personal"
          aria-label="HR Personal"
          title="HR Personal"
          aria-current={isPersonal ? "page" : undefined}
          className={`${base} ${isPersonal ? on : off}`}
        >
          <Brain className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">HR Personal</span>
        </Link>
      </nav>
    </header>
  );
}
