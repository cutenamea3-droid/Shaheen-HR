import { beforeEach, describe, expect, it } from "vitest";
import {
  assertPrepDoesNotSubmit,
  deadlineBadge,
  normalizeAssessment,
  withPrepDone,
  withSubmitted,
} from "@/personal/lib/assessment-phases";
import { defaultAssessments, defaultSettings } from "@/personal/lib/defaults";
import { usePersonal } from "@/personal/lib/store";
import { buildVuSeed } from "@/personal/lib/vu-import";
import { VU_STUDY_PLAN, buildTodayPrescription } from "@/personal/lib/vu-plan";

describe("Batch 10 — VU Deadlines verified vs estimated", () => {
  it("labels To-Do Calendar dues as verified and never invents mid/final anchors", () => {
    const seed = buildVuSeed(VU_STUDY_PLAN);
    expect(seed.assessments.length).toBeGreaterThan(0);
    expect(seed.assessments.every((a) => a.deadlineSource === "vulms_todo")).toBe(true);
    expect(seed.assessments.every((a) => Boolean(a.dueDate))).toBe(true);
    expect(seed.assessments.some((a) => a.kind === "midterm" || a.kind === "final")).toBe(false);
    expect(seed.settingsPatch.midtermRef).toBe("");
    expect(seed.settingsPatch.finalsRef).toBe("");
    expect(defaultAssessments()).toEqual([]);
    expect(defaultSettings().midtermRef).toBe("");
    expect(defaultSettings().finalsRef).toBe("");
    expect(deadlineBadge("vulms_todo").tone).toBe("verified");
    expect(deadlineBadge("estimate").tone).toBe("estimated");
  });

  it("keeps invented exam calendar dates out of the fixture", () => {
    const blob = JSON.stringify(VU_STUDY_PLAN);
    expect(blob.includes("2026-12-07")).toBe(false);
    expect(blob.includes("2027-01-25")).toBe(false);
  });
});

describe("Batch 10 — Assignment/Quiz/GDB prep ≠ submit", () => {
  beforeEach(() => {
    usePersonal.setState({
      assessments: [],
      authed: false,
    });
  });

  it("supports GDB as a first-class kind and separates prep from submit", () => {
    usePersonal.getState().upsertAssessment({
      id: "gdb-demo",
      courseId: "cs101",
      kind: "gdb",
      title: "CS101 GDB (manual)",
      dueDate: "2026-11-20",
      notes: "User-entered",
      prepDone: false,
      submitted: false,
      done: false,
      verifyOnVulms: true,
      deadlineSource: "user_entered",
    });

    usePersonal.getState().setAssessmentPrep("gdb-demo", true);
    let a = usePersonal.getState().assessments.find((x) => x.id === "gdb-demo")!;
    expect(a.kind).toBe("gdb");
    expect(a.prepDone).toBe(true);
    expect(a.submitted).toBe(false);
    expect(a.done).toBe(false);

    const afterPrep = withPrepDone(normalizeAssessment(a), true);
    expect(assertPrepDoesNotSubmit(normalizeAssessment({ ...a, prepDone: false }), afterPrep)).toBe(
      true,
    );

    usePersonal.getState().setAssessmentSubmitted("gdb-demo", true);
    a = usePersonal.getState().assessments.find((x) => x.id === "gdb-demo")!;
    expect(a.submitted).toBe(true);
    expect(a.done).toBe(true);
    expect(a.prepDone).toBe(true);

    const cleared = withSubmitted(a, false);
    expect(cleared.submitted).toBe(false);
    expect(cleared.done).toBe(false);
  });

  it("Today plan labels distinguish prep-only from submit/verify blocks", () => {
    const rx = buildTodayPrescription(VU_STUDY_PLAN, "2026-11-10");
    expect(rx.blocks.some((b) => b.kind === "prep" && /Prep only \(≠ submit\)/i.test(b.label))).toBe(
      true,
    );
    // Graded recovery copy is either Verify (ended window) or Submit (open) — never conflated with prep
    expect(
      rx.blocks.some(
        (b) =>
          b.kind === "recovery" &&
          (/Submit on VULMS/i.test(b.label) || /Verify on VULMS/i.test(b.label)),
      ),
    ).toBe(true);
    expect(rx.blocks.filter((b) => b.kind === "prep").every((b) => !/Submit on VULMS/i.test(b.label))).toBe(
      true,
    );
  });
});
