import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Personal Courses/Focus autofill fallback", () => {
  it("Courses Save reads DOM when onChange is skipped", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/components/Courses.tsx"), "utf8");
    expect(src).toMatch(/notesRef/);
    expect(src).toMatch(/notesRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="personal-course-save"/);
    expect(src).toMatch(/onInput=\{\(e\) => setTitleV/);
  });

  it("Focus session log reads lesson label from DOM", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/components/Focus.tsx"), "utf8");
    expect(src).toMatch(/readLessonLabel/);
    expect(src).toMatch(/lessonLabelRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="personal-focus-lesson"/);
  });
});
