/**
 * Intrarea în panou (FAZA 6; doar cu Google din 2026-10-20).
 *
 * Un singur buton, link simplu spre `/admin/auth/google`: merge și
 * înainte de hidratare, iar CSP-ul (`form-action 'self'`) n-are ce opri.
 * Eroarea vine de la rutele de autentificare, prin `?eroare=`.
 */
export function LoginForm({ error }: { error: string | null }) {
  return (
    <div className="mt-8">
      {error ? (
        <p
          role="alert"
          className="mb-5 rounded-panel-sm border-l-[3px] border-[#ef4444] bg-[#ef4444]/10 px-3.5 py-2.5 text-[14.5px] leading-relaxed text-bone"
        >
          {error}
        </p>
      ) : null}

      {/* <a>, nu <Link>: ținta e o rută care redirecționează spre Google, nu
          o pagină. Link ar preîncărca-o (adică ar porni singur o intrare) și
          ar cere-o prin fetch, pe care redirecționarea externă îl rupe. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/admin/auth/google" className="btn btn-light w-full !min-h-12 !text-[15.5px]">
        <GoogleMark />
        Continuă cu Google
      </a>
    </div>
  );
}

/** „G”-ul Google, în culorile din ghidul lor pentru butonul de intrare. */
function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" width="18" height="18" className="shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
