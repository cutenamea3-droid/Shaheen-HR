import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { usePersonal } from "@/personal/lib/store";

describe("Personal store write-path normalize guards", () => {
  it("source wires normalize* on note/backlog/session/grade/exam/weekly writes", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/lib/store.ts"), "utf8");
    expect(src).toMatch(/normalizeBacklogItem\(\{/);
    expect(src).toMatch(/normalizeNote\(n\)/);
    const notesUi = readFileSync(resolve(process.cwd(), "src/personal/components/Notes.tsx"), "utf8");
    expect(notesUi).toMatch(/normalizeNote\(n as Partial<Note>/);
    expect(notesUi).toMatch(/asTxt\(n\.title\)/);
    expect(notesUi).toMatch(/asTxt\(n\.body\)/);
    expect(src).toMatch(/normalizeFocusSession\(\{/);
    expect(src).toMatch(/normalizeGradeEntry\(g\)/);
    expect(src).toMatch(/normalizeCourseGrade\(g\)/);
    expect(src).toMatch(/normalizeExamPrepTask\(t\)/);
    expect(src).toMatch(/normalizeWeeklyReview\(r,/);
    expect(src).toMatch(/typeof vaultNotes === "string" \? vaultNotes : String\(vaultNotes\)/);
  });

  it("upsertNote / addBacklog / addSession coerce corrupt scalars", () => {
    expect(() =>
      usePersonal.getState().upsertNote({
        id: "n1",
        courseId: "general",
        title: 99 as unknown as string,
        body: null as unknown as string,
        updatedAt: Date.now(),
        tags: [1, "ok"] as unknown as string[],
      }),
    ).not.toThrow();
    const note = usePersonal.getState().notes.find((n) => n.id === "n1");
    expect(typeof note?.title).toBe("string");
    expect(Array.isArray(note?.tags)).toBe(true);

    expect(() =>
      usePersonal.getState().addBacklog({
        courseId: "general",
        label: 12 as unknown as string,
        estimatedMinutes: "x" as unknown as number,
      }),
    ).not.toThrow();
    const bl = usePersonal.getState().backlog.at(-1);
    expect(typeof bl?.label).toBe("string");
    expect(typeof bl?.estimatedMinutes).toBe("number");

    const now = Date.now();
    expect(() =>
      usePersonal.getState().addSession({
        courseId: null,
        minutes: "30" as unknown as number,
        startedAt: now,
        endedAt: now,
        mode: "normal",
        label: 5 as unknown as string,
      }),
    ).not.toThrow();
    const sess = usePersonal.getState().sessions[0];
    expect(typeof sess?.minutes).toBe("number");
    expect(typeof sess?.label).toBe("string");
  });
});
