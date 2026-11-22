import { dispatchSupabase } from "@/dispatch/integrations/supabase/client";
import { isDispatchPreviewMode } from "./auth";
import { cloneFixtures } from "./fixtures";
import type {
  CheckCall,
  DispatchAccessorial,
  DispatchCommunication,
  DispatchException,
  DispatchFollowUp,
  DispatchIssue,
  DispatchLoad,
  LoadStop,
  PaymentStatus,
  RosterDriver,
  ShiftHandover,
} from "./types";
import { canCancelLoad, validateCancel, validateReschedule } from "./ops-controls";
import {
  canCloseLoad,
  canReopenLoad,
  validateAccessorialInput,
  validateCloseout,
  validateCommunication,
  validateReopen,
} from "./closeout";

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

/** Only real arrays leave the cloud boundary — never truthy string `.length`. */
function asRows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

/** Desk text fields may arrive as corrupt non-strings — never assume `.trim()`. */
function asText(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

function asNullableText(v: unknown): string | null {
  if (v == null) return null;
  return typeof v === "string" ? v : String(v);
}

/** Heal issue title/detail before UI `{issue.title}` / string templates. */
export function healDispatchIssue(raw: DispatchIssue): DispatchIssue {
  return {
    ...raw,
    title: asText(raw.title),
    detail: asNullableText(raw.detail),
    senior_informed_note: asNullableText(raw.senior_informed_note),
  };
}

/** Heal follow-up title/notes/due_at before UI render and localeCompare. */
export function healDispatchFollowUp(raw: DispatchFollowUp): DispatchFollowUp {
  return {
    ...raw,
    title: asText(raw.title),
    notes: asNullableText(raw.notes),
    due_at: asText(raw.due_at),
  };
}

/** Heal handover summary/watch text before UI render. */
export function healShiftHandover(raw: ShiftHandover): ShiftHandover {
  return {
    ...raw,
    shift_date: asText(raw.shift_date),
    from_dispatcher: asText(raw.from_dispatcher),
    to_dispatcher: asNullableText(raw.to_dispatcher),
    summary: asText(raw.summary),
    watch_items: asText(raw.watch_items),
    next_day_priorities: asText(raw.next_day_priorities),
    open_load_ids: Array.isArray(raw.open_load_ids) ? raw.open_load_ids.map(asText) : [],
  };
}

/** Heal check-call notes/location before UI `{c.notes}` render. */
export function healCheckCall(raw: CheckCall): CheckCall {
  return {
    ...raw,
    notes: asText(raw.notes),
    manual_location: asNullableText(raw.manual_location),
  };
}

/** Heal exception kind/notes before UI string templates. */
export function healDispatchException(raw: DispatchException): DispatchException {
  return {
    ...raw,
    kind: asText(raw.kind),
    notes: asNullableText(raw.notes),
  };
}

/** Heal roster display_name/phone before UI render. */
export function healRosterDriver(raw: RosterDriver): RosterDriver {
  return {
    ...raw,
    display_name: asText(raw.display_name),
    unit_number: asNullableText(raw.unit_number),
    phone: asNullableText(raw.phone),
    notes: asNullableText(raw.notes),
  };
}

/** Heal communication summary/detail before UI render. */
export function healDispatchCommunication(raw: DispatchCommunication): DispatchCommunication {
  return {
    ...raw,
    summary: asText(raw.summary),
    detail: asNullableText(raw.detail),
    decided_action: asNullableText(raw.decided_action),
  };
}

/** Heal stop name/address fields before UI `{stop.name}` render. */
export function healLoadStop(raw: LoadStop): LoadStop {
  return {
    ...raw,
    name: asText(raw.name),
    address: asText(raw.address),
    city: asText(raw.city),
    state: asText(raw.state),
    postal_code: asText(raw.postal_code),
    notes: asText(raw.notes),
    planned_at: asNullableText(raw.planned_at),
    actual_at: asNullableText(raw.actual_at),
  };
}

/** Heal load scalars heavily rendered as React children. */
export function healDispatchLoad(raw: DispatchLoad): DispatchLoad {
  return {
    ...raw,
    load_number: asText(raw.load_number),
    customer_name: asNullableText(raw.customer_name),
    commodity: asNullableText(raw.commodity),
    equipment: asNullableText(raw.equipment),
    notes: asNullableText(raw.notes),
    assigned_driver_name: asNullableText(raw.assigned_driver_name),
    external_ref_label: asNullableText(raw.external_ref_label),
    external_ref_url: asNullableText(raw.external_ref_url),
    last_manual_location: asNullableText(raw.last_manual_location),
    cancel_reason: asNullableText(raw.cancel_reason),
    reschedule_note: asNullableText(raw.reschedule_note),
    closeout_note: asNullableText(raw.closeout_note),
    reopen_reason: asNullableText(raw.reopen_reason),
    ...(Array.isArray(raw.stops) ? { stops: raw.stops.map(healLoadStop) } : {}),
  };
}

/** Heal accessorial description/free_time_note before UI render. */
export function healDispatchAccessorial(raw: DispatchAccessorial): DispatchAccessorial {
  return {
    ...raw,
    description: asText(raw.description),
    free_time_note: asNullableText(raw.free_time_note),
    currency: asText(raw.currency) || "USD",
  };
}

/** Only real stop arrays may round-trip — never truthy string `.length`. */
function arrayStops(stops: unknown): LoadStop[] | undefined {
  return Array.isArray(stops) ? (stops as LoadStop[]) : undefined;
}

function withStops(stops: unknown): { stops: LoadStop[] } | Record<string, never> {
  const list = arrayStops(stops);
  return list ? { stops: list } : {};
}

function newId(): string {
  return crypto.randomUUID();
}

export async function listRosterDrivers(): Promise<RosterDriver[]> {
  if (isDispatchPreviewMode()) {
    return asRows<RosterDriver>(mem().drivers).filter((d) => d.active).map(healRosterDriver);
  }
  const { data, error } = await dispatchSupabase
    .from("dispatch_roster_drivers")
    .select("*")
    .eq("active", true)
    .order("display_name");
  if (error) throw error;
  return asRows<RosterDriver>(data).map(healRosterDriver);
}

export async function upsertRosterDriver(
  input: Partial<RosterDriver> & { display_name: string },
): Promise<RosterDriver> {
  const display_name = asText(input.display_name).trim();
  const unit_number = asNullableText(input.unit_number);
  const phone = asNullableText(input.phone);
  const notes = asNullableText(input.notes);
  if (isDispatchPreviewMode()) {
    const existing = mem().drivers.find((d) => d.id === input.id);
    if (existing) {
      Object.assign(existing, input, {
        display_name,
        unit_number,
        phone,
        notes,
        updated_at: new Date().toISOString(),
      });
      return healRosterDriver(existing);
    }
    const row: RosterDriver = {
      id: newId(),
      display_name,
      unit_number,
      phone,
      notes,
      active: input.active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mem().drivers.push(row);
    return healRosterDriver(row);
  }
  const payload = {
    id: input.id,
    display_name,
    unit_number,
    phone,
    notes,
    active: input.active ?? true,
  };
  const { data, error } = await dispatchSupabase
    .from("dispatch_roster_drivers")
    .upsert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return healRosterDriver(data as RosterDriver);
}

export async function listLoads(): Promise<DispatchLoad[]> {
  if (isDispatchPreviewMode()) {
    return [...asRows<DispatchLoad>(mem().loads)]
      .map(healDispatchLoad)
      .sort((a, b) => asText(b.updated_at).localeCompare(asText(a.updated_at)));
  }
  const { data, error } = await dispatchSupabase
    .from("dispatch_loads")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const loads = asRows<DispatchLoad>(data);
  const ids = loads.map((l) => l.id);
  if (!ids.length) return loads.map(healDispatchLoad);
  const { data: stops, error: stopError } = await dispatchSupabase
    .from("dispatch_load_stops")
    .select("*")
    .in("load_id", ids)
    .order("sequence");
  if (stopError) throw stopError;
  const byLoad = new Map<string, LoadStop[]>();
  for (const stop of asRows<LoadStop>(stops)) {
    const list = byLoad.get(stop.load_id!) ?? [];
    list.push(healLoadStop(stop));
    byLoad.set(stop.load_id!, list);
  }
  return loads.map((l) => healDispatchLoad({ ...l, stops: byLoad.get(l.id) ?? [] }));
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
  closeout_note?: string | null;
  closed_at?: string | null;
  reopen_reason?: string | null;
  reopened_at?: string | null;
  payment_status?: PaymentStatus;
  stale_after_minutes?: number;
  stops?: LoadStop[];
};

export async function saveLoad(input: LoadWriteInput): Promise<DispatchLoad> {
  const now = new Date().toISOString();
  if (!asText(input.load_number).trim()) {
    throw new Error("Load number is required.");
  }
  if (input.status === "cancelled") {
    const err = validateCancel(input.cancel_reason ?? "");
    if (err) throw new Error(err);
  }
  const load_number = asText(input.load_number).trim();
  const customer_name = asNullableText(input.customer_name);
  const commodity = asNullableText(input.commodity);
  const equipment = asNullableText(input.equipment);
  const notes = asNullableText(input.notes);
  const assigned_driver_name = asNullableText(input.assigned_driver_name);
  const external_ref_label = asNullableText(input.external_ref_label);
  const external_ref_url = asNullableText(input.external_ref_url);
  const last_manual_location = asNullableText(input.last_manual_location);
  const cancel_reason = asNullableText(input.cancel_reason);
  const reschedule_note = asNullableText(input.reschedule_note);
  const closeout_note = asNullableText(input.closeout_note);
  const reopen_reason = asNullableText(input.reopen_reason);
  const healedStops = (arrayStops(input.stops) ?? []).map(healLoadStop);

  if (isDispatchPreviewMode()) {
    const idx = mem().loads.findIndex((l) => l.id === input.id);
    const base: DispatchLoad =
      idx >= 0
        ? mem().loads[idx]
        : {
            id: newId(),
            load_number,
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
            closeout_note: null,
            closed_at: null,
            reopen_reason: null,
            reopened_at: null,
            payment_status: "unpaid",
            stale_after_minutes: 180,
            created_by: null,
            updated_by: null,
            created_at: now,
            updated_at: now,
            stops: [],
          };
    const next: DispatchLoad = healDispatchLoad({
      ...base,
      ...input,
      load_number,
      customer_name: customer_name ?? base.customer_name,
      commodity: commodity ?? base.commodity,
      equipment: equipment ?? base.equipment,
      notes: notes ?? base.notes,
      assigned_driver_name: assigned_driver_name ?? base.assigned_driver_name,
      external_ref_label: external_ref_label ?? base.external_ref_label,
      external_ref_url: external_ref_url ?? base.external_ref_url,
      last_manual_location: last_manual_location ?? base.last_manual_location,
      cancel_reason:
        input.status === "cancelled"
          ? (cancel_reason ?? base.cancel_reason)
          : (cancel_reason ?? base.cancel_reason),
      reschedule_note: reschedule_note ?? base.reschedule_note,
      closeout_note: closeout_note ?? base.closeout_note,
      closed_at: input.closed_at ?? base.closed_at,
      reopen_reason: reopen_reason ?? base.reopen_reason,
      reopened_at: input.reopened_at ?? base.reopened_at,
      payment_status: input.payment_status ?? base.payment_status ?? "unpaid",
      updated_at: now,
      stops: healedStops.length ? healedStops : arrayStops(base.stops)?.map(healLoadStop) ?? [],
    });
    if (idx >= 0) mem().loads[idx] = next;
    else mem().loads.unshift(next);
    return next;
  }

  const row = {
    id: input.id,
    load_number,
    customer_name,
    commodity,
    equipment,
    notes,
    status: input.status ?? "planned",
    exception_open: input.exception_open ?? false,
    bol_status: input.bol_status ?? "missing",
    pod_status: input.pod_status ?? "missing",
    assigned_driver_id: input.assigned_driver_id ?? null,
    assigned_driver_name,
    external_ref_label,
    external_ref_url,
    planned_pickup_at: input.planned_pickup_at ?? null,
    actual_pickup_at: input.actual_pickup_at ?? null,
    planned_delivery_at: input.planned_delivery_at ?? null,
    actual_delivery_at: input.actual_delivery_at ?? null,
    last_manual_location,
    last_manual_location_at: input.last_manual_location_at ?? null,
    cancel_reason,
    reschedule_note,
    closeout_note,
    closed_at: input.closed_at ?? null,
    reopen_reason,
    reopened_at: input.reopened_at ?? null,
    payment_status: input.payment_status ?? "unpaid",
    stale_after_minutes: input.stale_after_minutes ?? 180,
    updated_at: now,
  };

  const { data, error } = await dispatchSupabase.from("dispatch_loads").upsert(row).select("*").single();
  if (error) throw error;
  const load = data as DispatchLoad;

  const nextStops = arrayStops(input.stops)?.map(healLoadStop);
  if (nextStops) {
    await dispatchSupabase.from("dispatch_load_stops").delete().eq("load_id", load.id);
    if (nextStops.length) {
      const stopRows = nextStops.map((s, i) => ({
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

  return (
    (await getLoad(load.id)) ??
    healDispatchLoad({
      ...load,
      stops: Array.isArray(nextStops) ? nextStops : [],
    })
  );
}

export async function addCheckCall(input: {
  load_id: string;
  notes: string;
  manual_location?: string | null;
  called_at?: string;
}): Promise<CheckCall> {
  const called_at = input.called_at ?? new Date().toISOString();
  const notes = asText(input.notes).trim() || "Manual check-call";
  const manual_location = asNullableText(input.manual_location);
  if (isDispatchPreviewMode()) {
    const row: CheckCall = {
      id: newId(),
      load_id: input.load_id,
      called_at,
      manual_location,
      notes,
      created_by: null,
      created_at: called_at,
    };
    mem().checkCalls.unshift(row);
    const load = mem().loads.find((l) => l.id === input.load_id);
    if (load && manual_location) {
      load.last_manual_location = manual_location;
      load.last_manual_location_at = called_at;
      load.updated_at = called_at;
    }
    return healCheckCall(row);
  }

  const { data, error } = await dispatchSupabase
    .from("dispatch_check_calls")
    .insert({
      load_id: input.load_id,
      notes,
      manual_location,
      called_at,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (manual_location) {
    await dispatchSupabase
      .from("dispatch_loads")
      .update({
        last_manual_location: manual_location,
        last_manual_location_at: called_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.load_id);
  }
  return healCheckCall(data as CheckCall);
}

export async function listCheckCalls(loadId: string): Promise<CheckCall[]> {
  if (isDispatchPreviewMode()) {
    return asRows<CheckCall>(mem().checkCalls)
      .filter((c) => c.load_id === loadId)
      .map(healCheckCall);
  }
  const { data, error } = await dispatchSupabase
    .from("dispatch_check_calls")
    .select("*")
    .eq("load_id", loadId)
    .order("called_at", { ascending: false });
  if (error) throw error;
  return asRows<CheckCall>(data).map(healCheckCall);
}

export async function listExceptions(): Promise<DispatchException[]> {
  if (isDispatchPreviewMode()) return asRows<DispatchException>(mem().exceptions).map(healDispatchException);
  const { data, error } = await dispatchSupabase
    .from("dispatch_exceptions")
    .select("*")
    .order("opened_at", { ascending: false });
  if (error) throw error;
  return asRows<DispatchException>(data).map(healDispatchException);
}

export async function saveException(
  input: Partial<DispatchException> & { load_id: string; kind: string },
): Promise<DispatchException> {
  const kind = asText(input.kind).trim() || "exception";
  const notes = asNullableText(input.notes);
  if (isDispatchPreviewMode()) {
    const existing = mem().exceptions.find((e) => e.id === input.id);
    if (existing) {
      Object.assign(existing, input, { kind, notes });
      return healDispatchException(existing);
    }
    const row: DispatchException = {
      id: newId(),
      load_id: input.load_id,
      kind,
      severity: input.severity ?? "medium",
      status: input.status ?? "open",
      notes,
      opened_at: new Date().toISOString(),
      resolved_at: input.resolved_at ?? null,
    };
    mem().exceptions.unshift(row);
    const load = mem().loads.find((l) => l.id === input.load_id);
    if (load) load.exception_open = row.status !== "resolved";
    return healDispatchException(row);
  }
  const { data, error } = await dispatchSupabase
    .from("dispatch_exceptions")
    .upsert({
      id: input.id,
      load_id: input.load_id,
      kind,
      severity: input.severity ?? "medium",
      status: input.status ?? "open",
      notes,
      resolved_at: input.status === "resolved" ? new Date().toISOString() : input.resolved_at ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  await dispatchSupabase
    .from("dispatch_loads")
    .update({ exception_open: (data as DispatchException).status !== "resolved" })
    .eq("id", input.load_id);
  return healDispatchException(data as DispatchException);
}

export async function listIssues(): Promise<DispatchIssue[]> {
  if (isDispatchPreviewMode()) return asRows<DispatchIssue>(mem().issues).map(healDispatchIssue);
  const { data, error } = await dispatchSupabase
    .from("dispatch_issues")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return asRows<DispatchIssue>(data).map(healDispatchIssue);
}

export async function saveIssue(
  input: Partial<DispatchIssue> & { title: string },
): Promise<DispatchIssue> {
  const now = new Date().toISOString();
  const title = asText(input.title).trim();
  const detail = asNullableText(input.detail);
  const seniorNote = asNullableText(input.senior_informed_note);
  if (isDispatchPreviewMode()) {
    const existing = mem().issues.find((i) => i.id === input.id);
    if (existing) {
      const senior_informed = input.senior_informed ?? existing.senior_informed;
      Object.assign(existing, input, {
        title,
        detail,
        senior_informed,
        senior_informed_at: senior_informed
          ? (input.senior_informed_at ?? existing.senior_informed_at ?? now)
          : null,
        senior_informed_note: senior_informed
          ? (seniorNote ?? existing.senior_informed_note)
          : null,
        updated_at: now,
      });
      return healDispatchIssue(existing);
    }
    const senior_informed = input.senior_informed ?? false;
    const row: DispatchIssue = {
      id: newId(),
      load_id: input.load_id ?? null,
      title,
      detail,
      escalation_level: input.escalation_level ?? "ops",
      status: input.status ?? "open",
      senior_informed,
      senior_informed_at: senior_informed ? (input.senior_informed_at ?? now) : null,
      senior_informed_note: senior_informed ? seniorNote : null,
      created_at: now,
      updated_at: now,
    };
    mem().issues.unshift(row);
    return healDispatchIssue(row);
  }
  const senior_informed = input.senior_informed ?? false;
  const { data, error } = await dispatchSupabase
    .from("dispatch_issues")
    .upsert({
      id: input.id,
      load_id: input.load_id ?? null,
      title,
      detail,
      escalation_level: input.escalation_level ?? "ops",
      status: input.status ?? "open",
      senior_informed,
      senior_informed_at: senior_informed ? (input.senior_informed_at ?? now) : null,
      senior_informed_note: senior_informed ? seniorNote : null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return healDispatchIssue(data as DispatchIssue);
}

export async function listFollowUps(): Promise<DispatchFollowUp[]> {
  if (isDispatchPreviewMode()) {
    return [...asRows<DispatchFollowUp>(mem().followUps)]
      .map(healDispatchFollowUp)
      .sort((a, b) => asText(a.due_at).localeCompare(asText(b.due_at)));
  }
  const { data, error } = await dispatchSupabase
    .from("dispatch_follow_ups")
    .select("*")
    .order("due_at", { ascending: true });
  if (error) throw error;
  return asRows<DispatchFollowUp>(data).map(healDispatchFollowUp);
}

export async function saveFollowUp(
  input: Partial<DispatchFollowUp> & { title: string; due_at: string },
): Promise<DispatchFollowUp> {
  const now = new Date().toISOString();
  const title = asText(input.title).trim();
  const notes = asNullableText(input.notes);
  const due_at = asText(input.due_at);
  if (isDispatchPreviewMode()) {
    const existing = mem().followUps.find((f) => f.id === input.id);
    if (existing) {
      Object.assign(existing, input, { title, notes, due_at, updated_at: now });
      return healDispatchFollowUp(existing);
    }
    const row: DispatchFollowUp = {
      id: newId(),
      load_id: input.load_id ?? null,
      title,
      notes,
      due_at,
      status: input.status ?? "open",
      created_by: input.created_by ?? null,
      created_at: now,
      updated_at: now,
    };
    mem().followUps.unshift(row);
    return healDispatchFollowUp(row);
  }
  const { data, error } = await dispatchSupabase
    .from("dispatch_follow_ups")
    .upsert({
      id: input.id,
      load_id: input.load_id ?? null,
      title,
      notes,
      due_at,
      status: input.status ?? "open",
    })
    .select("*")
    .single();
  if (error) throw error;
  return healDispatchFollowUp(data as DispatchFollowUp);
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
    cancel_reason: asText(reason).trim(),
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
    closeout_note: load.closeout_note,
    closed_at: load.closed_at,
    reopen_reason: load.reopen_reason,
    reopened_at: load.reopened_at,
    payment_status: load.payment_status,
    stale_after_minutes: load.stale_after_minutes,
    ...withStops(load.stops),
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
  const stops = arrayStops(input.stops) ?? arrayStops(load.stops);
  return saveLoad({
    id: load.id,
    load_number: load.load_number,
    status: load.status === "cancelled" ? "planned" : load.status,
    cancel_reason: load.cancel_reason,
    reschedule_note: asText(input.note).trim(),
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
    closeout_note: load.closeout_note,
    closed_at: load.closed_at,
    reopen_reason: load.reopen_reason,
    reopened_at: load.reopened_at,
    payment_status: load.payment_status,
    stale_after_minutes: load.stale_after_minutes,
    ...withStops(stops),
  });
}

export async function listHandovers(): Promise<ShiftHandover[]> {
  if (isDispatchPreviewMode()) return asRows<ShiftHandover>(mem().handovers).map(healShiftHandover);
  const { data, error } = await dispatchSupabase
    .from("dispatch_shift_handovers")
    .select("*")
    .order("shift_date", { ascending: false })
    .limit(30);
  if (error) throw error;
  return asRows<ShiftHandover>(data).map(healShiftHandover);
}

export async function saveHandover(
  input: Partial<ShiftHandover> & {
    shift_date: string;
    from_dispatcher: string;
    summary: string;
  },
): Promise<ShiftHandover> {
  const summary = asText(input.summary).trim();
  const shift_date = asText(input.shift_date);
  const from_dispatcher = asText(input.from_dispatcher);
  const to_dispatcher = asNullableText(input.to_dispatcher);
  const watch_items = asText(input.watch_items);
  const next_day_priorities = asText(input.next_day_priorities);
  const open_load_ids = Array.isArray(input.open_load_ids) ? input.open_load_ids.map(asText) : [];
  if (isDispatchPreviewMode()) {
    const row: ShiftHandover = {
      id: input.id ?? newId(),
      shift_date,
      from_dispatcher,
      to_dispatcher,
      summary,
      open_load_ids,
      watch_items,
      next_day_priorities,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const idx = mem().handovers.findIndex((h) => h.id === row.id);
    if (idx >= 0) mem().handovers[idx] = row;
    else mem().handovers.unshift(row);
    return healShiftHandover(row);
  }
  const { data, error } = await dispatchSupabase
    .from("dispatch_shift_handovers")
    .upsert({
      id: input.id,
      shift_date,
      from_dispatcher,
      to_dispatcher,
      summary,
      open_load_ids,
      watch_items,
      next_day_priorities,
    })
    .select("*")
    .single();
  if (error) throw error;
  return healShiftHandover(data as ShiftHandover);
}

export function driverLoadHistory(loads: DispatchLoad[], driverId: string): DispatchLoad[] {
  return asRows<DispatchLoad>(loads)
    .filter((l) => l.assigned_driver_id === driverId)
    .sort((a, b) => asText(b.updated_at).localeCompare(asText(a.updated_at)));
}

/** Close a delivered load. Does NOT mark payment paid. */
export async function closeLoad(
  load: DispatchLoad,
  note: string,
): Promise<DispatchLoad> {
  if (!canCloseLoad(load.status)) {
    throw new Error("Only delivered loads can be closed (Delivered ≠ Closed).");
  }
  const err = validateCloseout(note);
  if (err) throw new Error(err);
  const now = new Date().toISOString();
  return saveLoad({
    id: load.id,
    load_number: load.load_number,
    status: "closed",
    closeout_note: asText(note).trim(),
    closed_at: now,
    payment_status: load.payment_status,
    reopen_reason: load.reopen_reason,
    reopened_at: load.reopened_at,
    cancel_reason: load.cancel_reason,
    reschedule_note: load.reschedule_note,
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
    stale_after_minutes: load.stale_after_minutes,
    ...withStops(load.stops),
  });
}

/** Reopen a closed load back to delivered. Does NOT change payment_status. */
export async function reopenLoad(
  load: DispatchLoad,
  reason: string,
): Promise<DispatchLoad> {
  if (!canReopenLoad(load.status)) {
    throw new Error("Only closed loads can be reopened to delivered.");
  }
  const err = validateReopen(reason);
  if (err) throw new Error(err);
  const now = new Date().toISOString();
  return saveLoad({
    id: load.id,
    load_number: load.load_number,
    status: "delivered",
    reopen_reason: asText(reason).trim(),
    reopened_at: now,
    closeout_note: load.closeout_note,
    closed_at: load.closed_at,
    payment_status: load.payment_status,
    cancel_reason: load.cancel_reason,
    reschedule_note: load.reschedule_note,
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
    stale_after_minutes: load.stale_after_minutes,
    ...withStops(load.stops),
  });
}

/** Set payment status independently of delivered/closed. */
export async function setLoadPaymentStatus(
  load: DispatchLoad,
  payment_status: PaymentStatus,
): Promise<DispatchLoad> {
  return saveLoad({
    id: load.id,
    load_number: load.load_number,
    status: load.status,
    payment_status,
    closeout_note: load.closeout_note,
    closed_at: load.closed_at,
    reopen_reason: load.reopen_reason,
    reopened_at: load.reopened_at,
    cancel_reason: load.cancel_reason,
    reschedule_note: load.reschedule_note,
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
    stale_after_minutes: load.stale_after_minutes,
    ...withStops(load.stops),
  });
}

export async function listAccessorials(loadId?: string): Promise<DispatchAccessorial[]> {
  if (isDispatchPreviewMode()) {
    const rows = asRows<DispatchAccessorial>(mem().accessorials).map(healDispatchAccessorial);
    return (loadId ? rows.filter((a) => a.load_id === loadId) : [...rows]).sort((a, b) =>
      asText(b.updated_at).localeCompare(asText(a.updated_at)),
    );
  }
  let q = dispatchSupabase.from("dispatch_accessorials").select("*").order("updated_at", { ascending: false });
  if (loadId) q = q.eq("load_id", loadId);
  const { data, error } = await q;
  if (error) throw error;
  return asRows<DispatchAccessorial>(data).map(healDispatchAccessorial);
}

export async function saveAccessorial(
  input: Partial<DispatchAccessorial> & {
    load_id: string;
    kind: DispatchAccessorial["kind"];
    description: string;
  },
): Promise<DispatchAccessorial> {
  const description = asText(input.description).trim();
  const free_time_note = asNullableText(input.free_time_note);
  const currency = asText(input.currency) || "USD";
  const err = validateAccessorialInput({
    kind: input.kind,
    description,
    amount_manual: input.amount_manual ?? null,
    hours_manual: input.hours_manual ?? null,
  });
  if (err) throw new Error(err);
  const now = new Date().toISOString();
  if (isDispatchPreviewMode()) {
    const existing = mem().accessorials.find((a) => a.id === input.id);
    if (existing) {
      Object.assign(existing, input, {
        description,
        free_time_note,
        currency,
        updated_at: now,
      });
      return healDispatchAccessorial(existing);
    }
    const row: DispatchAccessorial = {
      id: newId(),
      load_id: input.load_id,
      kind: input.kind,
      status: input.status ?? "draft",
      description,
      amount_manual: input.amount_manual ?? null,
      hours_manual: input.hours_manual ?? null,
      free_time_note,
      currency,
      created_by: input.created_by ?? null,
      created_at: now,
      updated_at: now,
    };
    mem().accessorials.unshift(row);
    return healDispatchAccessorial(row);
  }
  const { data, error } = await dispatchSupabase
    .from("dispatch_accessorials")
    .upsert({
      id: input.id,
      load_id: input.load_id,
      kind: input.kind,
      status: input.status ?? "draft",
      description,
      amount_manual: input.amount_manual ?? null,
      hours_manual: input.hours_manual ?? null,
      free_time_note,
      currency,
    })
    .select("*")
    .single();
  if (error) throw error;
  return healDispatchAccessorial(data as DispatchAccessorial);
}

export async function listCommunications(loadId?: string): Promise<DispatchCommunication[]> {
  if (isDispatchPreviewMode()) {
    const rows = asRows<DispatchCommunication>(mem().communications).map(healDispatchCommunication);
    return (loadId ? rows.filter((c) => c.load_id === loadId) : [...rows]).sort((a, b) =>
      asText(b.created_at).localeCompare(asText(a.created_at)),
    );
  }
  let q = dispatchSupabase
    .from("dispatch_communications")
    .select("*")
    .order("created_at", { ascending: false });
  if (loadId) q = q.eq("load_id", loadId);
  const { data, error } = await q;
  if (error) throw error;
  return asRows<DispatchCommunication>(data).map(healDispatchCommunication);
}

export async function saveCommunication(
  input: Partial<DispatchCommunication> & {
    load_id: string;
    kind: DispatchCommunication["kind"];
    summary: string;
  },
): Promise<DispatchCommunication> {
  const summary = asText(input.summary).trim();
  const detail = asNullableText(input.detail);
  const decided_action = asNullableText(input.decided_action);
  const err = validateCommunication({
    kind: input.kind,
    summary,
    decided_action,
  });
  if (err) throw new Error(err);
  const now = new Date().toISOString();
  if (isDispatchPreviewMode()) {
    const existing = mem().communications.find((c) => c.id === input.id);
    if (existing) {
      Object.assign(existing, input, { summary, detail, decided_action });
      return healDispatchCommunication(existing);
    }
    const row: DispatchCommunication = {
      id: newId(),
      load_id: input.load_id,
      kind: input.kind,
      summary,
      detail,
      decided_action,
      created_by: input.created_by ?? null,
      created_at: now,
    };
    mem().communications.unshift(row);
    return healDispatchCommunication(row);
  }
  const { data, error } = await dispatchSupabase
    .from("dispatch_communications")
    .upsert({
      id: input.id,
      load_id: input.load_id,
      kind: input.kind,
      summary,
      detail,
      decided_action,
    })
    .select("*")
    .single();
  if (error) throw error;
  return healDispatchCommunication(data as DispatchCommunication);
}
