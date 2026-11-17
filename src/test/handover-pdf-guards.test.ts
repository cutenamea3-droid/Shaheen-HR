import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  accessorialsToCsv,
  exportAccessorialsPdf,
  exportHandoverPdf,
  exportLoadHistoryPdf,
  exportLoadsPdf,
  loadsToCsv,
} from "@/dispatch/lib/reports";
import type { DispatchLoad, ShiftHandover } from "@/dispatch/lib/types";

describe("dispatch report list guards", () => {
  it("source uses Array.isArray for open_load_ids and loads", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/lib/reports.ts"), "utf8");
    expect(src).toMatch(/Array\.isArray\(handover\.open_load_ids\)/);
    expect(src).toMatch(/Array\.isArray\(loads\)/);
    expect(src).toMatch(/Array\.isArray\(items\)/);
    expect(src).toMatch(/Array\.isArray\(events\)/);
  });

  it("CSV helpers tolerate non-array inputs", () => {
    expect(loadsToCsv(null as never)).toContain("load_number");
    expect(accessorialsToCsv(undefined as never)).toContain("load_id");
  });

  it("PDF exporters tolerate corrupt list payloads", () => {
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
    const load = {
      id: "l1",
      load_number: "L-1",
      status: "assigned",
      payment_status: "unpaid",
      updated_at: new Date().toISOString(),
    } as DispatchLoad;
    expect(() => exportHandoverPdf(handover, null as never)).not.toThrow();
    expect(() => exportLoadsPdf(null as never)).not.toThrow();
    expect(() => exportAccessorialsPdf(null as never, null as never)).not.toThrow();
    expect(() => exportLoadHistoryPdf(load, null as never)).not.toThrow();
  });
});
