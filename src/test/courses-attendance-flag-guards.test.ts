import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { usePersonal } from "@/personal/lib/store";

describe("Courses save / updateCourse / Attendance flag coerce", () => {
  it("Courses.tsx coerces code/title fallbacks before .trim", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/components/Courses.tsx"), "utf8");
    expect(src).toMatch(/normalizeCourse\(/);
    expect(src).toMatch(/asTxt\(codeV\)\.trim\(\)/);
    expect(src).toMatch(/asTxt\(titleV\)\.trim\(\)/);
    expect(src).not.toMatch(/const nextCode = \(codeV\.trim\(\)/);
  });

  it("updateCourse re-normalizes via normalizeCourse", () => {
    usePersonal.setState({
      courses: [
        {
          id: "c1",
          code: "CS101",
          title: "Intro",
          lecturesTotal: null,
          lecturesDone: null,
          notes: "",
          isTbd: true,
        },
      ],
    });
    expect(() =>
      usePersonal.getState().updateCourse("c1", {
        code: 101 as unknown as string,
        title: 55 as unknown as string,
      }),
    ).not.toThrow();
    const c = usePersonal.getState().courses.find((x) => x.id === "c1");
    expect(typeof c?.code).toBe("string");
    expect(typeof c?.title).toBe("string");
  });

  it("Attendance flag startsWith coerces non-string flags", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/components/hr/Attendance.tsx"), "utf8");
    expect(src).toMatch(/\.startsWith\("Miss"\)/);
    expect(src).toMatch(/typeof f === "string" \? f : String\(f\)/);
  });
});
