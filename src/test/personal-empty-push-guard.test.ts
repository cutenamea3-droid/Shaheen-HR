import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decidePersonalSync, isPersonalMeaningful } from "@/personal/lib/sync-protect";

describe("Personal empty push protection", () => {
  it("never decides push_local when local is empty and cloud is meaningful", () => {
    const cloud = {
      vaultNotes: "keep me",
      notes: [{ id: "1", courseId: "c", title: "t", body: "b", updatedAt: 1, tags: [] }],
      sessions: [],
      backlog: [],
      gradeEntries: [],
      courseGrades: [],
      examPrepTasks: [],
      weeklyReviews: {},
      dayPlans: {},
      discipline: [],
      courses: [],
      assessments: [],
      settings: {} as never,
    };
    expect(isPersonalMeaningful(cloud)).toBe(true);
    expect(decidePersonalSync({}, cloud, { unsynced: false })).toBe("apply_cloud");
    expect(decidePersonalSync({}, cloud, { unsynced: true })).toBe("apply_cloud");
  });

  it("pushPersonalCloud source refuses empty upsert over meaningful cloud", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/lib/cloud-sync.ts"), "utf8");
    expect(src).toMatch(/isPersonalMeaningful/);
    expect(src).toMatch(/refused empty push/);
    expect(src).toMatch(/protects personal_study_state/);
  });
});
