import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { blocksOf } from "@/personal/lib/store";
import { normalizeWeeklyReview, normalizeWeeklyReviews } from "@/personal/lib/weekly-review";

describe("Personal day plan blocks + weekly review coerce", () => {
  it("blocksOf stringifies label/minutes and skips garbage rows", () => {
    const blocks = blocksOf({
      blocks: [
        { id: 1, courseId: 2, minutes: "15", label: 9, done: 1 },
        null,
        "bad",
        { id: "ok", courseId: "cs101", minutes: 20, label: "Lecture", done: false },
      ],
    });
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      id: "1",
      courseId: "2",
      minutes: 15,
      label: "9",
      done: true,
    });
    expect(blocks[1]?.label).toBe("Lecture");
  });

  it("normalizeWeeklyReview coerces journal fields", () => {
    const r = normalizeWeeklyReview(
      { weekStart: 20260105, wins: 1, blockers: 2, nextFocus: 3, updatedAt: "9" },
      "2026-01-05",
    );
    expect(r.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.wins).toBe("1");
    expect(r.blockers).toBe("2");
    expect(r.nextFocus).toBe("3");
    expect(r.updatedAt).toBe(9);
    const map = normalizeWeeklyReviews({ "2026-01-05": { wins: 7 } });
    expect(map["2026-01-05"]?.wins).toBe("7");
  });

  it("store merge wires normalizeWeeklyReviews and blocksOf coerce", () => {
    const store = readFileSync(resolve(process.cwd(), "src/personal/lib/store.ts"), "utf8");
    expect(store).toMatch(/normalizeWeeklyReviews\(/);
    expect(store).toMatch(/minutes: Number\.isFinite\(mins\) && mins >= 0 \? mins : 0/);
  });
});
