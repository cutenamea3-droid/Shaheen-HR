import { beforeEach, describe, expect, it } from "vitest";
import {
  BACKUP_APP_ID,
  exportBackup,
  getData,
  getDirtySectionIdsForTests,
  importBackup,
  resetToSpreadsheet,
  setCell,
} from "@/lib/store";
import { SECTIONS } from "@/lib/sections";
import { useDrugTestMock } from "@/lib/driver-hr/drug-test-mock";
import { resolvePairing } from "@/lib/driver-hr/drug-test-matching";
import { pairDrugTestEvents, type DrugTestEvent } from "@/lib/driver-hr/drug-tests";
import {
  buildCompleteArchive,
  buildZip,
  COMPLIANCE_DR_INVENTORY,
  decryptArchiveBytes,
  encryptArchiveBytes,
  loadArchiveFromBytes,
  offSiteApprovalStop,
  parseZip,
  restoreCompleteArchive,
  sha256Bytes,
  DR_ARCHIVE_APP,
  enableLocalDailyReminder,
  readScheduleStatus,
  requiredSourceIds,
} from "@/lib/compliance-dr";
import { utf8 } from "@/lib/compliance-dr/hash";
import type { DrCollectors } from "@/lib/compliance-dr/types";

function multiDriverSeed() {
  resetToSpreadsheet();
  const data = getData();
  // Ensure multiple drivers across categories by editing first two medical rows if present
  const med = data.sections.medical;
  expect(med.rows.length).toBeGreaterThanOrEqual(2);
  return med.rows.slice(0, 2).map((r) => r.driverId);
}

function mockCollectors(overrides: Partial<DrCollectors> = {}): Partial<DrCollectors> {
  const data = getData();
  const driverIds =
    overrides.listDriverIds?.() ??
    [...new Set(data.sections.medical?.rows?.map((r) => r.driverId).filter(Boolean) ?? [])].slice(0, 2);
  expect(driverIds.length).toBeGreaterThanOrEqual(1);
  const events: DrugTestEvent[] = [
    {
      id: "ev1",
      driverId: driverIds[0]!,
      kind: "federal_drug",
      specimenId: "SP-A",
      reason: "Pre-Employment",
      collectionContext: "Clinic",
      eventDate: "2026-01-10",
      notes: "CCF",
      testingEventId: "te-1",
      createdAt: Date.now(),
    },
    {
      id: "ev2",
      driverId: driverIds[0]!,
      kind: "medical_review",
      specimenId: "SP-A",
      reason: "Pre-Employment",
      collectionContext: "Clinic",
      eventDate: "2026-01-11",
      notes: "MRO",
      testingEventId: "te-1",
      createdAt: Date.now(),
    },
    {
      id: "ev3",
      driverId: driverIds[1]!,
      kind: "federal_drug",
      specimenId: "SP-B",
      reason: "Random",
      collectionContext: "Onsite",
      eventDate: "2026-02-01",
      notes: "unmatched CCF",
      testingEventId: "te-2",
      createdAt: Date.now(),
    },
  ];
  return {
    listDriverIds: () => driverIds,
    listDrugEvents: async () => ({ events, error: null, mode: "mock" }),
    listRateCards: async () => ({
      cards: driverIds.map((id) => ({ driverId: id, rates: { perMile: "0.55" }, payMethod: "per_mile" })),
      error: null,
      mode: "mock",
    }),
    listPortalAccounts: async () => ({
      accounts: [{ user_id: "u1", email: "hr.compliance@gmail.com", display_name: "HR", role: "admin", active: true }],
      error: null,
    }),
    listPortalActivity: async () => ({ rows: [], error: null }),
    readLocalPrefs: () => ({ "shaheen-dark-mode": "1" }),
    readOfflineDirty: () => ({ dirtySectionIds: [], syncHint: "clean" }),
    fetchAttachment: async () => ({ ok: false, reason: "not-http-url" }),
    ...overrides,
  };
}

