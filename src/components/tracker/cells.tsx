import { useEffect, useRef, useState } from "react";
import { Check, X, Pencil, CalendarDays, ChevronDown, Eye, EyeOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  appliedExpiryView,
  fmtCell,
  normStatus,
  parseISO,
  statusTone,
  type Tone,
} from "@/lib/alerts";
import { useViewMode } from "@/lib/viewmode";

export const TONE_BOX: Record<Tone, string> = {
  danger: "bg-danger-soft border-danger/40 text-danger",
  warn: "bg-warn-soft border-warn/40 text-warn",
  info: "bg-info-soft border-info/40 text-info",
  note: "bg-note-soft border-border text-foreground",
  ok: "bg-ok-soft border-ok/40 text-ok",
  sign: "bg-sign-soft border-sign/40 text-sign",
  muted: "bg-muted border-border text-muted-foreground",
};
export const TONE_SOLID: Record<Tone, string> = {
  danger: "bg-danger text-primary-foreground",
  warn: "bg-warn text-primary-foreground",
  info: "bg-info text-primary-foreground",
  note: "bg-gold text-ink",
  ok: "bg-ok text-primary-foreground",
  sign: "bg-sign text-primary-foreground",
  muted: "bg-muted text-muted-foreground",
};

export function Chip({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-semibold leading-tight", TONE_BOX[tone], className)}>
      <span
        className={cn(
          "tracker-status-dot shrink-0",
          tone === "danger" && "bg-danger",
          tone === "warn" && "bg-warn",
          tone === "info" && "bg-info",
          tone === "note" && "bg-gold",
          tone === "ok" && "bg-ok",
          tone === "sign" && "bg-sign",
          tone === "muted" && "bg-muted-foreground",
        )}
        aria-hidden
      />
      {children}
    </span>
  );
}

function SaveBar({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="mt-2 flex gap-2">
      <button
        type="button"
        onClick={onSave}
        className="inline-flex items-center gap-1 rounded-lg bg-ok px-3 py-1.5 text-sm font-bold text-primary-foreground shadow-card hover:opacity-90"
      >
        <Check className="size-4" /> Save
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-1 rounded-lg border bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" /> Cancel
      </button>
    </div>
  );
}

/** Click to edit any text; save with the tick button (or Ctrl+Enter). */
function asCellText(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

export function EditableText({
  value,
  onSave,
  placeholder = "Click to add",
  className,
  bold,
  boxed,
  tone,
  mask,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
  bold?: boolean;
  boxed?: boolean;
  tone?: Tone;
  mask?: boolean;
}) {
  const safeValue = asCellText(value);
  const view = useViewMode();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(safeValue);
  const [show, setShow] = useState(!mask);
  const ref = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [editing]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const commit = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (v !== safeValue) onSave(v);
  };

  if (editing && !view)
    return (
      <div className="w-full">
        <textarea
          ref={ref}
          data-testid="editable-text"
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onInput={(e) => {
            const el = e.target as HTMLTextAreaElement;
            setDraft(el.value);
            el.style.height = "auto";
            el.style.height = el.scrollHeight + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              commit(draft || ref.current?.value || "");
              setEditing(false);
            }
            if (e.key === "Escape") {
              setDraft(safeValue);
              setEditing(false);
            }
          }}
          rows={2}
          className="w-full resize-none rounded-lg border-2 border-primary bg-card px-2.5 py-1 text-base leading-snug outline-none"
        />
        <SaveBar
          onSave={() => {
            const next = draft || ref.current?.value || "";
            commit(next);
            setEditing(false);
          }}
          onCancel={() => {
            setDraft(safeValue);
            setEditing(false);
          }}
        />
      </div>
    );

  const empty = !safeValue.trim();
  const shown = mask && !show && !empty ? "•••-••-" + safeValue.trim().slice(-4) : safeValue;
  return (
    <div className="group flex w-full items-start gap-1">
      <button
        type="button"
        onClick={() => {
          if (view) return;
          setDraft(safeValue);
          setEditing(true);
        }}
        className={cn(
          "w-full min-w-0 whitespace-pre-wrap break-words text-left text-base leading-snug",
          boxed && "min-h-9 rounded-lg border px-2.5 py-1",
          boxed && (tone ? TONE_BOX[tone] : "border-dashed bg-card hover:border-primary/60"),
          bold && "font-bold",
          empty && "text-muted-foreground/70 italic",
          className,
        )}
      >
        {empty ? placeholder : shown}
      </button>
      {mask && !empty ? (
        <button type="button" onClick={() => setShow(!show)} className="mt-2 text-muted-foreground hover:text-foreground" aria-label="Show or hide">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      ) : !boxed ? (
        <Pencil className="mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
      ) : null}
    </div>
  );
}

