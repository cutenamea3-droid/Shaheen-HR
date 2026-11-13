import { describe, expect, test } from "vitest";
import { buildSeed, type Row } from "@/lib/sections";
import {
  FOLLOW_UP_SECTION_ID,
  ensureFollowUpSection,
  filterFollowUps,
  followUpCounts,
  listFollowUps,
  suggestAppliedFollowUps,
} from "@/lib/follow-ups";
import { addFollowUp, updateFollowUp, deleteFollowUp, getData, FOLLOW_UP_HEADERS } from "@/lib/store";

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
