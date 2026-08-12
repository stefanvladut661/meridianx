import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

/**
 * FIȘIER ÎNGHEȚAT după FAZA 0 — cereri de modificare în PLAN.md.
 *
 * Leagă label, control, hint și eroare cu id-uri corecte pentru
 * cititoare de ecran. Controlul primește id/aria prin render prop:
 *
 * <Field label="Email" error={errors.email} required>
 *   {(props) => <Input type="email" {...props} />}
 * </Field>
 */

export interface FieldControlProps {
  id: string;
  "aria-describedby": string | undefined;
  invalid: boolean;
  required: boolean | undefined;
}

export interface FieldProps {
  label: string;
  children: (props: FieldControlProps) => ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}

export function Field({
  label,
  children,
  error,
  hint,
  required,
  className,
}: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-accent">
            *
          </span>
        ) : null}
      </Label>
      {children({
        id,
        "aria-describedby": describedBy,
        invalid: Boolean(error),
        required,
      })}
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
