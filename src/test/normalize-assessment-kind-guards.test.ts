import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeAssessment, normalizeCourse } from "@/personal/lib/assessment-phases";

describe("normalizeAssessment coerce guards", () => {
  it("stringifies corrupt kind/title and never leaves non-string kind", () => {
    const a = normalizeAssessment({
      id: 42 as unknown as string,
      title: 99 as unknown as string,
      kind: 7 as unknown as "quiz",
      dueDate: 20260101 as unknown as string,
    });
    expect(a.id).toBe("42");
    expect(a.title).toBe("99");
    expect(a.kind).toBe("other");
    expect(a.dueDate).toBe("20260101");
    expect(typeof a.kind).toBe("string");
    expect(a.kind.toUpperCase()).toBe("OTHER");
  });

  it("preserves midterm/final kinds and normalizes course id/code", () => {
    expect(normalizeAssessment({ id: "1", title: "M", kind: "midterm" }).kind).toBe("midterm");
    expect(normalizeAssessment({ id: "1", title: "F", kind: "final" }).kind).toBe("final");
    const c = normalizeCourse({
      id: 9 as unknown as string,
      code: 101 as unknown as string,
      title: null as unknown as string,
    });
    expect(c.id).toBe("9");
    expect(c.code).toBe("101");
    expect(c.title).toBe("");
  });

  it("source keeps kind coerce + revision/attendance/overview/quickfind guards", () => {
    const phases = readFileSync(
      resolve(process.cwd(), "src/personal/lib/assessment-phases.ts"),
      "utf8",
    );
    const rev = readFileSync(resolve(process.cwd(), "src/personal/lib/revision.ts"), "utf8");
    const att = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/Attendance.tsx"),
      "utf8",
    );
    const overview = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/Overview.tsx"),
      "utf8",
    );
    const store = readFileSync(resolve(process.cwd(), "src/personal/lib/store.ts"), "utf8");
    const courses = readFileSync(
      resolve(process.cwd(), "src/personal/components/Courses.tsx"),
      "utf8",
    );
    expect(phases).toMatch(/KIND_SET\.has\(kindRaw\)/);
    expect(phases).toMatch(/"midterm"/);
    expect(phases).toMatch(/export function normalizeCourse/);
    expect(phases).toMatch(/title: asText\(raw\.title\)/);
    expect(rev).toMatch(/typeof a\.kind === "string" \? a\.kind : String\(a\.kind\)/);
    expect(att).toMatch(/typeof date === "string" \? date : String\(date\)\)\.slice\(0,\s*7\)/);
    expect(overview).toMatch(/typeof date === "string" \? date : String\(date\)\)\.slice\(0,\s*7\)/);
    expect(store).toMatch(/normalizeCourse\(c as Partial<Course>/);
    expect(courses).toMatch(/typeof id === "string" \? id : String\(id\)\)\.toUpperCase\(\)/);
  });
});
