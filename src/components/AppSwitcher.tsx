import { useSyncExternalStore } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Brain, FileCheck2, UsersRound } from "lucide-react";
import { isPersonalNavVisible, PERSONAL_NAV_KEY } from "@/personal/lib/access";

function subscribeNav(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (!e.key || e.key === PERSONAL_NAV_KEY) cb();
  };
  window.addEventListener("storage", handler);
  window.addEventListener("hp-nav-change", cb as EventListener);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("hp-nav-change", cb as EventListener);
  };
}

function readNav(): boolean {
  return isPersonalNavVisible();
}

/** Top bar that switches between separate systems. Each keeps its own data. */
export function AppSwitcher() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname.startsWith("/admin");
  const isPersonal = pathname.startsWith("/personal");
  const isCv = pathname === "/cv";
  const isDriver = !isAdmin && !isPersonal && !isCv;
  const navEnabled = useSyncExternalStore(subscribeNav, readNav, () => false);
  /** Show Personal link only when already on route or owner opted-in (local flag). */
  const showPersonal = isPersonal || navEnabled;

  const base =
    "ui-press inline-flex h-8 items-center justify-center gap-2 rounded-md px-2.5 text-[13px] font-semibold tracking-tight transition-colors sm:px-3";
  /** Company systems keep brand orange when active. */
  const companyOn = "bg-primary text-primary-foreground shadow-sm";
  const companyOff = "text-muted-foreground hover:bg-muted hover:text-foreground";
  /** HR Personal uses violet / teal palette — never company orange. */
  const personalOn = "bg-[#8B5CF6] text-[#F4F7FF] shadow-sm";
  const personalOff = isPersonal
    ? "text-[#94A3B8] hover:bg-[#8B5CF6]/20 hover:text-[#C4B5FD]"
    : "text-muted-foreground hover:bg-[#8B5CF6]/10 hover:text-[#8B5CF6]";

  return (
    <header
      className={`app-switcher sticky top-0 z-50 flex items-center gap-3 border-b px-3 ${
        isPersonal
          ? "border-[#172238] bg-[#0B1220] text-[#F4F7FF]"
          : "border-border bg-card"
      }`}
      style={{ height: 44, fontSize: 13 }}
      data-hp-switcher={isPersonal ? "personal" : "company"}
    >
      {isPersonal ? (
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded bg-[#8B5CF6] text-[11px] font-bold text-[#F4F7FF]"
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
            <span className="hidden font-display text-[13px] font-bold tracking-tight text-[#F4F7FF] sm:inline">
              HR Personal
            </span>
            <span className="ml-2 hidden text-[11px] font-semibold text-[#94A3B8] lg:inline">
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
      <nav
        aria-label="System switcher"
        className={`ml-auto flex items-center gap-1 rounded-lg border p-1 sm:ml-4 ${
          isPersonal ? "border-[#172238] bg-[#172238]/80" : "border-border bg-background"
        }`}
      >
        <Link
          to="/"
          aria-label="Driver Compliance"
          title="Driver Compliance"
          aria-current={isDriver ? "page" : undefined}
          className={`${base} ${isDriver ? companyOn : isPersonal ? personalOff : companyOff}`}
        >
          <FileCheck2 className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Driver Compliance</span>
        </Link>
        <Link
          to="/admin"
          aria-label="Admin & Attendance"
          title="Admin & Attendance"
          aria-current={isAdmin ? "page" : undefined}
          className={`${base} ${isAdmin ? companyOn : isPersonal ? personalOff : companyOff}`}
        >
          <UsersRound className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Admin &amp; Attendance</span>
        </Link>
        {showPersonal ? (
          <Link
            to="/personal"
            aria-label="HR Personal"
            title="HR Personal"
            aria-current={isPersonal ? "page" : undefined}
            className={`${base} ${isPersonal ? personalOn : personalOff}`}
          >
            <Brain className="h-4 w-4 shrink-0 text-[#2DD4BF]" />
            <span className="hidden sm:inline">HR Personal</span>
          </Link>
        ) : null}
      </nav>
    </header>
  );
}
