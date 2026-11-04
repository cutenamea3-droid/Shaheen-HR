import { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SECTIONS, type SectionDef } from "@/lib/sections";
import { statusTone } from "@/lib/alerts";
import { addDriver, useData } from "@/lib/store";
import { TONE_BOX } from "./cells";

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

  const cellsFor = (def: SectionDef) => vals[def.id] ?? def.types.map(() => "");
  const setV = (def: SectionDef, i: number, v: string) =>
    setVals((p) => ({ ...p, [def.id]: cellsFor(def).map((c, j) => (j === i ? v : c)) }));

  function reset() {
    setStep(0);
    setBase({ name: "", cdl: "", state: "CA" });
    setVals({});
    setErr("");
  }

  function finish() {
    if (!base.name.trim() || !base.cdl.trim()) {
      setStep(0);
      setErr("Driver name and CDL number are required.");
      return;
    }
    const out: Record<string, string[]> = {};
    for (const def of WIZ) {
      const headers = data.sections[def.id].headers;
      out[def.id] = cellsFor(def).map((c, i) => {
        const t = def.types[i];
        if (t === "name") return base.name.trim();
        if (t === "state") return base.state.trim();
        if (t === "active") return "Active";
        if (t === "text" && /license/i.test(headers[i])) return base.cdl.trim();
        // A document left blank is not on file yet → Missing
        if (t === "status" && !c.trim()) return "Missing";
        return c;
      });
    }
    addDriver(out);
    toast.success(`${base.name.trim()} added as New Driver (onboarding) — use Move to Active when ready`);
    onOpenChange(false);
    reset();
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
                <input value={base.name} onChange={(e) => setBase({ ...base, name: e.target.value })} className={inputCls} autoFocus />
              </Field>
              <Field label="CDL / Driver License No. *">
                <input value={base.cdl} onChange={(e) => setBase({ ...base, cdl: e.target.value })} className={inputCls} />
              </Field>
              <Field label="State (CA = 10-day DMV alert, others = 20-day)">
                <input value={base.state} onChange={(e) => setBase({ ...base, state: e.target.value.toUpperCase() })} className={inputCls} />
              </Field>
              {err && <p className="rounded-lg bg-danger-soft px-3 py-2 font-semibold text-danger">{err}</p>}
            </>
          )}
          {def &&
            def.types.map((t, i) => {
              const headers = data.sections[def.id].headers;
              if (autoCol(def, i, headers)) return null;
              const v = cellsFor(def)[i];
              return (
                <Field key={i} label={headers[i].trim()}>
                  {t === "status" ? (
                    <div className="flex flex-wrap gap-2">
                      {def.statusOptions.map((o) => (
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
                    <input type="date" value={v} onChange={(e) => setV(def, i, e.target.value)} className={inputCls} />
                  ) : t === "note" || t === "plan" || t === "tempnote" ? (
                    <textarea
                      value={v}
                      onChange={(e) => setV(def, i, e.target.value)}
                      rows={2}
                      className={inputCls}
                      placeholder={t === "tempnote" ? "Add temporary reminder (never highlights)" : t === "plan" ? "Add future plan" : "Add note"}
                    />
                  ) : (
                    <input value={v} onChange={(e) => setV(def, i, e.target.value)} className={inputCls} />
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
                  if (step === 0 && (!base.name.trim() || !base.cdl.trim())) {
                    setErr("Driver name and CDL number are required.");
                    return;
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

const inputCls = "w-full rounded-lg border-2 bg-card px-3 py-2.5 text-base outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
