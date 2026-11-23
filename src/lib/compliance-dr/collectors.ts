/**
 * Default collectors for Complete Backup — Driver Compliance only.
 * Never reads Admin app_state, Dispatch tables, or Personal study.
 */

import { listPortalAccounts, listPortalActivity } from "@/lib/cloud";
import { listDrugTestsForDrivers } from "@/lib/driver-hr/drug-test-api";
import { getDriverDrugTestMode } from "@/lib/driver-hr/drug-test-mode";
import { useDrugTestMock } from "@/lib/driver-hr/drug-test-mock";
import { getRateCard } from "@/lib/driver-hr/rate-card-api";
import { getDriverRateCardMode } from "@/lib/driver-hr/rate-card-mode";
import { useRateCardMock } from "@/lib/driver-hr/rate-card-mock";
import { SECTIONS } from "@/lib/sections";
import { getData, getDirtySectionIdsForTests } from "@/lib/store";
import type { DrCollectors } from "./types";

/** Driver ids from active compliance sections (preserves IDs). */
export function listDriverIdsFromAppData(): string[] {
  const data = getData();
  const ids = new Set<string>();
  for (const sec of SECTIONS) {
    const rows = data.sections[sec.id]?.rows;
    if (!Array.isArray(rows)) continue;
    for (const r of rows) {
      if (r?.driverId) ids.add(r.driverId);
    }
  }
  return [...ids].sort();
}

function readLocalPrefs(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof localStorage === "undefined") return out;
  const allowPrefixes = [
    "shaheen-ui-pref-",
    "shaheen-checklist-",
    "shaheen-sidebar-collapsed",
    "shaheen-compliance-today-detail",
    "shaheen-issues-only-",
    "shaheen-resize-lock",
    "shaheen-dark-mode",
    "shaheen-view-mode",
    "shaheen-work-mode",
    "shaheen-ui-density",
  ];
  const denyExact = new Set([
    "shaheen-driver-portal-secrets-v1",
    "shaheen-driver-portal-session-v1",
    "shaheen-pass",
    "shaheen-unlocked",
    "shaheen-hr-account-secrets-v1",
    "shaheen-hr-account-session-v1",
    "shaheen-hr-sb-session-backup-v1",
  ]);
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (denyExact.has(key)) continue;
    if (key.startsWith("sb-") || key.includes("auth-token")) continue;
    if (!allowPrefixes.some((p) => key === p || key.startsWith(p))) continue;
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) continue;
      try {
        out[key] = JSON.parse(raw);
      } catch {
        out[key] = raw;
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

async function defaultListDrug(
  driverIds: string[],
): Promise<{ events: unknown[]; error: string | null; mode: "mock" | "secure" | "none" }> {
  const mode = getDriverDrugTestMode();
  if (mode === "secure") {
    const res = await listDrugTestsForDrivers(driverIds, "compliance-dr-backup");
    return { events: res.events, error: res.error, mode: "secure" };
  }
  const events = useDrugTestMock.getState().events;
  return {
    events: Array.isArray(events) ? events : [],
    error: null,
    mode: events?.length ? "mock" : "none",
  };
}

async function defaultListRates(
  driverIds: string[],
): Promise<{ cards: unknown[]; error: string | null; mode: "mock" | "secure" | "none" }> {
  const mode = getDriverRateCardMode();
  if (mode === "secure") {
    const cards: unknown[] = [];
    let error: string | null = null;
    for (const id of driverIds) {
      try {
        cards.push(await getRateCard(id, "compliance-dr-backup"));
      } catch (e) {
        error = e instanceof Error ? e.message : "rate card fetch failed";
      }
    }
    return { cards, error, mode: "secure" };
  }
  const cards = driverIds.map((id) => useRateCardMock.getState().get(id));
  return { cards, error: null, mode: "mock" };
}

async function defaultFetchAttachment(
  url: string,
): Promise<{ ok: true; bytes: Uint8Array; contentType: string } | { ok: false; reason: string }> {
  try {
    if (!/^https?:\/\//i.test(url)) return { ok: false, reason: "not-http-url" };
    const res = await fetch(url, { method: "GET", credentials: "omit" });
    if (!res.ok) return { ok: false, reason: `http-${res.status}` };
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!buf.length) return { ok: false, reason: "empty-body" };
    // Soft corruption check: tiny non-image/pdf responses flagged by caller via content-type
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    return { ok: true, bytes: buf, contentType };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "fetch-failed" };
  }
}

/** Dirty section ids — exported for DR; falls back empty if store helper missing in older builds. */
function dirtyHint(): { dirtySectionIds: string[]; syncHint: string } {
  try {
    const ids = typeof getDirtySectionIdsForTests === "function" ? getDirtySectionIdsForTests() : [];
    return {
      dirtySectionIds: ids,
      syncHint: ids.length ? "local-unsynced-sections" : "clean",
    };
  } catch {
    return { dirtySectionIds: [], syncHint: "unknown" };
  }
}

export function createDefaultCollectors(): DrCollectors {
  return {
    getAppData: () => getData(),
    listDriverIds: listDriverIdsFromAppData,
    listDrugEvents: defaultListDrug,
    listRateCards: defaultListRates,
    listPortalAccounts: async () => {
      try {
        const accounts = await listPortalAccounts();
        // Strip anything that could look like a secret field
        const cleaned = accounts.map((a) => ({
          user_id: a.user_id,
          email: a.email,
          display_name: a.display_name,
          role: a.role,
          active: a.active,
        }));
        return { accounts: cleaned, error: null };
      } catch (e) {
        return { accounts: [], error: e instanceof Error ? e.message : "portal accounts failed" };
      }
    },
    listPortalActivity: async () => {
      try {
        const rows = await listPortalActivity();
        return { rows, error: null };
      } catch (e) {
        return { rows: [], error: e instanceof Error ? e.message : "portal activity failed" };
      }
    },
    readLocalPrefs,
    readOfflineDirty: dirtyHint,
    fetchAttachment: defaultFetchAttachment,
  };
}
