import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { usePersonal } from "@/personal/lib/store";

describe("Personal Notes save", () => {
  it("upsertNote appends into Library store slice", () => {
    usePersonal.setState({ notes: [] });
    usePersonal.getState().upsertNote({
      id: "audit-dummy",
      courseId: "general",
      title: "AUDIT-DUMMY-DELETE-OK",
      body: "Preview QA",
      updatedAt: 1,
      tags: ["revision"],
    });
    expect(usePersonal.getState().notes).toHaveLength(1);
    expect(usePersonal.getState().notes[0]?.title).toBe("AUDIT-DUMMY-DELETE-OK");
  });

  it("Notes form reads DOM fallback when automation skips React onChange", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/components/Notes.tsx"), "utf8");
    expect(src).toMatch(/titleRef/);
    expect(src).toMatch(/bodyRef/);
    expect(src).toMatch(/readTitle/);
    expect(src).toMatch(/onInput/);
    expect(src).toMatch(/titleRef\.current\?\.value/);
  });

  it("upsertNote and Notes UI coerce corrupt tags arrays", () => {
    usePersonal.setState({ notes: [] });
    usePersonal.getState().upsertNote({
      id: "tags-corrupt",
      courseId: "general",
      title: "t",
      body: "b",
      updatedAt: 1,
      tags: null as never,
    });
    expect(usePersonal.getState().notes[0]?.tags).toEqual([]);
    const src = readFileSync(resolve(process.cwd(), "src/personal/components/Notes.tsx"), "utf8");
    expect(src).toMatch(/const tags = Array\.isArray\(n\.tags\) \? n\.tags : \[\]/);
  });
});
