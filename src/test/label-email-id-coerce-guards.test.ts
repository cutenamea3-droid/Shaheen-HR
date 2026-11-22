import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { rowToFollowUp } from "@/lib/follow-ups";
import { useExpensesStore } from "@/admin/lib/expenses-store";

describe("label / email / id coerce guards", () => {
  it("AccountSettings coerces account.email before toLowerCase", () => {
    const src = readFileSync(resolve(process.cwd(), "src/components/tracker/AccountSettings.tsx"), "utf8");
    expect(src).toMatch(/emailKey\.trim\(\)\.toLowerCase\(\) === PORTAL_EMAIL/);
    expect(src).not.toMatch(/account\.email\.toLowerCase\(\)/);
  });

  it("alerts-work-center uses issueLabel before toLowerCase / regex", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/alerts-work-center.ts"), "utf8");
    expect(src).toMatch(/function issueLabel\(/);
    expect(src).toMatch(/issueLabel\(issue\)\.toLowerCase\(\)/);
    expect(src).not.toMatch(/issue\.label\.toLowerCase\(\)/);
  });

  it("DrugTestForm coerces candidate label before includes", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/driver-hr/DrugTestForm.tsx"),
      "utf8",
    );
    expect(src).toMatch(/asLab\(c\.label\)\.toLowerCase\(\)\.includes\(q\)/);
    expect(src).not.toMatch(/c\.label\.toLowerCase\(\)/);
  });

  it("rowToFollowUp coerces non-string row.id before startsWith", () => {
    expect(() =>
      rowToFollowUp({
        id: 99 as unknown as string,
        driverId: "d1",
        cells: ["A", "subj", "open", "", "", "manual", "", ""],
      }),
    ).not.toThrow();
    const fu = rowToFollowUp({
      id: "fu_x",
      driverId: "d1",
      cells: ["A", "subj", "open", "", "", "manual", "", ""],
    });
    expect(fu.linkedRowId).toBe("");
  });

  it("expenses addCategory coerces corrupt category names before toLowerCase", () => {
    useExpensesStore.setState({
      categories: [{ id: "c1", name: 12 as unknown as string, custom: true }],
    });
    expect(() => useExpensesStore.getState().addCategory("Fuel")).not.toThrow();
  });
});
