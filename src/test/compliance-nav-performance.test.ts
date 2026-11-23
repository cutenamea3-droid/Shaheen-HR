import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { navIsPending, shellMeta } from "@/lib/shell-meta";

describe("shellMeta (nav chrome sync)", () => {
  it("maps overview and section paths to stable titles", () => {
    expect(shellMeta("/").title).toBe("Compliance Dashboard");
    expect(shellMeta("/alerts").title).toBe("My Compliance Today");
    expect(shellMeta("/drug-tests").title).toBe("Drug Test Records");
    expect(shellMeta("/s/dmv").title).toMatch(/DMV/i);
    expect(shellMeta("/s/medical").title).toMatch(/Medical/i);
  });

  it("keeps title aligned with pathname (no stale Drug Tests label on /alerts)", () => {
    expect(shellMeta("/alerts").title).not.toMatch(/Drug/i);
    expect(shellMeta("/").title).not.toMatch(/Drug/i);
  });
});

describe("navIsPending", () => {
  it("is true while status is pending or locations disagree", () => {
    expect(
      navIsPending({
        status: "pending",
        isLoading: false,
        location: { pathname: "/alerts" },
        resolvedLocation: { pathname: "/drug-tests" },
      }),
    ).toBe(true);
    expect(
      navIsPending({
        status: "idle",
        isLoading: false,
        location: { pathname: "/alerts" },
        resolvedLocation: { pathname: "/drug-tests" },
      }),
    ).toBe(true);
    expect(
      navIsPending({
        status: "idle",
        isLoading: false,
        location: { pathname: "/alerts" },
        resolvedLocation: { pathname: "/alerts" },
      }),
    ).toBe(false);
  });
});

describe("compliance nav architecture", () => {
  it("uses a persistent Driver shell inside LockGate", () => {
    const lock = readFileSync(resolve(process.cwd(), "src/components/tracker/LockGate.tsx"), "utf8");
    const shell = readFileSync(resolve(process.cwd(), "src/components/tracker/AppShell.tsx"), "utf8");
    expect(lock).toMatch(/PersistentDriverShell/);
    expect(shell).toMatch(/ShellChromeContext/);
    expect(shell).toMatch(/useDeferredValue/);
    expect(shell).toMatch(/nav-pending|navIsPending/);
    expect(shell).toMatch(/shellMeta/);
  });

  it("forces sync route commits in AppShell (overrides Transitioner startTransition)", () => {
    const shell = readFileSync(resolve(process.cwd(), "src/components/tracker/AppShell.tsx"), "utf8");
    const router = readFileSync(resolve(process.cwd(), "src/router.tsx"), "utf8");
    expect(shell).toMatch(/router\.startTransition\s*=/);
    expect(shell).toMatch(/return true/);
    expect(router).toMatch(/defaultPendingMs:\s*0/);
  });

  it("still matches Driver + Admin routes (refresh-safe tree)", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    for (const path of ["/", "/drug-tests", "/alerts", "/s/dmv", "/admin", "/cv"]) {
      expect(router.matchRoutes(path).length).toBeGreaterThan(0);
    }
  });
});

describe("cloud save path preserved during nav work", () => {
  it("does not alter sync/save entry points in the store", async () => {
    const store = readFileSync(resolve(process.cwd(), "src/lib/store.ts"), "utf8");
    expect(store).toMatch(/export function startCloudSync/);
    expect(store).toMatch(/retrySync/);
    expect(store).toMatch(/useSyncStatus/);
    // Nav fix must not remove cloud pull/push cadence.
    expect(store).toMatch(/pullCloud|pushCloud|sync/);
  });

  it("AppShell still surfaces sync status + retry (save reliability UI)", () => {
    const shell = readFileSync(resolve(process.cwd(), "src/components/tracker/AppShell.tsx"), "utf8");
    expect(shell).toMatch(/useSyncStatus/);
    expect(shell).toMatch(/retrySync/);
    expect(shell).toMatch(/Saving to cloud|Saved to cloud|Not saved to cloud/);
  });
});

describe("Today alerts + refresh contracts", () => {
  it("alerts route still mounts the work center (many-alert surface)", () => {
    const alerts = readFileSync(resolve(process.cwd(), "src/routes/alerts.tsx"), "utf8");
    expect(alerts).toMatch(/AlertsWorkCenter/);
    expect(alerts).toMatch(/AppShell/);
  });

  it("spa hydration still defers LockGate (refresh of deep links)", () => {
    const root = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");
    expect(root).toMatch(/useHydrated/);
    expect(root).toMatch(/useDriverLock/);
  });
});

describe("CV #66 isolation", () => {
  it("nav performance sources do not touch the public CV route module", () => {
    const touched = [
      "src/router.tsx",
      "src/components/tracker/AppShell.tsx",
      "src/components/tracker/LockGate.tsx",
      "src/lib/shell-meta.ts",
    ];
    for (const rel of touched) {
      const src = readFileSync(resolve(process.cwd(), rel), "utf8");
      expect(src).not.toMatch(/routes\/cv/);
      expect(src).not.toMatch(/@\/cv\//);
    }
    void vi;
  });
});
