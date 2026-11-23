import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Salary / Vault / header / AddDriver autofill", () => {
  it("SalaryPayments due drafts use onInput + DOM read", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/SalaryPayments.tsx"),
      "utf8",
    );
    expect(src).toMatch(/data-testid=\{`admin-due-\$\{e\.id\}`\}/);
    expect(src).toMatch(/onInput=\{\(ev\) =>/);
    expect(src).toMatch(/admin-due-\$\{id\}/);
  });

  it("Vault schedule + notes use onInput", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/components/Vault.tsx"), "utf8");
    expect(src).toMatch(/data-testid="personal-vault-notes"/);
    expect(src).toMatch(/onInput=\{\(e\) => setVaultNotes/);
    expect(src).toMatch(/data-testid="personal-weekday-minutes"/);
  });

  it("DataTable header edit uses onInput + DOM save", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/DataTable.tsx"),
      "utf8",
    );
    expect(src).toMatch(/datatable-header-edit-\$\{i\}/);
    expect(src).toMatch(/onInput=\{\(e\) => setHeadDraft/);
  });

  it("AddDriverDialog section fields use onInput", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/AddDriverDialog.tsx"),
      "utf8",
    );
    expect(src).toMatch(/onInput=\{\(e\) => setV\(def, i, \(e\.target as HTMLTextAreaElement\)\.value\)\}/);
    expect(src).toMatch(/onInput=\{\(e\) => setV\(def, i, \(e\.target as HTMLInputElement\)\.value\)\}/);
  });
});
