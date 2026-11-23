import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";

/**
 * Shared Compliance + Admin sign-in shell: tall split layout, transparent logo
 * area on the form side, Made by HR / YOUSAF in the footer (not the hero).
 */
export function PortalLoginShell({
  children,
  about,
  formAside,
  footerRole = "Yousaf · HR & Compliance Specialist",
}: {
  children: ReactNode;
  /** Left column marketing panel (Compliance or Admin AboutPanel). */
  about: ReactNode;
  /** Optional slot above the form card (rarely needed). */
  formAside?: ReactNode;
  footerRole?: string;
}) {
  return (
    <div className="portal-login-shell flex min-h-screen flex-col bg-background">
      <div className="mx-auto grid w-full max-w-6xl flex-1 content-stretch items-stretch gap-8 px-4 py-8 lg:grid-cols-[1.2fr_1fr] lg:gap-12 lg:py-12 xl:min-h-[720px]">
        <div className="order-2 flex flex-col justify-center lg:order-1">{about}</div>
        <div className="order-1 flex flex-col justify-center lg:order-2">
          {formAside}
          {children}
        </div>
      </div>
      <footer className="border-t border-border/60 bg-card/40 px-4 py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
          <Link
            to="/cv"
            preload="intent"
            title="View Yousaf's CV"
            className="ui-press inline-flex items-center gap-2 text-sm font-bold text-primary"
          >
            <BadgeCheck className="size-4" /> Made by HR{" "}
            <span className="font-semibold opacity-70">· View CV →</span>
          </Link>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {footerRole}
          </p>
        </div>
      </footer>
    </div>
  );
}

export function PortalLoginCard({
  logoSrc,
  title,
  subtitle,
  children,
}: {
  logoSrc: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="ui-lift ui-glow mx-auto w-full max-w-md rounded-3xl border border-t-4 border-t-primary bg-card p-8 shadow-card">
      <img
        src={logoSrc}
        alt="Shaheen Transport LLC"
        className="mx-auto h-36 w-auto bg-transparent object-contain"
        style={{ background: "transparent" }}
      />
      <h1 className="mt-4 text-center text-2xl font-extrabold text-foreground">{title}</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">{subtitle}</p>
      {children}
    </div>
  );
}
