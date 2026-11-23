import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { addRecord, getData } from "@/lib/store";

describe("store mutations + Admin search cellsOf/coerce", () => {
  it("addRecord stringifies non-string cell entries", () => {
    const id = "rec_drivers";
    expect(() =>
      addRecord(id, [42 as unknown as string, null as unknown as string, "doc"]),
    ).not.toThrow();
    const rows = getData().sections[id]?.rows ?? [];
    const last = rows[rows.length - 1];
    expect(last?.cells[0]).toBe("42");
    expect(last?.cells[1]).toBe("");
  });

  it("Admin EmployeeDirectory / Expenses / SystemLogs search coerce", () => {
    const dir = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/EmployeeDirectory.tsx"),
      "utf8",
    );
    expect(dir).toMatch(/asText\(q\)\.trim\(\)\.toLowerCase\(\)/);
    const exp = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/ExpensesManagement.tsx"),
      "utf8",
    );
    expect(exp).toMatch(/asText\(q\)\.trim\(\)\.toLowerCase\(\)/);
    const logs = readFileSync(resolve(process.cwd(), "src/admin/components/hr/SystemLogs.tsx"), "utf8");
    expect(logs).toMatch(/Array\.isArray\(logs\) \? logs : \[\]/);
    expect(logs).toMatch(/asText\(l\.who\)/);
    expect(logs).toMatch(/\{asText\(l\.action\)\}/);
    expect(logs).toMatch(/\{asText\(l\.who\)\}/);
  });

  it("Compliance ActivityLogs coerces action/actor/section before React children", () => {
    const src = readFileSync(resolve(process.cwd(), "src/components/tracker/ActivityLogs.tsx"), "utf8");
    expect(src).toMatch(/asText\(entry\.action\)/);
    expect(src).toMatch(/asText\(entry\.actor_name\)/);
    expect(src).toMatch(/asText\(entry\.section_id\)/);
  });
});
