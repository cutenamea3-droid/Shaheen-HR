import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { filterFollowUps, followUpDueLabel } from "@/lib/follow-ups";
import { filterNotesByTag } from "@/personal/lib/revision";

describe("dossier / history / follow-up / revision trim coerces", () => {
  it("dossier + compliance-history use cellsOf for name/cell reads", () => {
    const dossier = readFileSync(resolve(process.cwd(), "src/lib/driver-dossier.ts"), "utf8");
    expect(dossier).toMatch(/return \(cellsOf\(row\)\[i\] \?\? ""\)\.trim\(\)/);
    expect(dossier).toMatch(/headersOf\(data\.sections\.docs\)/);
    const hist = readFileSync(resolve(process.cwd(), "src/lib/compliance-history.ts"), "utf8");
    expect(hist).toMatch(/const n = \(cellsOf\(r\)\[0\] \?\? ""\)\.trim\(\)/);
  });

  it("filterFollowUps / followUpDueLabel / filterNotesByTag coerce scalars", () => {
    expect(() =>
      filterFollowUps(
        [
          {
            id: "1",
            driverId: "d1",
            driver: "Alex",
            subject: "Call",
            status: "open",
            dueDate: "2026-11-17",
            notes: "",
            source: "manual",
            sectionId: "",
            docType: "",
            linkedRowId: "",
          },
        ],
        "all",
        1 as unknown as string,
      ),
    ).not.toThrow();
    expect(
      followUpDueLabel({
        id: "1",
        driverId: "d1",
        driver: "Alex",
        subject: "Call",
        status: "open",
        dueDate: null as unknown as string,
        notes: "",
        source: "manual",
        sectionId: "",
        docType: "",
        linkedRowId: "",
      }),
    ).toBe("No due date");
    expect(() =>
      filterNotesByTag(
        [{ id: "n1", title: "t", body: "", tags: [1 as unknown as string], createdAt: 1 } as never],
        1 as unknown as "all",
      ),
    ).not.toThrow();
  });
});
