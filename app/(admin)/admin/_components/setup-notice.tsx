/**
 * Ecranul de configurare lipsă (FAZA 6).
 *
 * Ecranele goale sunt o invitație la acțiune, nu „No data available"
 * (CLAUDE.md §4). Aici omul nu are lead-uri pentru că baza nu e legată —
 * deci îi dăm pașii, în ordine, nu un mesaj de eroare.
 */

const STEPS: Array<{ title: string; body: string; code?: string }> = [
  {
    title: "Creează proiectul Supabase",
    body: "Din consola Supabase, proiect nou, regiunea cea mai apropiată de clienți (Frankfurt).",
  },
  {
    title: "Rulează migrarea",
    body: "Conținutul fișierului de migrare, în SQL Editor. Creează tabelele leads și lead_events, enum-urile, indexurile și politicile RLS.",
    code: "supabase/migrations/00000000000001_leads.sql",
  },
  {
    title: "Completează variabilele de mediu",
    body: "Copiază .env.example în .env.local și pune valorile din Project Settings → API. Cheia de service role NU are prefix NEXT_PUBLIC și nu trebuie să ajungă niciodată în client.",
    code: "NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY",
  },
  {
    title: "Creează contul de admin",
    body: "Authentication → Users → Add user, cu email și parolă. Nu există înregistrare din site: contul se face manual, intenționat.",
  },
  {
    title: "Pornește emailurile",
    body: "Cheie Resend, domeniu verificat, adresa pe care vin notificările. Fără ele, lead-urile se salvează, dar nu află nimeni de ele.",
    code: "RESEND_API_KEY · RESEND_FROM_EMAIL · LEAD_NOTIFICATION_EMAIL",
  },
];

export function SetupNotice() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent-2">
        Configurare
      </p>
      <h1 className="mt-3 text-balance font-display text-2xl font-semibold tracking-tight">
        Panoul e gata. Baza de date, încă nu.
      </h1>
      <p className="mt-3 text-pretty leading-relaxed text-fg/75">
        Lipsesc variabilele de mediu pentru Supabase, deci nu avem de unde
        citi lead-uri. Cinci pași, o singură dată:
      </p>

      <ol className="mt-10 border-t border-line">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="grid grid-cols-[2.5rem_1fr] gap-4 border-b border-line py-5"
          >
            <span className="font-mono text-[11px] tabular-nums tracking-[0.18em] text-accent">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight">
                {step.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-fg/70">
                {step.body}
              </p>
              {step.code ? (
                <p className="mt-2 overflow-x-auto rounded-xs bg-surface px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-accent-2">
                  {step.code}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-8 text-sm leading-relaxed text-muted">
        După ce ai completat fișierul, repornește serverul — variabilele de
        mediu se citesc la pornire, nu la fiecare cerere.
      </p>
    </main>
  );
}
