import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
});

describe("Combined site", () => {
  it("serves Admin & Attendance at /admin", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes("/admin").at(-1)?.routeId).toBe("/admin");
  });

  it.each([
    "/cv",
    "/account",
    "/team",
    "/activity",
    "/drivers",
    "/alerts",
    "/drug-tests",
    "/records",
    "/s/dmv",
    "/dispatch",
    "/personal",
    "/access-denied",
  ])("matches the %s route", (path) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(path).at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("serves Dispatch shell at /dispatch", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes("/dispatch").at(-1)?.routeId).toBe("/dispatch");
  });

  it("serves Access Denied at /access-denied", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes("/access-denied").at(-1)?.routeId).toBe("/access-denied");
  });
});
