import { describe, expect, it } from "vitest";
import { buildSeed, headersOf, rowsOf, type AppData } from "@/lib/sections";
import { collectDataQualityFindings } from "@/lib/data-quality";
import { buildDriverDossier } from "@/lib/driver-dossier";
import { classHistoryOf } from "@/lib/driver-meta";
import { dateOfHireOf } from "@/lib/driver-hr/hire-date";
import { buildComplianceHistory } from "@/lib/compliance-history";
import { buildInspectionSummaries } from "@/lib/inspection-readiness";
import { buildHandoverWatchHints } from "@/dispatch/lib/ops-controls";
import { applyPersonalBackup, parsePersonalBackup, PERSONAL_BACKUP_APP, PERSONAL_BACKUP_VERSION } from "@/personal/lib/backup";
import { usePersonal } from "@/personal/lib/store";
import { __applyPersonalCloudForTest } from "@/personal/lib/cloud-sync";

describe("rowsOf / headersOf", () => {
  it("coerces corrupt section shapes", () => {
    expect(rowsOf(null)).toEqual([]);
    expect(rowsOf({ rows: null })).toEqual([]);
    expect(rowsOf({ rows: { 0: { id: "x" } } })).toEqual([]);
    expect(headersOf(null)).toEqual([]);
    expect(headersOf({ headers: null })).toEqual([]);
    expect(headersOf({ headers: ["A", null] })).toEqual(["A", ""]);
  });

  it("data-quality / dossier / history / hire / class tolerate corrupt rows+headers", () => {
    const base = buildSeed();
    const broken = structuredClone(base) as AppData;
    const driverId = base.sections.dmv.rows[0]?.driverId ?? "d1";
    broken.sections.dmv = {
      ...broken.sections.dmv,
      headers: null as unknown as string[],
      rows: { not: "array" } as unknown as AppData["sections"]["dmv"]["rows"],
    };
    broken.sections.docs = {
      ...broken.sections.docs,
      headers: "bad" as unknown as string[],
      rows: null as unknown as AppData["sections"]["docs"]["rows"],
    };
    expect(() => collectDataQualityFindings(broken)).not.toThrow();
    expect(() => buildDriverDossier(broken, driverId)).not.toThrow();
    expect(() => buildComplianceHistory(broken, { limit: 10 })).not.toThrow();
    expect(() => classHistoryOf(broken, driverId)).not.toThrow();
    expect(() => dateOfHireOf(broken, driverId)).not.toThrow();
    expect(() => buildInspectionSummaries(broken)).not.toThrow();
  });

  it("Dispatch handover hints tolerate missing desk arrays", () => {
    expect(() =>
      buildHandoverWatchHints({
        loads: null as unknown as [],
        issues: undefined as unknown as [],
        followUps: { bad: true } as unknown as [],
      }),
    ).not.toThrow();
  });
});

describe("Personal backup apply coerces corrupt arrays", () => {
  it("does not install non-array study slices", () => {
    usePersonal.setState({ notes: [], courses: usePersonal.getState().courses });
    const env = parsePersonalBackup(
      JSON.stringify({
        app: PERSONAL_BACKUP_APP,
        version: PERSONAL_BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        data: {
          notes: { bad: true },
          courses: "nope",
          backlog: null,
          dayPlans: [],
          weeklyReviews: [],
          vaultNotes: "ok",
        },
      }),
    );
    expect(() => applyPersonalBackup(env)).not.toThrow();
    const s = usePersonal.getState();
    expect(Array.isArray(s.notes)).toBe(true);
    expect(Array.isArray(s.courses)).toBe(true);
    expect(Array.isArray(s.backlog)).toBe(true);
    expect(s.dayPlans && !Array.isArray(s.dayPlans)).toBe(true);
    expect(s.vaultNotes).toBe("ok");
  });

  it("Personal cloud apply skips corrupt non-array slices", () => {
    usePersonal.setState({
      notes: [{ id: "keep", courseId: "g", title: "Keep", body: "x", updatedAt: 1, tags: [] }],
      backlog: [{ id: "b1", label: "todo", estimatedMinutes: 10, done: false, courseId: "g", createdAt: 1 }],
      vaultNotes: "local",
    });
    expect(() =>
      __applyPersonalCloudForTest({
        notes: { corrupt: true } as unknown as [],
        backlog: "nope" as unknown as [],
        dayPlans: [] as unknown as Record<string, never>,
        vaultNotes: "from-cloud",
      }),
    ).not.toThrow();
    const s = usePersonal.getState();
    expect(s.notes[0]?.title).toBe("Keep");
    expect(s.backlog[0]?.label).toBe("todo");
    expect(s.vaultNotes).toBe("from-cloud");
  });
});
