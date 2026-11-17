import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { exportHandoverPdf } from "@/dispatch/lib/reports";
import type { ShiftHandover } from "@/dispatch/lib/types";

describe("handover PDF open_load_ids guards", () => {
  it("source uses Array.isArray for open_load_ids and loads", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/lib/reports.ts"), "utf8");
    expect(src).toMatch(/Array\.isArray\(handover\.open_load_ids\)/);
    expect(src).toMatch(/Array\.isArray\(loads\)/);
  });

  it("exportHandoverPdf tolerates corrupt open_load_ids", () => {
    const handover = {
      id: "h1",
      shift_date: "2026-11-17",
      from_dispatcher: "A",
      to_dispatcher: "B",
      summary: "ok",
      open_load_ids: null as never,
      watch_items: "",
      next_day_priorities: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as ShiftHandover;
    expect(() => exportHandoverPdf(handover, null as never)).not.toThrow();
  });
});
