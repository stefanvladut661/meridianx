"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type LoginState } from "../login/actions";
import { FIELD } from "./tone";

/**
 * Formularul de autentificare (FAZA 6).
 * Doar un input și un buton, în gramatica site-ului (`.btn`, câmpuri cu
 * hairline). Focus vizibil vine din `:focus-visible` global.
 */

const initialState: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn btn-light mt-7 w-full !text-[14px] disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? "Se verifică…" : "Intră în panou"}
      {!pending ? (
        <span className="arw" aria-hidden>
          →
        </span>
      ) : null}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="mt-8" noValidate>
      <div>
        <label htmlFor="admin-email" className="eyebrow">
          Email
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className={`${FIELD} mt-2 h-11`}
        />
      </div>

      <div className="mt-4">
        <label htmlFor="admin-password" className="eyebrow">
          Parolă
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={`${FIELD} mt-2 h-11`}
        />
      </div>

      {/* aria-live: eroarea apare fără reîncărcare, deci trebuie anunțată. */}
      <div aria-live="polite">
        {state.error ? (
          <p className="mt-4 border-l-2 border-bone/60 py-1 pl-3 text-[14px] leading-relaxed text-bone">
            {state.error}
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}
