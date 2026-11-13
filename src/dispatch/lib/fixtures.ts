/**
 * In-memory fixtures for preview/dev when cloud SQL is not applied.
 * Labeled as fixtures — never presented as live GPS or production cloud sync.
 */
import type {
  CheckCall,
  DispatchException,
  DispatchIssue,
  DispatchLoad,
  LoadStop,
  RosterDriver,
  ShiftHandover,
} from "./types";

const now = Date.now();
const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();

export const fixtureDrivers: RosterDriver[] = [
  {
    id: "drv-1",
    display_name: "Alex Rivera",
    unit_number: "214",
    phone: null,
    notes: "Dispatch roster only — not Compliance profile",
    active: true,
  },
  {
    id: "drv-2",
    display_name: "Jordan Lee",
    unit_number: "331",
    phone: null,
    notes: null,
    active: true,
  },
];

const stopsA: LoadStop[] = [
  {
    sequence: 1,
    stop_type: "pickup",
    name: "Chicago DC",
    address: "1200 Warehouse Rd",
    city: "Chicago",
    state: "IL",
    postal_code: "60601",
    planned_at: iso(120),
    actual_at: iso(90),
    notes: "",
  },
  {
    sequence: 2,
    stop_type: "delivery",
    name: "Detroit Consignee",
    address: "88 Plant Ave",
    city: "Detroit",
    state: "MI",
    postal_code: "48201",
    planned_at: iso(-180),
    actual_at: null,
    notes: "",
  },
];

export const fixtureLoads: DispatchLoad[] = [
  {
    id: "load-1",
    load_number: "SH-1001",
    customer_name: "Midwest Retail",
    commodity: "Dry goods",
    equipment: "53' van",
    notes: "Call receiver before arrival",
    status: "in_transit",
    exception_open: false,
    bol_status: "received",
    pod_status: "missing",
    assigned_driver_id: "drv-1",
    assigned_driver_name: "Alex Rivera",
    external_ref_label: "Reference only — TMS link",
    external_ref_url: "https://example.com/loads/SH-1001",
    planned_pickup_at: stopsA[0].planned_at,
    actual_pickup_at: stopsA[0].actual_at,
    planned_delivery_at: stopsA[1].planned_at,
    actual_delivery_at: null,
    last_manual_location: "I-94 near Gary, IN",
    last_manual_location_at: iso(200),
    last_manual_location_by: null,
    stale_after_minutes: 120,
    created_by: null,
    updated_by: null,
    created_at: iso(400),
    updated_at: iso(200),
    stops: stopsA,
  },
  {
    id: "load-2",
    load_number: "SH-1002",
    customer_name: "Great Lakes Foods",
    commodity: "Refrigerated",
    equipment: "Reefer",
    notes: "",
    status: "planned",
    exception_open: true,
    bol_status: "pending",
    pod_status: "missing",
    assigned_driver_id: "drv-2",
    assigned_driver_name: "Jordan Lee",
    external_ref_label: null,
    external_ref_url: null,
    planned_pickup_at: iso(-60),
    actual_pickup_at: null,
    planned_delivery_at: iso(-600),
    actual_delivery_at: null,
    last_manual_location: null,
    last_manual_location_at: null,
    last_manual_location_by: null,
    stale_after_minutes: 180,
    created_by: null,
    updated_by: null,
    created_at: iso(50),
    updated_at: iso(50),
    stops: [
      {
        sequence: 1,
        stop_type: "pickup",
        name: "Cold Storage",
        address: "1 Ice Way",
        city: "Milwaukee",
        state: "WI",
        postal_code: "53202",
        planned_at: iso(-60),
        actual_at: null,
        notes: "",
      },
      {
        sequence: 2,
        stop_type: "delivery",
        name: "Store 14",
        address: "400 Market St",
        city: "Madison",
        state: "WI",
        postal_code: "53703",
        planned_at: iso(-600),
        actual_at: null,
        notes: "",
      },
    ],
  },
  {
    id: "load-3",
    load_number: "SH-0990",
    customer_name: "Harbor Imports",
    commodity: "General",
    equipment: "53' van",
    notes: "Delivered — awaiting close",
    status: "delivered",
    exception_open: false,
    bol_status: "verified",
    pod_status: "received",
    assigned_driver_id: "drv-1",
    assigned_driver_name: "Alex Rivera",
    external_ref_label: null,
    external_ref_url: null,
    planned_pickup_at: iso(2000),
    actual_pickup_at: iso(1950),
    planned_delivery_at: iso(800),
    actual_delivery_at: iso(780),
    last_manual_location: "Detroit, MI — delivered",
    last_manual_location_at: iso(780),
    last_manual_location_by: null,
    stale_after_minutes: 180,
    created_by: null,
    updated_by: null,
    created_at: iso(2200),
    updated_at: iso(780),
    stops: [],
  },
];

export const fixtureCheckCalls: CheckCall[] = [
  {
    id: "cc-1",
    load_id: "load-1",
    called_at: iso(200),
    manual_location: "I-94 near Gary, IN",
    notes: "ETA Detroit 18:30 local — manual check-call (not Live GPS)",
    created_by: null,
    created_at: iso(200),
  },
];

export const fixtureExceptions: DispatchException[] = [
  {
    id: "ex-1",
    load_id: "load-2",
    kind: "Appointment risk",
    severity: "high",
    status: "open",
    notes: "Shipper appointment may slip",
    opened_at: iso(40),
    resolved_at: null,
  },
];

export const fixtureIssues: DispatchIssue[] = [
  {
    id: "iss-1",
    load_id: "load-2",
    title: "Reefer setpoint confirmation",
    detail: "Confirm 34F with shipper before pickup",
    escalation_level: "ops",
    status: "open",
    created_at: iso(35),
    updated_at: iso(35),
  },
];

export const fixtureHandovers: ShiftHandover[] = [
  {
    id: "ho-1",
    shift_date: new Date().toISOString().slice(0, 10),
    from_dispatcher: "Night Desk",
    to_dispatcher: "Morning Desk",
    summary: "SH-1001 in transit; SH-1002 appointment risk open.",
    open_load_ids: ["load-1", "load-2"],
    watch_items: "SH-1002 — call shipper at 07:00",
    next_day_priorities: "Close SH-0990 after POD scan; refresh SH-1001 check-call",
    created_at: iso(30),
    updated_at: iso(30),
  },
];

export function cloneFixtures() {
  return {
    drivers: structuredClone(fixtureDrivers),
    loads: structuredClone(fixtureLoads),
    checkCalls: structuredClone(fixtureCheckCalls),
    exceptions: structuredClone(fixtureExceptions),
    issues: structuredClone(fixtureIssues),
    handovers: structuredClone(fixtureHandovers),
  };
}
