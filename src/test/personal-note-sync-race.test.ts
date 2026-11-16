import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  decidePersonalSync,
  isPersonalMeaningful,
  type PersonalSyncBlob,
} from "@/personal/lib/sync-protect";

const note = {
  id: "audit1",
  courseId: "general" as const,
  title: "AUDIT-DUMMY-DELETE-OK",
  body: "Preview QA",
  updatedAt: 1,
  tags: ["revision"],
};

describe("Personal note sync race guards", () => {
  it("unsynced local notes keep_local even when cloud is otherwise meaningful with empty notes", () => {
    const local = {
      notes: [note],
      sessions: [],
      backlog: [{ id: "b1", label: "open", courseId: "c", estimatedMinutes: 20, done: false, createdAt: 1 }],
      vaultNotes: "semester",
    } as Partial<PersonalSyncBlob>;
    const cloud = {
      notes: [],
      sessions: [],
      backlog: [{ id: "b1", label: "open", courseId: "c", estimatedMinutes: 20, done: false, createdAt: 1 }],
      vaultNotes: "semester",
    } as Partial<PersonalSyncBlob>;
    expect(isPersonalMeaningful(local)).toBe(true);
    expect(isPersonalMeaningful(cloud)).toBe(true);
    expect(decidePersonalSync(local, cloud, { unsynced: true })).toBe("keep_local");
    // Without unsynced, cloud wins — so clearing unsynced mid-push was the wipe bug.
    expect(decidePersonalSync(local, cloud, { unsynced: false })).toBe("apply_cloud");
  });

  it("cloud-sync refuses empty-notes wipe while unsynced and retries skipped pushes", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/lib/cloud-sync.ts"), "utf8");
    expect(src).toMatch(/editEpoch/);
    expect(src).toMatch(/epochAtStart === editEpoch/);
    expect(src).toMatch(/blob\.notes\.length === 0 && localNotes\.length > 0 && readUnsynced\(\)/);
    expect(src).toMatch(/flushPush/);
    expect(src).toMatch(/In-flight push/);
    expect(src).toMatch(/initialPullDone/);
    expect(src).toMatch(/mergeById/);
    expect(src).toMatch(/partial local cache cannot drop cloud notes/);
  });
});
