import { dispatchSupabase } from "@/dispatch/integrations/supabase/client";
import { isDispatchPreviewMode } from "./auth";
import { cloneFixtures } from "./fixtures";
import type {
  CheckCall,
  DispatchException,
  DispatchFollowUp,
  DispatchIssue,
  DispatchLoad,
  LoadStop,
  RosterDriver,
  ShiftHandover,
} from "./types";
import { canCancelLoad, validateCancel, validateReschedule } from "./ops-controls";

type Memory = ReturnType<typeof cloneFixtures>;
let memory: Memory | null = null;

function mem(): Memory {
  if (!memory) memory = cloneFixtures();
  return memory;
}

/** Test-only: clear fixture memory so acceptance scenarios use isolated data. */
export function resetDispatchFixtureMemory(): void {
  memory = null;
}

function newId(): string {
  return crypto.randomUUID();
}

export async function listRosterDrivers(): Promise<RosterDriver[]> {
  if (isDispatchPreviewMode()) return mem().drivers.filter((d) => d.active);
  const { data, error } = await dispatchSupabase
    .from("dispatch_roster_drivers")
    .select("*")
    .eq("active", true)
    .order("display_name");
  if (error) throw error;
  return (data ?? []) as RosterDriver[];
}

export async function upsertRosterDriver(
  input: Partial<RosterDriver> & { display_name: string },
): Promise<RosterDriver> {
  if (isDispatchPreviewMode()) {
    const existing = mem().drivers.find((d) => d.id === input.id);
    if (existing) {
      Object.assign(existing, input, { updated_at: new Date().toISOString() });
      return existing;
    }
    const row: RosterDriver = {
      id: newId(),
      display_name: input.display_name,
      unit_number: input.unit_number ?? null,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
      active: input.active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mem().drivers.push(row);
    return row;
  }
  const payload = {
    id: input.id,
    display_name: input.display_name,
    unit_number: input.unit_number ?? null,
    phone: input.phone ?? null,
    notes: input.notes ?? null,
    active: input.active ?? true,
  };
  const { data, error } = await dispatchSupabase
    .from("dispatch_roster_drivers")
    .upsert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as RosterDriver;
}

export async function listLoads(): Promise<DispatchLoad[]> {
  if (isDispatchPreviewMode()) {
    return [...mem().loads].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  const { data, error } = await dispatchSupabase
    .from("dispatch_loads")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const loads = (data ?? []) as DispatchLoad[];
  const ids = loads.map((l) => l.id);
  if (!ids.length) return loads;
  const { data: stops, error: stopError } = await dispatchSupabase
    .from("dispatch_load_stops")
    .select("*")
    .in("load_id", ids)
    .order("sequence");
  if (stopError) throw stopError;
  const byLoad = new Map<string, LoadStop[]>();
  for (const stop of (stops ?? []) as LoadStop[]) {
    const list = byLoad.get(stop.load_id!) ?? [];
    list.push(stop);
    byLoad.set(stop.load_id!, list);
  }
  return loads.map((l) => ({ ...l, stops: byLoad.get(l.id) ?? [] }));
}

export async function getLoad(id: string): Promise<DispatchLoad | null> {
  const all = await listLoads();
  return all.find((l) => l.id === id) ?? null;
}

export type LoadWriteInput = {
  id?: string;
  load_number: string;
  customer_name?: string | null;
  commodity?: string | null;
  equipment?: string | null;
  notes?: string | null;
  status?: DispatchLoad["status"];
  exception_open?: boolean;
  bol_status?: DispatchLoad["bol_status"];
  pod_status?: DispatchLoad["pod_status"];
  assigned_driver_id?: string | null;
  assigned_driver_name?: string | null;
  external_ref_label?: string | null;
  external_ref_url?: string | null;
  planned_pickup_at?: string | null;
  actual_pickup_at?: string | null;
  planned_delivery_at?: string | null;
  actual_delivery_at?: string | null;
  last_manual_location?: string | null;
  last_manual_location_at?: string | null;
  cancel_reason?: string | null;
  reschedule_note?: string | null;
  stale_after_minutes?: number;
  stops?: LoadStop[];
};

export async function saveLoad(input: LoadWriteInput): Promise<DispatchLoad> {
  const now = new Date().toISOString();
  if (input.status === "cancelled") {
    const err = validateCancel(input.cancel_reason ?? "");
    if (err) throw new Error(err);
  }
  if (isDispatchPreviewMode()) {
    const idx = mem().loads.findIndex((l) => l.id === input.id);
    const base: DispatchLoad =
      idx >= 0
        ? mem().loads[idx]
        : {
            id: newId(),
            load_number: input.load_number,
            customer_name: null,
            commodity: null,
            equipment: null,
            notes: null,
            status: "planned",
            exception_open: false,
            bol_status: "missing",
            pod_status: "missing",
            assigned_driver_id: null,
            assigned_driver_name: null,
            external_ref_label: null,
            external_ref_url: null,
            planned_pickup_at: null,
            actual_pickup_at: null,
            planned_delivery_at: null,
            actual_delivery_at: null,
            last_manual_location: null,
            last_manual_location_at: null,
            last_manual_location_by: null,
            cancel_reason: null,
            reschedule_note: null,
            stale_after_minutes: 180,
            created_by: null,
            updated_by: null,
            created_at: now,
            updated_at: now,
            stops: [],
          };
    const next: DispatchLoad = {
      ...base,
      ...input,
      load_number: input.load_number,
      cancel_reason:
        input.status === "cancelled"
          ? (input.cancel_reason ?? base.cancel_reason)
          : (input.cancel_reason ?? base.cancel_reason),
      reschedule_note: input.reschedule_note ?? base.reschedule_note,
      updated_at: now,
      stops: input.stops ?? base.stops ?? [],
    };
    if (idx >= 0) mem().loads[idx] = next;
    else mem().loads.unshift(next);
    return next;
  }

  const row = {
    id: input.id,
    load_number: input.load_number.trim(),
    customer_name: input.customer_name ?? null,
    commodity: input.commodity ?? null,
    equipment: input.equipment ?? null,
    notes: input.notes ?? null,
    status: input.status ?? "planned",
    exception_open: input.exception_open ?? false,
    bol_status: input.bol_status ?? "missing",
    pod_status: input.pod_status ?? "missing",
    assigned_driver_id: input.assigned_driver_id ?? null,
    assigned_driver_name: input.assigned_driver_name ?? null,
    external_ref_label: input.external_ref_label ?? null,
    external_ref_url: input.external_ref_url ?? null,
    planned_pickup_at: input.planned_pickup_at ?? null,
    actual_pickup_at: input.actual_pickup_at ?? null,
    planned_delivery_at: input.planned_delivery_at ?? null,
    actual_delivery_at: input.actual_delivery_at ?? null,
    last_manual_location: input.last_manual_location ?? null,
    last_manual_location_at: input.last_manual_location_at ?? null,
    cancel_reason: input.cancel_reason ?? null,
    reschedule_note: input.reschedule_note ?? null,
    stale_after_minutes: input.stale_after_minutes ?? 180,
    updated_at: now,
  };

  const { data, error } = await dispatchSupabase.from("dispatch_loads").upsert(row).select("*").single();
  if (error) throw error;
  const load = data as DispatchLoad;

  if (input.stops) {
    await dispatchSupabase.from("dispatch_load_stops").delete().eq("load_id", load.id);
    if (input.stops.length) {
      const stopRows = input.stops.map((s, i) => ({
        load_id: load.id,
        sequence: s.sequence || i + 1,
        stop_type: s.stop_type,
        name: s.name || null,
        address: s.address || null,
        city: s.city || null,
        state: s.state || null,
        postal_code: s.postal_code || null,
        planned_at: s.planned_at,
        actual_at: s.actual_at,
        notes: s.notes || null,
      }));
      const { error: stopError } = await dispatchSupabase.from("dispatch_load_stops").insert(stopRows);
      if (stopError) throw stopError;
    }
  }

  return (await getLoad(load.id)) ?? { ...load, stops: input.stops ?? [] };
}

export async function addCheckCall(input: {
  load_id: string;
  notes: string;
  manual_location?: string | null;
  called_at?: string;
}): Promise<CheckCall> {
  const called_at = input.called_at ?? new Date().toISOString();
  if (isDispatchPreviewMode()) {
    const row: CheckCall = {
      id: newId(),
      load_id: input.load_id,
      called_at,
      manual_location: input.manual_location ?? null,
      notes: input.notes,
      created_by: null,
      created_at: called_at,
    };
    mem().checkCalls.unshift(row);
    const load = mem().loads.find((l) => l.id === input.load_id);
    if (load && input.manual_location) {
      load.last_manual_location = input.manual_location;
      load.last_manual_location_at = called_at;
      load.updated_at = called_at;
    }
    return row;
  }

  const { data, error } = await dispatchSupabase
    .from("dispatch_check_calls")
    .insert({
      load_id: input.load_id,
      notes: input.notes,
      manual_location: input.manual_location ?? null,
      called_at,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (input.manual_location) {
    await dispatchSupabase
      .from("dispatch_loads")
      .update({
        last_manual_location: input.manual_location,
        last_manual_location_at: called_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.load_id);
  }
  return data as CheckCall;
}

export async function listCheckCalls(loadId: string): Promise<CheckCall[]> {
  if (isDispatchPreviewMode()) {
    return mem().checkCalls.filter((c) => c.load_id === loadId);
  }
  const { data, error } = await dispatchSupabase
    .from("dispatch_check_calls")
    .select("*")
    .eq("load_id", loadId)
    .order("called_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CheckCall[];
}

export async function listExceptions(): Promise<DispatchException[]> {
  if (isDispatchPreviewMode()) return mem().exceptions;
  const { data, error } = await dispatchSupabase
    .from("dispatch_exceptions")
    .select("*")
    .order("opened_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DispatchException[];
}

export async function saveException(
  input: Partial<DispatchException> & { load_id: string; kind: string },
): Promise<DispatchException> {
  if (isDispatchPreviewMode()) {
    const existing = mem().exceptions.find((e) => e.id === input.id);
    if (existing) {
      Object.assign(existing, input);
      return existing;
    }
    const row: DispatchException = {
      id: newId(),
      load_id: input.load_id,
      kind: input.kind,
      severity: input.severity ?? "medium",
      status: input.status ?? "open",
      notes: input.notes ?? null,
      opened_at: new Date().toISOString(),
      resolved_at: input.resolved_at ?? null,
    };
    mem().exceptions.unshift(row);
    const load = mem().loads.find((l) => l.id === input.load_id);
    if (load) load.exception_open = row.status !== "resolved";
    return row;
  }
  const { data, error } = await dispatchSupabase
    .from("dispatch_exceptions")
    .upsert({
      id: input.id,
      load_id: input.load_id,
      kind: input.kind,
      severity: input.severity ?? "medium",
      status: input.status ?? "open",
      notes: input.notes ?? null,
      resolved_at: input.status === "resolved" ? new Date().toISOString() : input.resolved_at ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  await dispatchSupabase
    .from("dispatch_loads")
    .update({ exception_open: (data as DispatchException).status !== "resolved" })
    .eq("id", input.load_id);
  return data as DispatchException;
}

export async function listIssues(): Promise<DispatchIssue[]> {
  if (isDispatchPreviewMode()) return mem().issues;
  const { data, error } = await dispatchSupabase
    .from("dispatch_issues")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DispatchIssue[];
}

export async function saveIssue(
  input: Partial<DispatchIssue> & { title: string },
): Promise<DispatchIssue> {
  const now = new Date().toISOString();
  if (isDispatchPreviewMode()) {
    const existing = mem().issues.find((i) => i.id === input.id);
    if (existing) {
      const senior_informed = input.senior_informed ?? existing.senior_informed;
      Object.assign(existing, input, {
        senior_informed,
        senior_informed_at: senior_informed
          ? (input.senior_informed_at ?? existing.senior_informed_at ?? now)
          : null,
        senior_informed_note: senior_informed
          ? (input.senior_informed_note ?? existing.senior_informed_note)
          : null,
        updated_at: now,
      });
      return existing;
    }
    const senior_informed = input.senior_informed ?? false;
    const row: DispatchIssue = {
      id: newId(),
      load_id: input.load_id ?? null,
      title: input.title,
      detail: input.detail ?? null,
      escalation_level: input.escalation_level ?? "ops",
      status: input.status ?? "open",
      senior_informed,
      senior_informed_at: senior_informed ? (input.senior_informed_at ?? now) : null,
      senior_informed_note: senior_informed ? (input.senior_informed_note ?? null) : null,
      created_at: now,
      updated_at: now,
    };
    mem().issues.unshift(row);
    return row;
  }
  const senior_informed = input.senior_informed ?? false;
  const { data, error } = await dispatchSupabase
    .from("dispatch_issues")
    .upsert({
      id: input.id,
      load_id: input.load_id ?? null,
      title: input.title,
      detail: input.detail ?? null,
      escalation_level: input.escalation_level ?? "ops",
      status: input.status ?? "open",
      senior_informed,
      senior_informed_at: senior_informed ? (input.senior_informed_at ?? now) : null,
      senior_informed_note: senior_informed ? (input.senior_informed_note ?? null) : null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as DispatchIssue;
}

export async function listFollowUps(): Promise<DispatchFollowUp[]> {
  if (isDispatchPreviewMode()) {
    return [...mem().followUps].sort((a, b) => a.due_at.localeCompare(b.due_at));
  }
  const { data, error } = await dispatchSupabase
    .from("dispatch_follow_ups")
    .select("*")
    .order("due_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DispatchFollowUp[];
}

export async function saveFollowUp(
  input: Partial<DispatchFollowUp> & { title: string; due_at: string },
): Promise<DispatchFollowUp> {
  const now = new Date().toISOString();
  if (isDispatchPreviewMode()) {
    const existing = mem().followUps.find((f) => f.id === input.id);
    if (existing) {
      Object.assign(existing, input, { updated_at: now });
      return existing;
    }
    const row: DispatchFollowUp = {
      id: newId(),
      load_id: input.load_id ?? null,
      title: input.title,
      notes: input.notes ?? null,
      due_at: input.due_at,
      status: input.status ?? "open",
      created_by: input.created_by ?? null,
      created_at: now,
      updated_at: now,
    };
    mem().followUps.unshift(row);
    return row;
  }
  const { data, error } = await dispatchSupabase
    .from("dispatch_follow_ups")
    .upsert({
      id: input.id,
      load_id: input.load_id ?? null,
      title: input.title,
      notes: input.notes ?? null,
      due_at: input.due_at,
      status: input.status ?? "open",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as DispatchFollowUp;
}

/** Cancel a load with a required manual reason. */
export async function cancelLoad(
  load: DispatchLoad,
  reason: string,
): Promise<DispatchLoad> {
  if (!canCancelLoad(load.status)) {
    throw new Error(`Cannot cancel a ${load.status} load.`);
  }
  const err = validateCancel(reason);
  if (err) throw new Error(err);
  return saveLoad({
    id: load.id,
    load_number: load.load_number,
    status: "cancelled",
    cancel_reason: reason.trim(),
    customer_name: load.customer_name,
    commodity: load.commodity,
    equipment: load.equipment,
    notes: load.notes,
    exception_open: load.exception_open,
    bol_status: load.bol_status,
    pod_status: load.pod_status,
    assigned_driver_id: load.assigned_driver_id,
    assigned_driver_name: load.assigned_driver_name,
    external_ref_label: load.external_ref_label,
    external_ref_url: load.external_ref_url,
    planned_pickup_at: load.planned_pickup_at,
    actual_pickup_at: load.actual_pickup_at,
    planned_delivery_at: load.planned_delivery_at,
    actual_delivery_at: load.actual_delivery_at,
    last_manual_location: load.last_manual_location,
    last_manual_location_at: load.last_manual_location_at,
    reschedule_note: load.reschedule_note,
    stale_after_minutes: load.stale_after_minutes,
    ...(load.stops ? { stops: load.stops } : {}),
  });
}

/** Reschedule planned times with a required manual note — never invents ETAs. */
export async function rescheduleLoad(
  load: DispatchLoad,
  input: {
    note: string;
    planned_pickup_at?: string | null;
    planned_delivery_at?: string | null;
    stops?: LoadStop[];
  },
): Promise<DispatchLoad> {
  const pickup = input.planned_pickup_at ?? load.planned_pickup_at;
  const delivery = input.planned_delivery_at ?? load.planned_delivery_at;
  const err = validateReschedule(input.note, pickup, delivery);
  if (err) throw new Error(err);
  const stops = input.stops ?? load.stops;
  return saveLoad({
    id: load.id,
    load_number: load.load_number,
    status: load.status === "cancelled" ? "planned" : load.status,
    cancel_reason: load.cancel_reason,
    reschedule_note: input.note.trim(),
    planned_pickup_at: pickup,
    planned_delivery_at: delivery,
    customer_name: load.customer_name,
    commodity: load.commodity,
    equipment: load.equipment,
    notes: load.notes,
    exception_open: load.exception_open,
    bol_status: load.bol_status,
    pod_status: load.pod_status,
    assigned_driver_id: load.assigned_driver_id,
    assigned_driver_name: load.assigned_driver_name,
    external_ref_label: load.external_ref_label,
    external_ref_url: load.external_ref_url,
    actual_pickup_at: load.actual_pickup_at,
    actual_delivery_at: load.actual_delivery_at,
    last_manual_location: load.last_manual_location,
    last_manual_location_at: load.last_manual_location_at,
    stale_after_minutes: load.stale_after_minutes,
    ...(stops ? { stops } : {}),
  });
}

export async function listHandovers(): Promise<ShiftHandover[]> {
  if (isDispatchPreviewMode()) return mem().handovers;
  const { data, error } = await dispatchSupabase
    .from("dispatch_shift_handovers")
    .select("*")
    .order("shift_date", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as ShiftHandover[];
}

export async function saveHandover(
  input: Partial<ShiftHandover> & {
    shift_date: string;
    from_dispatcher: string;
    summary: string;
  },
): Promise<ShiftHandover> {
  if (isDispatchPreviewMode()) {
    const row: ShiftHandover = {
      id: input.id ?? newId(),
      shift_date: input.shift_date,
      from_dispatcher: input.from_dispatcher,
      to_dispatcher: input.to_dispatcher ?? null,
      summary: input.summary,
      open_load_ids: input.open_load_ids ?? [],
      watch_items: input.watch_items ?? "",
      next_day_priorities: input.next_day_priorities ?? "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const idx = mem().handovers.findIndex((h) => h.id === row.id);
    if (idx >= 0) mem().handovers[idx] = row;
    else mem().handovers.unshift(row);
    return row;
  }
  const { data, error } = await dispatchSupabase
    .from("dispatch_shift_handovers")
    .upsert({
      id: input.id,
      shift_date: input.shift_date,
      from_dispatcher: input.from_dispatcher,
      to_dispatcher: input.to_dispatcher ?? null,
      summary: input.summary,
      open_load_ids: input.open_load_ids ?? [],
      watch_items: input.watch_items ?? "",
      next_day_priorities: input.next_day_priorities ?? "",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ShiftHandover;
}

export function driverLoadHistory(loads: DispatchLoad[], driverId: string): DispatchLoad[] {
  return loads
    .filter((l) => l.assigned_driver_id === driverId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