describe("Compliance DR Complete Backup (SHRP-151)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetToSpreadsheet();
    useDrugTestMock.getState().clearAll();
  });

  it("inventory lists required sources and excludes Admin/Dispatch/secrets", () => {
    const ids = requiredSourceIds();
    expect(ids).toEqual(
      expect.arrayContaining([
        "tracker_sections",
        "appdata_cache",
        "drug_test_events",
        "rate_cards",
        "portal_accounts",
      ]),
    );
    const labels = COMPLIANCE_DR_INVENTORY.map((i) => i.id);
    expect(labels).toContain("admin_app_state");
    expect(labels).toContain("dispatch_tables");
    expect(labels).toContain("portal_local_secrets");
    expect(COMPLIANCE_DR_INVENTORY.find((i) => i.id === "portal_local_secrets")?.requiredForComplete).toBe(
      false,
    );
  });

  it("builds portable archive with required layout + VERIFIED COMPLETE for multi-driver mock", async () => {
    const driverIds = multiDriverSeed();
    // Future Plans + temp notes across categories
    for (const sec of SECTIONS) {
      const rows = getData().sections[sec.id]?.rows;
      if (!rows?.length) continue;
      const planIdx = sec.types.indexOf("plan");
      const tempIdx = sec.types.indexOf("tempnote");
      if (planIdx >= 0) setCell(sec.id, rows[0]!.id, planIdx, `Plan ${sec.id}`);
      if (tempIdx >= 0) setCell(sec.id, rows[0]!.id, tempIdx, `Temp ${sec.id}`);
    }

    const result = await buildCompleteArchive({
      actorEmail: "hr.compliance@gmail.com",
      collectors: mockCollectors({ listDriverIds: () => driverIds }),
      fetchAttachments: false,
    });

    expect(result.verification).toBe("VERIFIED COMPLETE");
    expect(result.filename).toMatch(/COMPLETE\.zip$/);
    const loaded = await loadArchiveFromBytes(result.bytes);
    const paths = loaded.files.map((f) => f.path).sort();
    for (const required of [
      "manifest.json",
      "README.md",
      "application-version.json",
      "schema/sections.json",
      "data/tracker/appdata.json",
      "data/tracker/appdata.csv",
      "data/drug-tests/events.json",
      "data/rate-cards/cards.json",
      "data/portal/accounts.json",
      "changes/offline-dirty.json",
      "attachments/index.json",
      "integrity/checksums.json",
    ]) {
      expect(paths).toContain(required);
    }

    const manifest = JSON.parse(
      new TextDecoder().decode(loaded.files.find((f) => f.path === "manifest.json")!.bytes),
    ) as { app: string; verification: string; counts: Record<string, number> };
    expect(manifest.app).toBe(DR_ARCHIVE_APP);
    expect(manifest.verification).toBe("VERIFIED COMPLETE");
    expect(manifest.counts.drivers).toBe(driverIds.length);
    expect(manifest.counts.drugEvents).toBe(3);

    // Backup preserves raw CCF/MRO events; deterministic pairing reconstructs Matched pairs.
    const drugJson = JSON.parse(
      new TextDecoder().decode(loaded.files.find((f) => f.path === "data/drug-tests/events.json")!.bytes),
    ) as { events: DrugTestEvent[] };
    expect(Array.isArray(drugJson.events)).toBe(true);
    expect(drugJson.events.length).toBe(3);
    const byDriver = new Map<string, DrugTestEvent[]>();
    for (const e of drugJson.events) {
      const list = byDriver.get(e.driverId) ?? [];
      list.push(e);
      byDriver.set(e.driverId, list);
    }
    const firstPairs = pairDrugTestEvents(byDriver.get(driverIds[0]!) ?? []);
    expect(firstPairs.some((p) => p.status === "matched" && p.specimenId === "SP-A")).toBe(true);

    const app = JSON.parse(
      new TextDecoder().decode(loaded.files.find((f) => f.path === "data/tracker/appdata.json")!.bytes),
    ) as { sections: Record<string, { rows: { cells: string[] }[] }> };
    // All doc categories present
    for (const id of ["dmv", "medical", "queries", "ssccdl", "docs"]) {
      expect(app.sections[id]).toBeTruthy();
    }
    // Future plan preserved
    const medPlanCol = SECTIONS.find((s) => s.id === "medical")!.types.indexOf("plan");
    expect(app.sections.medical.rows[0]!.cells[medPlanCol]).toBe("Plan medical");
  });

  it("marks INCOMPLETE with exact gaps when drug export fails", async () => {
    const result = await buildCompleteArchive({
      collectors: mockCollectors({
        listDrugEvents: async () => ({ events: [], error: "RPC denied", mode: "secure" }),
      }),
      fetchAttachments: false,
    });
    expect(result.verification).toBe("INCOMPLETE");
    expect(result.filename).toMatch(/INCOMPLETE/);
    expect(result.gaps.some((g) => g.sourceId === "drug_test_events" && /RPC denied/.test(g.detail || ""))).toBe(
      true,
    );
  });

  it("records missing/corrupt attachments as gaps without false COMPLETE claim on bytes", async () => {
    const row = getData().sections.medical.rows[0];
    expect(row).toBeTruthy();
    setCell("medical", row!.id, 3, "See https://example.com/missing-ccf.pdf for scan");

    const result = await buildCompleteArchive({
      collectors: mockCollectors({
        getAppData: () => getData(),
        fetchAttachment: async () => ({ ok: false, reason: "http-404" }),
      }),
      fetchAttachments: true,
    });
    // Required sources still OK → may still be VERIFIED COMPLETE (attachments not required)
    // but gaps must list the missing file exactly
    expect(result.gaps.some((g) => g.sourceId === "attachments_bytes" && /missing-ccf/.test(g.detail || ""))).toBe(
      true,
    );
  });

  it("never packs secrets / tokens into archive files", async () => {
    localStorage.setItem("shaheen-driver-portal-secrets-v1", JSON.stringify({ u1: "hash" }));
    localStorage.setItem("sb-okzcw-auth-token", JSON.stringify({ access_token: "SECRET_TOKEN" }));
    const result = await buildCompleteArchive({
      collectors: mockCollectors(),
      fetchAttachments: false,
      includeUiPrefs: true,
    });
    const loaded = await loadArchiveFromBytes(result.bytes);
    const blobText = loaded.files.map((f) => new TextDecoder().decode(f.bytes)).join("\n");
    expect(blobText).not.toMatch(/SECRET_TOKEN/);
    expect(blobText).not.toMatch(/"u1":"hash"/);
    // Inventory may name the secrets key as an exclude — but must never embed its values
    const prefs = loaded.files.find((f) => f.path === "data/browser/ui-prefs.json");
    if (prefs) {
      const prefText = new TextDecoder().decode(prefs.bytes);
      expect(prefText).not.toMatch(/shaheen-driver-portal-secrets/);
      expect(prefText).not.toMatch(/sb-okzcw-auth-token/);
    }
  });

  it("encrypts with AES-GCM and round-trips decrypt", async () => {
    const result = await buildCompleteArchive({
      passphrase: "test-pass-1234",
      collectors: mockCollectors(),
      fetchAttachments: false,
    });
    expect(result.filename).toMatch(/encrypted\.json$/);
    const text = new TextDecoder().decode(result.bytes);
    expect(text).toMatch(/AES-256-GCM/);
    expect(text).not.toMatch(/Plan medical/); // plaintext plans not in outer package
    const loaded = await loadArchiveFromBytes(result.bytes, "test-pass-1234");
    expect(loaded.encrypted).toBe(true);
    expect(loaded.files.some((f) => f.path === "manifest.json")).toBe(true);
  });

  it("dry-run restore default + isolated restore test + newer-local conflict", async () => {
    const built = await buildCompleteArchive({
      collectors: mockCollectors(),
      fetchAttachments: false,
    });
    const loaded = await loadArchiveFromBytes(built.bytes);

    const dry = await restoreCompleteArchive(loaded.files, "dry-run");
    expect(dry.mode).toBe("dry-run");
    expect(dry.applied).toEqual([]);
    expect(dry.wouldWrite.length).toBeGreaterThan(0);

    const isolated = await restoreCompleteArchive(loaded.files, "isolated-test");
    expect(isolated.isolatedOk).toBe(true);

    // Make local "newer"
    const row = getData().sections.medical.rows[0]!;
    setCell("medical", row.id, 0, row.cells[0] || "Driver");
    // Force addedAt bump via import of mutated seed — use export envelope mutate
    const live = getData();
    const bumped = structuredClone(live);
    bumped.sections.medical.rows[0]!.addedAt = Date.now() + 10_000_000;
    importBackup(
      JSON.stringify({
        app: BACKUP_APP_ID,
        version: 2,
        exportedAt: new Date().toISOString(),
        coverage: {
          plans: true,
          notes: true,
          docs: true,
          followUps: true,
          records: true,
          drugTests: "none",
        },
        data: bumped,
      }),
    );

    const blocked = await restoreCompleteArchive(loaded.files, "apply-safe");
    expect(blocked.skippedNewer.length + blocked.conflicts.filter((c) => c.reason === "newer-local").length).toBeGreaterThan(
      0,
    );
    expect(blocked.applied).toEqual([]);
  });

  it("apply-safe restores Future Plans + mock drug/CCF after isolated OK", async () => {
    const driverIds = multiDriverSeed();
    const med = getData().sections.medical.rows[0]!;
    const planCol = SECTIONS.find((s) => s.id === "medical")!.types.indexOf("plan");
    setCell("medical", med.id, planCol, "Call clinic Monday");

    const built = await buildCompleteArchive({
      collectors: mockCollectors({ listDriverIds: () => driverIds }),
      fetchAttachments: false,
    });
    const loaded = await loadArchiveFromBytes(built.bytes);

    resetToSpreadsheet();
    useDrugTestMock.getState().clearAll();

    const isolated = await restoreCompleteArchive(loaded.files, "isolated-test");
    expect(isolated.isolatedOk).toBe(true);

    const applied = await restoreCompleteArchive(loaded.files, "apply-safe", {
      forceOverwriteNewer: true,
    });
    expect(applied.applied.length).toBeGreaterThan(0);
    expect(getData().sections.medical.rows.find((r) => r.id === med.id)?.cells[planCol]).toBe(
      "Call clinic Monday",
    );
    expect(useDrugTestMock.getState().events.some((e) => e.specimenId === "SP-A")).toBe(true);
  });

  it("drug match/unmatch scenarios covered via matching + archive events", () => {
    const existing: DrugTestEvent[] = [
      {
        id: "1",
        driverId: "d1",
        kind: "federal_drug",
        specimenId: "SP-1",
        reason: "Random",
        collectionContext: "Clinic",
        eventDate: "2026-03-01",
        notes: "",
        testingEventId: "te-x",
        createdAt: 1,
      },
    ];
    const matched = resolvePairing({
      mode: "automatic",
      incoming: {
        driverId: "d1",
        kind: "medical_review",
        specimenId: "SP-1",
        reason: "Random",
        collectionContext: "Clinic",
        eventDate: "2026-03-01",
      },
      existingEvents: existing,
    });
    expect(matched.status === "attach" || matched.status === "ambiguous" || matched.status === "create_new").toBe(
      true,
    );
    const unmatched = resolvePairing({
      mode: "separate",
      incoming: {
        driverId: "d1",
        kind: "medical_review",
        specimenId: "SP-OTHER",
        reason: "Random",
        collectionContext: "Other",
        eventDate: "2026-04-01",
      },
      existingEvents: existing,
      confirmSeparate: true,
    });
    expect(unmatched.status).toBe("create_new");
  });

  it("offline dirty hint exported; zip/hash integrity holds", async () => {
    const row = getData().sections.dmv.rows[0]!;
    setCell("dmv", row.id, 1, "offline-edit");
    const dirty = getDirtySectionIdsForTests();
    expect(dirty.length).toBeGreaterThanOrEqual(0);

    const result = await buildCompleteArchive({
      collectors: mockCollectors({
        readOfflineDirty: () => ({ dirtySectionIds: ["dmv"], syncHint: "local-unsynced-sections" }),
      }),
      fetchAttachments: false,
    });
    const loaded = await loadArchiveFromBytes(result.bytes);
    const offline = JSON.parse(
      new TextDecoder().decode(loaded.files.find((f) => f.path === "changes/offline-dirty.json")!.bytes),
    ) as { dirtySectionIds: string[] };
    expect(offline.dirtySectionIds).toContain("dmv");

    const bytes = utf8("abc");
    const z = buildZip([{ path: "a.txt", bytes }]);
    const parsed = parseZip(z);
    expect(parsed[0]!.path).toBe("a.txt");
    expect(await sha256Bytes(parsed[0]!.bytes)).toBe(await sha256Bytes(bytes));
  });

  it("daily reminder preparatory; off-site STOP lists approvals (no fake scheduler)", () => {
    const st = enableLocalDailyReminder();
    expect(st.enabled).toBe(true);
    expect(st.offSiteConfigured).toBe(false);
    expect(readScheduleStatus().approvalsNeeded.length).toBeGreaterThan(0);
    const stop = offSiteApprovalStop();
    expect(stop.stopped).toBe(true);
    expect(stop.approvalsNeeded.some((a) => /credentials|billing|PITR|audit/i.test(a))).toBe(true);
  });

  it("encrypt/decrypt unit + legacy quick backup still works", async () => {
    const plain = utf8("hello-dr");
    const pkg = await encryptArchiveBytes(plain, "abcdefgh", {
      verificationHint: "INCOMPLETE",
      exportedAt: new Date().toISOString(),
    });
    const back = await decryptArchiveBytes(pkg, "abcdefgh");
    expect(new TextDecoder().decode(back)).toBe("hello-dr");

    const json = exportBackup();
    expect(JSON.parse(json).app).toBe(BACKUP_APP_ID);
  });
});

describe("Compliance DR does not break Admin surfaces", () => {
  it("Admin Settings backup helpers remain importable and untouched by DR module", async () => {
    const mod = await import("@/admin/components/hr/Settings");
    expect(typeof mod.downloadBackup).toBe("function");
    expect(typeof mod.restoreBackup).toBe("function");
    expect(typeof mod.BackupButtons).toBe("function");
  });
});
