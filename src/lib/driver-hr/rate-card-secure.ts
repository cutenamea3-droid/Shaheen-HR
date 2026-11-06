/**
 * Secure Driver Rate Card client — calls admin-gated RPCs on Driver Supabase.
 * Only used when VITE_DRIVER_RATE_CARD_SECURE=1 and migration is applied.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  emptyRateCard,
  type DriverRateCard,
  type RatePayMethod,
} from "./rate-card-types";

// Tables/RPCs are not in generated types until migration is applied.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function mapRow(row: {
  driver_id: string;
  rates: Record<string, string> | null;
  pay_method: string | null;
  pay_method_note: string | null;
  updated_at: string;
}): DriverRateCard {
  return {
    driverId: row.driver_id,
    rates: row.rates && typeof row.rates === "object" ? { ...row.rates } : {},
    payMethod: (row.pay_method ?? "") as RatePayMethod,
    payMethodNote: row.pay_method_note ?? "",
    updatedAt: Date.parse(row.updated_at) || Date.now(),
  };
}

export async function secureGetRateCard(driverId: string): Promise<DriverRateCard> {
  const { data, error } = await db.rpc("driver_rate_card_get", { p_driver_id: driverId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return emptyRateCard(driverId);
  return mapRow(row);
}

export async function secureUpsertRateCard(card: DriverRateCard): Promise<DriverRateCard> {
  const { data, error } = await db.rpc("driver_rate_card_upsert", {
    p_driver_id: card.driverId,
    p_rates: card.rates,
    p_pay_method: card.payMethod || null,
    p_pay_method_note: card.payMethodNote || null,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return card;
  return mapRow(row);
}
