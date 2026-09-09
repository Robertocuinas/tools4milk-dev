import type { InputHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function Input({ id, label, error, hint, className = "", ...props }: InputProps) {
  const inputId = id ?? `input-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const describedBy = [hint && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-semibold text-app-text">
        {label}{props.required && <span aria-hidden="true" className="ml-1 text-state-critica">*</span>}
      </label>
      <input
        {...props}
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={`min-h-11 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text placeholder:text-app-dim/70 focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${error ? "border-state-critica" : ""} ${className}`}
      />
      {hint && !error && <p id={`${inputId}-hint`} className="text-xs text-app-dim">{hint}</p>}
      {error && <p id={`${inputId}-error`} role="alert" className="text-xs font-semibold text-state-critica">{error}</p>}
    </div>
  );
}
