import { buildSeed, SECTIONS, type Row } from "@/lib/sections";
import {
  analyzeRow,
  appliedExpiryView,
  normStatus,
  statusExpiryCol,
} from "@/lib/alerts";
import { test, expect, afterEach, vi } from "vitest";

function isoOffset(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function row(cells: string[], id = "r1"): Row {
  return { id, driverId: `d-${id}`, cells };
}

afterEach(() => {
  vi.useRealTimers();
});

test("statusExpiryCol pairs DMV and Queries Applied columns only", () => {
  expect(statusExpiryCol("dmv", 2)).toBe(3);
  expect(statusExpiryCol("queries", 1)).toBe(2);
  expect(statusExpiryCol("queries", 3)).toBe(4);
  expect(statusExpiryCol("medical", 1)).toBeNull();
  expect(statusExpiryCol("ssccdl", 2)).toBeNull();
  expect(statusExpiryCol("docs", 2)).toBeNull();
});

test("appliedExpiryView keeps Application and Expiration independent", () => {
  const remaining = appliedExpiryView(isoOffset(10))!;
  expect(remaining.application).toBe("Applied");
  expect(remaining.expiration).toBe("Expiring Soon");
  expect(remaining.label).toBe("Applied + 10 Days Remaining");
  expect(remaining.hint).toBe("Expiring Soon · 10 Days Remaining");
  expect(remaining.dateHint).toBe("10 Days Remaining");
  expect(remaining.daysLeft).toBe(10);

  const far = appliedExpiryView(isoOffset(60))!;
  expect(far.application).toBe("Applied");
  expect(far.expiration).toBe("Valid");
  expect(far.label).toBe("Applied + 60 Days Remaining");
  expect(far.hint).toBe("Valid · 60 Days Remaining");

  const expired = appliedExpiryView(isoOffset(-5))!;
  expect(expired.application).toBe("Applied");
  expect(expired.expiration).toBe("Expired");
  expect(expired.label).toBe("Expired + Applied");
  expect(expired.hint).toBe("Expired · 5d overdue");
  expect(expired.dateHint).toBe("5d overdue");
  expect(expired.tone).toBe("danger");

  const today = appliedExpiryView(isoOffset(0))!;
  expect(today.expiration).toBe("Expiring Soon");
  expect(today.label).toBe("Applied + Expires today");

  // No path returns Renewed or rewrites Application to Valid.
  for (const v of [remaining, far, expired, today]) {
    expect(v.application).toBe("Applied");
    expect(v.label.toLowerCase()).not.toMatch(/renewed/);
    // expiration may be "Valid" (date still good) while application stays Applied
    if (v.expiration === "Valid") expect(v.application).toBe("Applied");
  }
});

test("DMV analyzeRow Applied keeps countdown; never auto-Valid", () => {
  const def = SECTIONS.find((s) => s.id === "dmv")!;
  const headers = buildSeed().sections.dmv.headers;

  const open = analyzeRow(
    def,
    headers,
    row(["Driver A", "CA", "Applied", isoOffset(10), "NONE", "", "Active", "", "CA", ""]),
  );
  expect(open.issues.find((i) => i.col === 2)?.label).toBe("DMV Pull Notice: Applied + 10 Days Remaining");
  expect(normStatus("Applied")).toBe("Applied");

  const past = analyzeRow(
    def,
    headers,
    row(["Driver B", "CA", "Applied", isoOffset(-3), "NONE", "", "Active", "", "CA", ""]),
  );
  const pastIssue = past.issues.find((i) => i.col === 2);
  expect(pastIssue?.label).toBe("DMV Pull Notice: Expired + Applied");
  expect(pastIssue?.tone).toBe("danger");
});

test("Queries Annual and Pre-Employment Applied keep expiry context independently", () => {
  const def = SECTIONS.find((s) => s.id === "queries")!;
  const headers = buildSeed().sections.queries.headers;
  const r = row([
    "Driver Q",
    "Applied",
    isoOffset(14),
    "Applied",
    isoOffset(-2),
    "",
    "",
    "",
    "Active",
    "",
  ]);
  const { issues } = analyzeRow(def, headers, r);
  expect(issues.find((i) => i.col === 1)?.label).toBe("Annual Query: Applied + 14 Days Remaining");
  expect(issues.find((i) => i.col === 3)?.label).toBe("Pre-Employment Query: Expired + Applied");
});

test("Applied filter match still finds warn/danger Applied issues by label", () => {
  const match = (label: string) => /applied/i.test(label);
  expect(match("DMV Pull Notice: Applied + 10 Days Remaining")).toBe(true);
  expect(match("DMV Pull Notice: Expired + Applied")).toBe(true);
  expect(match("Medical: Missing")).toBe(false);
});
