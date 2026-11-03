import { useEffect, useRef, useState } from "react";
import { Check, X, Pencil, CalendarDays, ChevronDown, Eye, EyeOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fmtCell, normStatus, parseISO, statusTone, type Tone } from "@/lib/alerts";
import { useViewMode } from "@/lib/viewmode";

export const TONE_BOX: Record<Tone, string> = {
  danger: "bg-danger-soft border-danger text-danger",
  warn: "bg-warn-soft border-danger text-warn",
  info: "bg-info-soft border-danger text-info",
  note: "bg-note-soft border-danger text-foreground",
  ok: "bg-ok-soft border-ok/40 text-ok",
  sign: "bg-sign-soft border-danger text-sign",
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
  const view = useViewMode();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
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
    if (v !== value) onSave(v);
  };

  if (editing && !view)
    return (
      <div className="w-full">
        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              commit(draft);
              setEditing(false);
            }
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          rows={2}
          className="w-full resize-none rounded-lg border-2 border-primary bg-card px-2.5 py-1 text-base leading-snug outline-none"
        />
        <SaveBar
          onSave={() => {
            commit(draft);
            setEditing(false);
          }}
          onCancel={() => {
            setDraft(value);
            setEditing(false);
          }}
        />
      </div>
    );

  const empty = !value.trim();
  const shown = mask && !show && !empty ? "•••-••-" + value.trim().slice(-4) : value;
  return (
    <div className="group flex w-full items-start gap-1">
      <button
        type="button"
        onClick={() => {
          if (view) return;
          setDraft(value);
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

export function DateCell({ value, onSave, tone }: { value: string; onSave: (v: string) => void; tone?: Tone }) {
  const view = useViewMode();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const isDate = !!parseISO(value);
  const change = (v: string) => setDraft(v); // saved only on Save
  if (editing && !view)
    return (
      <div className="w-full space-y-2">
        <input
          type="date"
          value={parseISO(draft) ? draft : ""}
          onChange={(e) => change(e.target.value)}
          className="w-full rounded-lg border-2 border-primary bg-card px-2.5 py-1 text-base"
        />
        <input
          value={draft}
          onChange={(e) => change(e.target.value)}
          placeholder="…or type text (e.g. New Driver!)"
          className="w-full rounded-lg border bg-card px-2.5 py-1 text-sm"
        />
        <SaveBar
          onSave={() => {
            onSave(draft);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  return (
    <button
      type="button"
      disabled={view}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={cn(
        "inline-flex min-h-9 w-full items-center gap-2 whitespace-pre-wrap break-words rounded-lg border px-2.5 py-1 text-left text-base font-semibold",
        tone ? TONE_BOX[tone] : "bg-card hover:border-primary/60",
        !value.trim() && "border-dashed font-normal italic text-muted-foreground/70",
      )}
    >
      {isDate && <CalendarDays className="size-4 shrink-0 opacity-70" />}
      {value.trim() ? fmtCell(value) : "Add date"}
    </button>
  );
}

export function StatusToggle({
  value,
  options,
  onSave,
}: {
  value: string;
  options: string[];
  onSave: (v: string) => void;
}) {
  const view = useViewMode();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const tone = statusTone(value);
  if (view)
    return (
      <div className={cn("inline-flex min-h-9 w-full items-center rounded-lg px-2.5 py-1 text-base font-bold", TONE_SOLID[tone])}>
        <span className="whitespace-pre-wrap break-words">{value.trim() || "—"}</span>
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
          <span className="whitespace-pre-wrap break-words">{value.trim() || "Select"}</span>
          <ChevronDown className="size-4 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="grid grid-cols-2 gap-2">
          {options.map((o) => {
            const t = statusTone(o);
            const active = normStatus(value) === o;
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
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Custom…"
            className="min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={!custom.trim()}
            onClick={() => {
              onSave(custom.trim());
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
    const k = value.trim().toLowerCase();
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
              "rounded-md px-3 py-1.5 text-sm font-bold transition",
              on ? onCls : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
