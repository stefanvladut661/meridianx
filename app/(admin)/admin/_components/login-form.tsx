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
      className="btn btn-light mt-7 w-full !min-h-12 !text-[15.5px] disabled:pointer-events-none disabled:opacity-60"
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
        <label htmlFor="admin-email" className="eyebrow !text-[11.5px]">
          Email
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className={`${FIELD} mt-2 h-12`}
        />
      </div>

      <div className="mt-4">
        <label htmlFor="admin-password" className="eyebrow !text-[11.5px]">
          Parolă
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={`${FIELD} mt-2 h-12`}
        />
      </div>

      {/* aria-live: eroarea apare fără reîncărcare, deci trebuie anunțată. */}
      <div aria-live="polite">
        {state.error ? (
          <p className="mt-4 rounded-panel-sm border-l-[3px] border-[#ef4444] bg-[#ef4444]/10 px-3.5 py-2.5 text-[14.5px] leading-relaxed text-bone">
            {state.error}
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}
