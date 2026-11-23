import { useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SECTIONS, headersOf, type SectionDef } from "@/lib/sections";
import { statusTone } from "@/lib/alerts";
import {
  findAddDriverIdentityMatches,
  type AddDriverIdentityMatch,
} from "@/lib/driver-selectors";
import { DUPLICATE_DRIVER_POLICY } from "@/lib/driver-profile-completion";
import { addDriver, useData } from "@/lib/store";
import { TONE_BOX } from "./cells";

const asText = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : String(v));

const WIZ = SECTIONS.filter((s) => s.inWizard);

/** Columns filled automatically from step 1 (name / license / state / active). */
function autoCol(def: SectionDef, i: number, headers: string[]) {
  const t = def.types[i];
  if (t === "name" || t === "state" || t === "active" || t === "score") return true;
  if (t === "text" && /license/i.test(headers[i])) return true;
  return false;
}

export function AddDriverDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const data = useData();
  const [step, setStep] = useState(0);
  const [base, setBase] = useState({ name: "", cdl: "", state: "CA" });
  const [vals, setVals] = useState<Record<string, string[]>>({});
  const [err, setErr] = useState("");
  const [dupAck, setDupAck] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const cdlRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<HTMLInputElement>(null);
  const readBase = () => ({
    name: (asText(base.name).trim() || nameRef.current?.value || "").trim(),
    cdl: (asText(base.cdl).trim() || cdlRef.current?.value || "").trim(),
    state: (asText(base.state).trim() || stateRef.current?.value || "CA").trim().toUpperCase() || "CA",
  });

  const identityMatches = useMemo(
    () => findAddDriverIdentityMatches(data, { name: base.name, cdl: base.cdl }),
    [data, base.name, base.cdl],
  );

  const cellsFor = (def: SectionDef) => vals[def.id] ?? def.types.map(() => "");
  const setV = (def: SectionDef, i: number, v: string) =>
    setVals((p) => ({ ...p, [def.id]: cellsFor(def).map((c, j) => (j === i ? v : c)) }));

  function reset() {
    setStep(0);
    setBase({ name: "", cdl: "", state: "CA" });
    setVals({});
    setErr("");
    setDupAck(false);
  }

  function saveDriver(b: { name: string; cdl: string; state: string }) {
    const out: Record<string, string[]> = {};
    for (const def of WIZ) {
      const sec = data.sections[def.id];
      if (!sec) continue;
      const headers = headersOf(sec);
      out[def.id] = cellsFor(def).map((c, i) => {
        const t = def.types[i];
        if (t === "name") return b.name;
        if (t === "state") return b.state;
        if (t === "active") return "Active";
        if (t === "text" && /license/i.test(headers[i] ?? "")) return b.cdl;
        // A document left blank is not on file yet → Missing
        if (t === "status" && !c.trim()) return "Missing";
        return c;
      });
    }
    addDriver(out);
    toast.success(
      `${asText(b.name)} added as New Driver (onboarding) — use Move to Active when ready`,
    );
    onOpenChange(false);
    reset();
  }

  function finish() {
    const b = readBase();
    if (!b.name || !b.cdl) {
      setStep(0);
      setErr("Driver name and CDL number are required.");
      return;
    }
    const matches = findAddDriverIdentityMatches(data, b);
    if (matches.length && !dupAck) {
      setStep(0);
      setErr(
        "Possible existing driver match — review below, then confirm to add a separate record. Nothing is merged or deleted.",
      );
      return;
    }
    saveDriver(b);
  }

  const steps = ["Driver", ...WIZ.map((s) => s.short)];
  const def = step > 0 ? WIZ[step - 1] : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-0 [&>button]:top-4 [&>button]:right-4 [&>button]:inline-flex [&>button]:size-10 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-xl [&>button]:bg-primary-foreground/15 [&>button]:p-0 [&>button]:text-primary-foreground [&>button]:opacity-100 [&>button]:shadow-card [&>button]:ring-0 [&>button]:hover:bg-primary-foreground/25 [&>button]:hover:opacity-100 [&>button]:data-[state=open]:bg-primary-foreground/15 [&>button]:data-[state=open]:text-primary-foreground [&>button_svg]:size-5">
        <div className="bg-brand px-6 py-5 pr-16 text-primary-foreground">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary-foreground">Add New Driver</DialogTitle>
            <DialogDescription className="text-base text-primary-foreground/90">
              Only name and CDL number are required — everything else can be filled later.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-wrap gap-2">
            {steps.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setStep(i)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-bold transition",
                  i === step ? "bg-card text-primary shadow-card" : "bg-primary-foreground/20 hover:bg-primary-foreground/30",
                )}
              >
                {i + 1}. {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          {step === 0 && (
            <>
              <Field label="Driver Name *">
                <input
                  ref={nameRef}
                  data-testid="add-driver-name"
                  value={asText(base.name)}
                  onChange={(e) => {
                    setBase({ ...base, name: e.target.value });
                    setDupAck(false);
                  }}
                  onInput={(e) => {
                    setBase((b) => ({ ...b, name: (e.target as HTMLInputElement).value }));
                    setDupAck(false);
                  }}
                  className={inputCls}
                  autoFocus
                />
              </Field>
              <Field label="CDL / Driver License No. *">
                <input
                  ref={cdlRef}
                  data-testid="add-driver-cdl"
                  value={asText(base.cdl)}
                  onChange={(e) => {
                    setBase({ ...base, cdl: e.target.value });
                    setDupAck(false);
                  }}
                  onInput={(e) => {
                    setBase((b) => ({ ...b, cdl: (e.target as HTMLInputElement).value }));
                    setDupAck(false);
                  }}
                  className={inputCls}
                />
              </Field>
              <Field label="State (CA = 10-day DMV alert, others = 20-day)">
                <input
                  ref={stateRef}
                  data-testid="add-driver-state"
                  value={asText(base.state)}
                  onChange={(e) => setBase({ ...base, state: e.target.value.toUpperCase() })}
                  onInput={(e) =>
                    setBase((b) => ({ ...b, state: (e.target as HTMLInputElement).value.toUpperCase() }))
                  }
                  className={inputCls}
                />
              </Field>
              {identityMatches.length > 0 && (
                <IdentityMatchReview
                  matches={identityMatches}
                  ack={dupAck}
                  onAck={setDupAck}
                />
              )}
              {err && (
                <p className="rounded-lg bg-danger-soft px-3 py-2 font-semibold text-danger">
                  {asText(err)}
                </p>
              )}
            </>
          )}
          {def &&
            def.types.map((t, i) => {
              const sec = data.sections[def.id];
              if (!sec) return null;
              const headers = headersOf(sec);
              if (autoCol(def, i, headers)) return null;
              const v = cellsFor(def)[i];
              return (
                <Field key={i} label={(headers[i] ?? `Column ${i + 1}`).trim()}>
                  {t === "status" ? (
                    <div className="flex flex-wrap gap-2">
                      {(Array.isArray(def.statusOptions) ? def.statusOptions : []).map((o) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => setV(def, i, v === o ? "" : o)}
                          className={cn(
                            "rounded-lg border-2 px-3 py-2 text-sm font-bold",
                            TONE_BOX[statusTone(o)],
                            v === o && "ring-2 ring-primary ring-offset-1",
                          )}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  ) : t === "date" ? (
                    <input
                      type="date"
                      value={v}
                      onChange={(e) => setV(def, i, e.target.value)}
                      onInput={(e) => setV(def, i, (e.target as HTMLInputElement).value)}
                      className={inputCls}
                    />
                  ) : t === "note" || t === "plan" || t === "tempnote" ? (
                    <textarea
                      value={v}
                      onChange={(e) => setV(def, i, e.target.value)}
                      onInput={(e) => setV(def, i, (e.target as HTMLTextAreaElement).value)}
                      rows={2}
                      className={inputCls}
                      placeholder={t === "tempnote" ? "Add temporary reminder (never highlights)" : t === "plan" ? "Add future plan" : "Add note"}
                    />
                  ) : (
                    <input
                      value={v}
                      onChange={(e) => setV(def, i, e.target.value)}
                      onInput={(e) => setV(def, i, (e.target as HTMLInputElement).value)}
                      className={inputCls}
                    />
                  )}
                </Field>
              );
            })}
        </div>

        <div className="flex items-center justify-between border-t bg-muted/50 px-6 py-4">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
            className="inline-flex items-center gap-1 rounded-lg border bg-card px-4 py-2 font-semibold disabled:opacity-40"
          >
            <ChevronLeft className="size-4" /> Back
          </button>
          <div className="flex gap-2">
            {step < steps.length - 1 && (
              <button
                type="button"
                onClick={() => {
                  if (step === 0) {
                    const b = readBase();
                    if (!b.name || !b.cdl) {
                      setErr("Driver name and CDL number are required.");
                      return;
                    }
                    const matches = findAddDriverIdentityMatches(data, b);
                    if (matches.length && !dupAck) {
                      setErr(
                        "Possible existing driver match — review below, then confirm to continue. Nothing is merged or deleted.",
                      );
                      return;
                    }
                  }
                  setErr("");
                  setStep(step + 1);
                }}
                className="inline-flex items-center gap-1 rounded-lg border-2 border-primary bg-card px-4 py-2 font-bold text-primary"
              >
                Next <ChevronRight className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={finish}
              data-testid="add-driver-save"
              className="inline-flex items-center gap-1 rounded-lg bg-ok px-5 py-2 font-bold text-primary-foreground shadow-card"
            >
              <Check className="size-4" /> Save Driver
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IdentityMatchReview({
  matches,
  ack,
  onAck,
}: {
  matches: AddDriverIdentityMatch[];
  ack: boolean;
  onAck: (v: boolean) => void;
}) {
  return (
    <div
      className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-3 text-sm text-warn"
      role="status"
      data-testid="add-driver-identity-match"
    >
      <div className="font-extrabold">Possible existing driver — review before adding</div>
      <p className="mt-1 text-xs font-semibold opacity-90">{DUPLICATE_DRIVER_POLICY}</p>
      <ul className="mt-2 space-y-1.5">
        {matches.map((m) => (
          <li key={m.driverId} className="rounded-md bg-card/60 px-2 py-1.5 text-xs font-semibold text-foreground">
            <span className="font-extrabold">{asText(m.name)}</span>
            {" · "}
            CDL {asText(m.cdl) || "—"}
            {" · "}
            <span className="font-mono text-[11px]">{m.driverId}</span>
            {" · "}
            {m.reason === "same_name_and_cdl"
              ? "same name + CDL"
              : m.reason === "same_cdl"
                ? "same CDL"
                : "same name"}
          </li>
        ))}
      </ul>
      <label className="mt-3 flex items-start gap-2 text-xs font-bold text-foreground">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => onAck(e.target.checked)}
          data-testid="add-driver-dup-ack"
          className="mt-0.5"
        />
        <span>
          I reviewed the existing record(s). Add a <em>separate</em> driver (different ID) — do not merge.
        </span>
      </label>
    </div>
  );
}

const inputCls = "w-full rounded-lg border-2 bg-card px-3 py-2.5 text-base outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
