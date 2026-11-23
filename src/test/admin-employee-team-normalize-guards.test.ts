import { describe, expect, it } from "vitest";
import { normalizeEmployee, normalizeTeamMember, useApp } from "@/admin/lib/store";

describe("Admin employee / team normalize guards", () => {
  it("normalizeEmployee coerces name/joinMonth/openingLeave", () => {
    const e = normalizeEmployee({
      id: "e1",
      name: 42 as unknown as string,
      deptId: null as unknown as string,
      afterHours: 1 as unknown as boolean,
      joinMonth: 202611 as unknown as string,
      openingLeave: "3" as unknown as number,
    });
    expect(e.name).toBe("42");
    expect(e.deptId).toBe("");
    expect(e.afterHours).toBe(true);
    expect(e.joinMonth).toMatch(/^\d{4}-\d{2}$/);
    expect(e.openingLeave).toBe(3);
  });

  it("normalizeTeamMember coerces email before compare keying", () => {
    const m = normalizeTeamMember({
      id: "t1",
      name: 7 as unknown as string,
      email: "  Admin@Example.COM " as unknown as string,
      role: "nope" as unknown as "standard",
      active: undefined as unknown as boolean,
    });
    expect(m.name).toBe("7");
    expect(m.email).toBe("admin@example.com");
    expect(m.role).toBe("standard");
    expect(m.active).toBe(true);
  });

  it("addEmployee / upsertMember write through normalize helpers", () => {
    expect(() =>
      useApp.getState().addEmployee({
        name: 99 as unknown as string,
        deptId: "d1",
        afterHours: false,
        joinMonth: "2026-11",
        openingLeave: 0,
      }),
    ).not.toThrow();
    const added = useApp.getState().employees.at(-1);
    expect(typeof added?.name).toBe("string");

    expect(() =>
      useApp.getState().upsertMember({
        id: "tm-x",
        name: 1 as unknown as string,
        email: "X@Y.COM",
        role: "standard",
        active: true,
      }),
    ).not.toThrow();
    const tm = useApp.getState().team.find((x) => x.id === "tm-x");
    expect(tm?.email).toBe("x@y.com");
  });
});