export function DateCell({
  value,
  onSave,
  tone,
  /** When paired status is Applied, keep remaining / expired caption under the date. */
  appliedStatus,
}: {
  value: string;
  onSave: (v: string) => void;
  tone?: Tone | undefined;
  /** May be omitted or explicitly undefined when the date column has no paired Applied status. */
  appliedStatus?: string | undefined;
}) {
  const safeValue = asCellText(value);
  const view = useViewMode();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(safeValue);
  const datePickerRef = useRef<HTMLInputElement>(null);
  const dateTextRef = useRef<HTMLInputElement>(null);
  const isDate = !!parseISO(safeValue);
  const applied = normStatus(appliedStatus ?? "") === "Applied";
  const appliedView = applied ? appliedExpiryView(safeValue) : null;
  const change = (v: string) => setDraft(v); // saved only on Save
  if (editing && !view)
    return (
      <div className="w-full space-y-2">
        <input
          ref={datePickerRef}
          data-testid="date-cell-picker"
          type="date"
          value={parseISO(draft) ? draft : ""}
          onChange={(e) => change(e.target.value)}
          onInput={(e) => change((e.target as HTMLInputElement).value)}
          className="w-full rounded-lg border-2 border-primary bg-card px-2.5 py-1 text-base"
        />
        <input
          ref={dateTextRef}
          data-testid="date-cell-text"
          value={draft}
          onChange={(e) => change(e.target.value)}
          onInput={(e) => change((e.target as HTMLInputElement).value)}
          placeholder="…or type text (e.g. New Driver!)"
          className="w-full rounded-lg border bg-card px-2.5 py-1 text-sm"
        />
        <SaveBar
          onSave={() => {
            const next = draft || dateTextRef.current?.value || datePickerRef.current?.value || "";
            onSave(next);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  // Date cell keeps the calendar date; when Applied, show countdown / overdue under it (expiration axis).
  const dateSub =
    appliedView && isDate
      ? appliedView.expiration
        ? `${appliedView.expiration} · ${appliedView.dateHint}`
        : appliedView.dateHint || null
      : null;
  return (
    <button
      type="button"
      disabled={view}
      onClick={() => {
        setDraft(safeValue);
        setEditing(true);
      }}
      className={cn(
        "inline-flex min-h-9 w-full flex-col items-start justify-center gap-0.5 whitespace-pre-wrap break-words rounded-lg border px-2.5 py-1 text-left text-base font-semibold",
        tone ? TONE_BOX[tone] : "bg-card hover:border-primary/60",
        !safeValue.trim() && "border-dashed font-normal italic text-muted-foreground/70",
      )}
    >
      <span className="inline-flex items-center gap-2">
        {isDate && <CalendarDays className="size-4 shrink-0 opacity-70" />}
        {safeValue.trim() ? fmtCell(safeValue) : "Add date"}
      </span>
      {dateSub && <span className="text-xs font-bold leading-tight opacity-95">{dateSub}</span>}
    </button>
  );
}

export function StatusToggle({
  value,
  options,
  onSave,
  /** Paired Exact Expiration cell — Applied keeps remaining days visible (does not change stored value). */
  expiryValue,
}: {
  value: string;
  options: string[];
  onSave: (v: string) => void;
  /** May be omitted or explicitly undefined when the status column has no paired expiry. */
  expiryValue?: string | undefined;
}) {
  const safeOptions = Array.isArray(options) ? options.map(asCellText) : [];
  const safeValue = asCellText(value);
  const view = useViewMode();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const customRef = useRef<HTMLInputElement>(null);
  const applied = normStatus(safeValue) === "Applied";
  const appliedView = applied && expiryValue != null ? appliedExpiryView(asCellText(expiryValue)) : null;
  const tone = appliedView?.tone ?? statusTone(safeValue);
  // Application axis stays the stored value (Applied). Never auto-rewrite to Valid/Renewed.
  // When past expiry, show "Expired + Applied" so both axes remain visible together.
  const primary =
    applied && appliedView?.expiration === "Expired"
      ? "Expired + Applied"
      : safeValue.trim() || (view ? "—" : "Select");
  // Expiration axis + countdown under Application (display only — onSave still writes the dropdown value).
  const hint = applied && appliedView ? appliedView.hint : null;
  if (view)
    return (
      <div className={cn("inline-flex min-h-9 w-full flex-col items-start justify-center rounded-lg px-2.5 py-1 text-base font-bold", TONE_SOLID[tone])}>
        <span className="whitespace-pre-wrap break-words">{primary}</span>
        {hint && <span className="text-xs font-bold leading-tight opacity-95">{hint}</span>}
      </div>
    );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1 text-left text-base font-bold shadow-card transition hover:brightness-105",
            TONE_SOLID[tone],
          )}
        >
          <span className="flex min-w-0 flex-col items-start gap-0.5">
            <span className="whitespace-pre-wrap break-words">{primary}</span>
            {hint && <span className="text-xs font-bold leading-tight opacity-95">{hint}</span>}
          </span>
          <ChevronDown className="size-4 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="grid grid-cols-2 gap-2">
          {safeOptions.map((o) => {
            const t = statusTone(o);
            const active = normStatus(safeValue) === o;
            return (
              <button
                key={o}
                type="button"
                onClick={() => {
                  onSave(o);
                  setOpen(false);
                }}
                className={cn(
                  "rounded-lg border-2 px-2 py-2 text-sm font-bold transition",
                  TONE_BOX[t],
                  active ? "ring-2 ring-offset-1 ring-primary" : "hover:scale-[1.03]",
                )}
              >
                {o}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            ref={customRef}
            data-testid="status-custom"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onInput={(e) => setCustom((e.target as HTMLInputElement).value)}
            placeholder="Custom…"
            className="min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={!(custom.trim() || customRef.current?.value?.trim())}
            onClick={() => {
              const next = (custom.trim() || customRef.current?.value || "").trim();
              if (!next) return;
              onSave(next);
              setCustom("");
              setOpen(false);
            }}
            className="rounded-lg bg-ok px-2 text-primary-foreground disabled:opacity-40"
            aria-label="Save custom status"
          >
            <Check className="size-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            onSave("");
            setOpen(false);
          }}
          className="mt-2 w-full text-xs text-muted-foreground hover:underline"
        >
          Clear
        </button>
      </PopoverContent>
    </Popover>
  );
}

const EMPLOYMENT_OPTS = ["Active", "Leave", "Inactive"] as const;
const BINARY_OPTS = ["Active", "Inactive"] as const;

const EMPLOYMENT_ON: Record<(typeof EMPLOYMENT_OPTS)[number], string> = {
  Active: "bg-ok text-primary-foreground shadow-card",
  Leave: "bg-warn text-primary-foreground shadow-card",
  Inactive: "bg-muted text-muted-foreground shadow-card border border-border",
};

/**
 * Employment status selector.
 * Driver sections: Active (green) / Leave (amber) / Inactive (gray).
 * Records (binary): Active / Inactive only.
 * Empty value counts as Active (backward compatible).
 */
export function ActiveToggle({
  value,
  onSave,
  mode = "employment",
}: {
  value: string;
  onSave: (v: string) => void;
  mode?: "employment" | "binary";
}) {
  const view = useViewMode();
  const opts = mode === "binary" ? BINARY_OPTS : EMPLOYMENT_OPTS;
  const cur = (() => {
    const k = asCellText(value).trim().toLowerCase();
    if (k === "inactive") return "Inactive";
    if (mode === "employment" && (k === "leave" || k === "on leave")) return "Leave";
    return "Active";
  })();
  return (
    <div className="inline-flex flex-wrap rounded-lg border bg-card p-1">
      {opts.map((o) => {
        const on = cur === o;
        const onCls =
          mode === "binary"
            ? o === "Active"
              ? "bg-eagle text-primary-foreground shadow-card"
              : "bg-ink text-ink-foreground shadow-card"
            : EMPLOYMENT_ON[o as (typeof EMPLOYMENT_OPTS)[number]];
        return (
          <button
            key={o}
            type="button"
            disabled={view}
            onClick={() => {
              if (on) return; // already selected — avoid no-op writes
              onSave(o);
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55",
              on ? onCls : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
