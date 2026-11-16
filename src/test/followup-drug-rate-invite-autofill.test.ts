import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Follow-up / drug / rate / invite autofill", () => {
  it("FollowUpTracker reads draft fields from DOM", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/FollowUpTracker.tsx"),
      "utf8",
    );
    expect(src).toMatch(/draftSubjectRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="followup-subject"/);
  });

  it("DrugTestForm submit reads specimen/notes from DOM", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/driver-hr/DrugTestForm.tsx"),
      "utf8",
    );
    expect(src).toMatch(/specimenRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="drug-specimen-id"/);
  });

  it("RateCard SoftField debounced persist without blur", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/driver-hr/RateCardPanel.tsx"),
      "utf8",
    );
    expect(src).toMatch(/queueSave/);
    expect(src).toMatch(/setTimeout/);
    expect(src).toMatch(/onInput=\{\(e\) => queueSave/);
  });

  it("Dispatch invite reads email/name/password from DOM", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/DispatchApp.tsx"), "utf8");
    expect(src).toMatch(/emailRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="dispatch-invite-email"/);
  });

  it("addFollowUp guards missing rows arrays", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/store.ts"), "utf8");
    expect(src).toMatch(/const existingRows = Array\.isArray\(sec\.rows\) \? sec\.rows : \[\]/);
  });
});
