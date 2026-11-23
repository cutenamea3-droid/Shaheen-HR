import { useState, type Ref } from "react";
import { Eye, EyeOff } from "lucide-react";

const asText = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : String(v));

type Props = {
  id: string;
  name?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  testId?: string;
  className?: string;
  autoFocus?: boolean;
  required?: boolean;
};

/** Shared email-portal password input with show/hide toggle. */
export function PasswordField({
  id,
  name = "password",
  label = "Password",
  value,
  onChange,
  inputRef,
  testId,
  className = "mt-1 h-11 w-full rounded-xl border bg-card px-3 pr-11 text-foreground focus:outline-none focus:ring-2 focus:ring-primary",
  autoFocus,
  required = true,
}: Props) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="mt-4 block text-sm font-bold text-foreground" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          data-testid={testId}
          type={show ? "text" : "password"}
          autoComplete="current-password"
          required={required}
          ref={inputRef}
          value={asText(value)}
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
          onInput={(event) => onChange((event.target as HTMLInputElement).value)}
          className={className}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
          aria-label={show ? "Hide password" : "Show password"}
          onClick={() => setShow((v) => !v)}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}
