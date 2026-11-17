import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSeed, type Row } from "@/lib/sections";
import {
  FOLLOW_UP_SECTION_ID,
  ensureFollowUpSection,
  filterFollowUps,
  followUpCounts,
  listFollowUps,
  rowToFollowUp,
  suggestAppliedFollowUps,
} from "@/lib/follow-ups";
import {
  addFollowUp,
  updateFollowUp,
  deleteFollowUp,
  getData,
  patchSection,
  FOLLOW_UP_HEADERS,
} from "@/lib/store";

function row(partial: Partial<Row> & { cells: string[] }): Row {
  return {
    id: partial.id ?? "r1",
    driverId: partial.driverId ?? "d1",
    cells: partial.cells,
    ...(partial.rosterKind ? { rosterKind: partial.rosterKind } : {}),
  };
}

function iso(offset: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

describe("follow-up tracker", () => {
  test("ensureFollowUpSection creates durable section shape (not localStorage SoT)", () => {
    const data = ensureFollowUpSection(buildSeed());
    const sec = data.sections[FOLLOW_UP_SECTION_ID];
    expect(sec).toBeTruthy();
    expect(sec.headers).toEqual([...FOLLOW_UP_HEADERS]);
    expect(sec.rows).toEqual([]);
  });

  test("rowToFollowUp / addFollowUp coerce non-string cells and fields", () => {
    const parsed = rowToFollowUp({
      id: "fu_num",
      driverId: "d1",
      cells: ["Driver", 42, "open", 20261117, null, "manual", "dmv", "CDL"] as unknown as string[],
      addedAt: 1,
    });
    expect(parsed.subject).toBe("42");
    expect(parsed.dueDate).toBe("20261117");
    expect(parsed.notes).toBe("");
    expect(() =>
      addFollowUp({
        driverId: "d_num",
        driver: "Num Driver",
        subject: 99 as unknown as string,
        dueDate: 20261120 as unknown as string,
        notes: null as unknown as string,
        source: "manual",
      }),
    ).not.toThrow();
  });

  test("add / update / delete follow-ups via store (tracker_sections path)", () => {
    const id = addFollowUp({
      driverId: "d_fu",
      driver: "Follow Driver",
      subject: "Call about Medical",
      dueDate: iso(2),
      source: "manual",
      sectionId: "medical",
      docType: "Medical Certificate",
    });
    const listed = listFollowUps(getData());
    expect(listed.some((f) => f.id === id && f.subject === "Call about Medical")).toBe(true);

    updateFollowUp(id, { status: "done" });
    expect(listFollowUps(getData()).find((f) => f.id === id)?.status).toBe("done");

    deleteFollowUp(id);
    expect(listFollowUps(getData()).some((f) => f.id === id)).toBe(false);
  });

  test("updateFollowUp heals corrupt non-array cells on the target row", () => {
    const id = addFollowUp({
      driverId: "d_corrupt",
      driver: "Corrupt Cells",
      subject: "Heal me",
      dueDate: iso(1),
      source: "manual",
    });
    const sec = getData().sections[FOLLOW_UP_SECTION_ID]!;
    const rows = (Array.isArray(sec.rows) ? sec.rows : []).map((r) =>
      r.id === id ? { ...r, cells: null as never } : r,
    );
    patchSection(FOLLOW_UP_SECTION_ID, { rows });
    expect(() => updateFollowUp(id, { subject: "Healed", status: "open" })).not.toThrow();
    expect(listFollowUps(getData()).find((f) => f.id === id)?.subject).toBe("Healed");
    const src = readFileSync(resolve(process.cwd(), "src/lib/store.ts"), "utf8");
    expect(src).toMatch(/updateFollowUp[\s\S]*?cellsOf\(r\)/);
    deleteFollowUp(id);
  });

  test("filters: open / today / overdue", () => {
    addFollowUp({
      driverId: "a",
      driver: "A",
      subject: "Open future",
      dueDate: iso(5),
      source: "manual",
    });
    addFollowUp({
      driverId: "b",
      driver: "B",
      subject: "Due today",
      dueDate: iso(0),
      source: "manual",
    });
    addFollowUp({
      driverId: "c",
      driver: "C",
      subject: "Overdue one",
      dueDate: iso(-3),
      source: "manual",
    });
    const all = listFollowUps(getData());
    expect(filterFollowUps(all, "today", "").some((f) => f.subject === "Due today")).toBe(true);
    expect(filterFollowUps(all, "overdue", "").some((f) => f.subject === "Overdue one")).toBe(true);
    const counts = followUpCounts(all);
    expect(counts.overdue).toBeGreaterThanOrEqual(1);
    expect(counts.today).toBeGreaterThanOrEqual(1);
  });

  test("filterFollowUps / followUpCounts tolerate non-array items", () => {
    expect(filterFollowUps(null as never, "all", "")).toEqual([]);
    expect(followUpCounts(undefined as never).all).toBe(0);
  });

  test("Applied DMV suggests follow-up without inventing Valid", () => {
    const data = buildSeed();
    for (const id of ["medical", "queries", "ssccdl", "docs", "info"] as const) {
      data.sections[id].rows = [];
    }
    data.sections.dmv.rows = [
      row({
        id: "dmv_app",
        driverId: "d_app",
        // name, text, status, date, text, note, active, plan, state, tempnote
        cells: ["Applied Driver", "", "Applied", iso(20), "", "", "Active", "", "CA", ""],
      }),
    ];
    const suggestions = suggestAppliedFollowUps(ensureFollowUpSection(data));
    expect(suggestions.some((s) => s.driver === "Applied Driver" && s.docType.includes("DMV"))).toBe(
      true,
    );
    // Status cell remains Applied in source data
    expect(data.sections.dmv.rows[0]!.cells[2]).toBe("Applied");
  });
});
