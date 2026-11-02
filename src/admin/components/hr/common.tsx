import { useEffect, useState } from "react";
import { fmtTime, parseTime } from "@/admin/lib/calc";

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Paste-friendly time box. Accepts "5:59 AM", "05:59:12", "17:02". */
export function TimeInput({ value, onChange, label, disabled }: { value: number | null; onChange: (v: number | null) => void; label: string; disabled?: boolean }) {
  const [txt, setTxt] = useState(fmtTime(value));
  const [bad, setBad] = useState(false);
  useEffect(() => setTxt(fmtTime(value)), [value]);
  const commit = (s: string) => {
    if (!s.trim()) {
      setBad(false);
      onChange(null);
      return;
    }
    const v = parseTime(s);
    setBad(v == null);
    if (v != null) {
      onChange(v);
      setTxt(fmtTime(v));
    }
  };
  return (
    <label className="block">
      <span className="lbl">{label}</span>
      <input
        className={`field ${bad ? "border-destructive" : ""}`}
        placeholder={disabled ? "No break" : "e.g. 5:59 AM"}
        value={disabled ? "" : txt}
        disabled={disabled}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onPaste={(e) => {
          e.preventDefault();
          const t = e.clipboardData.getData("text");
          setTxt(t);
          commit(t);
        }}
      />
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
      <input type="checkbox" className="h-4 w-4 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Tone({ tone, children }: { tone?: "red" | "green" | "blue" | undefined; children: React.ReactNode }) {
  const cls = tone === "red" ? "text-destructive font-semibold" : tone === "green" ? "text-success font-semibold" : tone === "blue" ? "text-info font-semibold" : "";
  return <span className={cls}>{children}</span>;
}

export function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
