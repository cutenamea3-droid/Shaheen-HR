export type DispatchRole = "admin" | "dispatcher";

export type DispatchAccount = {
  user_id: string;
  email: string;
  display_name: string;
  role: DispatchRole;
  active: boolean;
};

export type LoadStatus =
  | "draft"
  | "planned"
  | "assigned"
  | "in_transit"
  | "at_pickup"
  | "loaded"
  | "at_delivery"
  | "delivered"
  | "closed"
  | "cancelled";

export type DocStatus = "missing" | "pending" | "received" | "verified" | "exception";

export type StopType = "pickup" | "delivery" | "other";

export type RosterDriver = {
  id: string;
  display_name: string;
  unit_number: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type LoadStop = {
  id?: string;
  load_id?: string;
  sequence: number;
  stop_type: StopType;
  name: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  planned_at: string | null;
  actual_at: string | null;
  notes: string;
};

export type DispatchLoad = {
  id: string;
  load_number: string;
  customer_name: string | null;
  commodity: string | null;
  equipment: string | null;
  notes: string | null;
  status: LoadStatus;
  exception_open: boolean;
  bol_status: DocStatus;
  pod_status: DocStatus;
  assigned_driver_id: string | null;
  assigned_driver_name: string | null;
  external_ref_label: string | null;
  external_ref_url: string | null;
  planned_pickup_at: string | null;
  actual_pickup_at: string | null;
  planned_delivery_at: string | null;
  actual_delivery_at: string | null;
  last_manual_location: string | null;
  last_manual_location_at: string | null;
  last_manual_location_by: string | null;
  stale_after_minutes: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  stops?: LoadStop[];
};

export type CheckCall = {
  id: string;
  load_id: string;
  called_at: string;
  manual_location: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
};

export type DispatchException = {
  id: string;
  load_id: string;
  kind: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "watching" | "resolved";
  notes: string | null;
  opened_at: string;
  resolved_at: string | null;
};

export type DispatchIssue = {
  id: string;
  load_id: string | null;
  title: string;
  detail: string | null;
  escalation_level: "ops" | "supervisor" | "manager" | "critical";
  status: "open" | "escalated" | "resolved";
  created_at: string;
  updated_at: string;
};

export type ShiftHandover = {
  id: string;
  shift_date: string;
  from_dispatcher: string;
  to_dispatcher: string | null;
  summary: string;
  open_load_ids: string[];
  watch_items: string;
  next_day_priorities: string;
  created_at: string;
  updated_at: string;
};

export type DispatchView =
  | "home"
  | "loads"
  | "load"
  | "roster"
  | "team"
  | "handover"
  | "issues"
  | "reports"
  | "history";

export const LOAD_STATUS_LABELS: Record<LoadStatus, string> = {
  draft: "Draft",
  planned: "Planned",
  assigned: "Assigned",
  in_transit: "In transit",
  at_pickup: "At pickup",
  loaded: "Loaded",
  at_delivery: "At delivery",
  delivered: "Delivered",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const ACTIVE_LOAD_STATUSES: LoadStatus[] = [
  "draft",
  "planned",
  "assigned",
  "in_transit",
  "at_pickup",
  "loaded",
  "at_delivery",
];
