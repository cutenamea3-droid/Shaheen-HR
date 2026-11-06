import { useEffect, useState } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOptionalPortalAccount } from "@/components/tracker/LockGate";
import { useViewMode } from "@/lib/viewmode";
import {
  getRateCard,
  peekRateCardMock,
  setPayMethod,
  setRateField,
  subscribeRateCardMock,
} from "@/lib/driver-hr/rate-card-api";
import { driverRateCardModeLabel, getDriverRateCardMode } from "@/lib/driver-hr/rate-card-mode";
import {
  RATE_FIELD_DEFS,
  RATE_GROUP_LABEL,
  RATE_PAY_METHOD_OPTIONS,
  rateCardHasContent,
  type DriverRateCard,
  type RateFieldGroup,
  type RatePayMethod,
} from "@/lib/driver-hr/rate-card-types";
import { recordSensitiveAudit } from "@/lib/driver-hr/sensitive-audit";

/**
 * Collapsible Rate Card — admin-only.
 * All fields optional; blank ≠ 0; decimals preserved; never touches payroll/compliance.
 */
export function RateCardPanel({ driverId }: { driverId: string }) {
  const account = useOptionalPortalAccount()?.account;
  const role = account?.role;
  const actor = account?.email ?? "portal";
  const view = useViewMode();
  const isAdmin = role === "admin";
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<DriverRateCard>(() => peekRateCardMock(driverId));
  const mode = getDriverRateCardMode();

  useEffect(() => {
    let alive = true;
    const reload = () => {
      if (getDriverRateCardMode() !== "secure") {
        if (alive) setCard(peekRateCardMock(driverId));
        return;
      }
      void getRateCard(driverId).then((c) => {
        if (alive) setCard(c);
      });
    };
    reload();
    const unsub = subscribeRateCardMock(reload);
    return () => {
      alive = false;
      unsub();
    };
  }, [driverId]);

  useEffect(() => {
    if (open && isAdmin) {
      recordSensitiveAudit({ actor, action: "rate_card_view", driverId });
    }
  }, [open, isAdmin, actor, driverId]);

  if (!isAdmin) {
    return (
      <section className="tracker-profile-section">
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-bold text-foreground">Rate Card</span> — admin only (pay rates are not stored in the shared driver JSON).
          </span>
        </div>
      </section>
    );
  }

  const groups: RateFieldGroup[] = ["general", "hourly", "additional"];
  const filled = rateCardHasContent(card);

  return (
    <section className="tracker-profile-section">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div>
          <h3 className="tracker-profile-section-h !mb-0 !border-0">Rate Card</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Optional · authorized · {driverRateCardModeLabel(mode)}
            {filled ? " · has values" : " · empty / partial OK"}
          </p>
        </div>
        <ChevronDown className={cn("size-5 shrink-0 transition", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="space-y-4 border-t border-foreground/10 px-4 py-4">
          <p className="text-xs text-muted-foreground">
            All fields optional including Pay Method — empty or partial save is OK. Blank is not zero.
            Typed decimals are preserved (not rounded). No attendance / payroll / settlement side effects.
          </p>
          {groups.map((group) => (
            <div key={group}>
              <div className="mb-2 text-xs font-extrabold tracking-wider text-muted-foreground uppercase">
                {RATE_GROUP_LABEL[group]}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {RATE_FIELD_DEFS.filter((f) => f.group === group).map((f) => (
                  <RateFieldInput
                    key={f.key}
                    label={f.label}
                    {...(f.hint ? { hint: f.hint } : {})}
                    value={card.rates[f.key] ?? ""}
                    disabled={view}
                    onSave={async (raw) => {
                      const r = await setRateField(driverId, f.key, raw);
                      if (!r.ok) {
                        toast.error(r.error);
                        return false;
                      }
                      setCard(r.card);
                      return true;
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
          <div>
            <div className="mb-2 text-xs font-extrabold tracking-wider text-muted-foreground uppercase">Pay Method</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-muted-foreground">Method</span>
                <select
                  disabled={view}
                  value={card.payMethod}
                  onChange={async (e) => {
                    const next = e.target.value as RatePayMethod;
                    const updated = await setPayMethod(driverId, next);
                    setCard(updated);
                  }}
                  className="w-full rounded-lg border bg-card px-2.5 py-2 text-sm font-semibold"
                >
                  {RATE_PAY_METHOD_OPTIONS.map((o) => (
                    <option key={o.value || "blank"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <RateFieldInput
                label="Pay method note"
                value={card.payMethodNote}
                disabled={view}
                onSave={async (raw) => {
                  const updated = await setPayMethod(driverId, card.payMethod, raw.trim());
                  setCard(updated);
                  return true;
                }}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function RateFieldInput({
  label,
  hint,
  value,
  disabled,
  onSave,
}: {
  label: string;
  hint?: string;
  value: string;
  disabled?: boolean;
  onSave: (raw: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setDraft(value);
  }, [value, dirty]);

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-muted-foreground">
        {label}
        {/* no required star — all optional */}
      </span>
      {hint && <span className="mb-1 block text-[11px] text-muted-foreground/80">{hint}</span>}
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={draft}
        placeholder="—"
        onChange={(e) => {
          setDraft(e.target.value);
          setDirty(true);
        }}
        onBlur={async () => {
          if (!dirty) return;
          const ok = await onSave(draft);
          if (ok) setDirty(false);
        }}
        className="w-full rounded-lg border bg-card px-2.5 py-1.5 font-mono text-sm font-semibold tabular-nums"
      />
    </label>
  );
}
