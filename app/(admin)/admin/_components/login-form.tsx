"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type LoginState } from "../login/actions";

/**
 * Formularul de autentificare (FAZA 6).
 * Nu folosește primitivele din `components/ui/` pentru câmpuri complexe —
 * are nevoie doar de un input și un buton, iar zona de admin e o unealtă,
 * nu o pagină de marketing. Focus vizibil vine din `:focus-visible` global.
 */

const initialState: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-s-signal px-5 font-body font-semibold text-s-ink transition-colors duration-150 hover:bg-[#6b93ff] disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? "Se verifică…" : "Intră în panou"}
    </button>
  );
}

const fieldClasses =
  "mt-1.5 block h-11 w-full rounded-md border border-line bg-bg px-3 text-fg " +
  "placeholder:text-muted focus:border-accent focus:outline-none";

export function LoginForm() {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="mt-8" noValidate>
      <div>
        <label
          htmlFor="admin-email"
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted"
        >
          Email
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className={fieldClasses}
        />
      </div>

      <div className="mt-4">
        <label
          htmlFor="admin-password"
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted"
        >
          Parolă
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={fieldClasses}
        />
      </div>

      {/* aria-live: eroarea apare fără reîncărcare, deci trebuie anunțată. */}
      <div aria-live="polite">
        {state.error ? (
          <p className="mt-4 border-l-2 border-accent-2 py-1 pl-3 text-sm leading-relaxed text-fg">
            {state.error}
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}
