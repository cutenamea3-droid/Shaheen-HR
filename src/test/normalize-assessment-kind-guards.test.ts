import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeAssessment } from "@/personal/lib/assessment-phases";

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
    expect(phases).toMatch(/KIND_SET\.has\(kindRaw\)/);
    expect(phases).toMatch(/title: asText\(raw\.title\)/);
    expect(rev).toMatch(/typeof a\.kind === "string" \? a\.kind : String\(a\.kind\)/);
    expect(att).toMatch(/typeof date === "string" \? date : String\(date\)\)\.slice\(0,\s*7\)/);
    expect(overview).toMatch(/typeof date === "string" \? date : String\(date\)\)\.slice\(0,\s*7\)/);
  });
});
