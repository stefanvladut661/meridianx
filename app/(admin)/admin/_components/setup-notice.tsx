import { Mark } from "@/components/site/mark";

/**
 * Ecranul de configurare lipsă (FAZA 6).
 *
 * Ecranele goale sunt o invitație la acțiune, nu „No data available"
 * (CLAUDE.md §4). Aici omul nu are lead-uri pentru că baza nu e legată —
 * deci îi dăm pașii, în ordine, nu un mesaj de eroare. Numerotarea e
 * legitimă: chiar e o secvență.
 */

const STEPS: Array<{ title: string; body: string; code?: string }> = [
  {
    title: "Creează proiectul Supabase",
    body: "Din consola Supabase, proiect nou, regiunea cea mai apropiată de clienți (Frankfurt).",
  },
  {
    title: "Rulează AMBELE migrări, în ordine",
    body: "Conținutul fișierelor, în SQL Editor. Prima creează tabelele leads și lead_events, enum-urile, indexurile și politicile RLS. A doua adaugă updated_at, triggerul și indexurile de panou — fără ea, panoul nu poate citi lead-urile.",
    code: "supabase/migrations/00000000000001_leads.sql\nsupabase/migrations/00000000000002_lead_activity.sql",
  },
  {
    title: "Completează variabilele de mediu",
    body: "Copiază .env.example în .env.local și pune valorile din Project Settings → API. Cheia de service role NU are prefix NEXT_PUBLIC și nu trebuie să ajungă niciodată în client.",
    code: "NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY",
  },
  {
    title: "Creează contul de admin și trece-l pe listă",
    body: "Authentication → Users → Add user, cu email și parolă. Nu există înregistrare din site: contul se face manual, intenționat. Apoi pune aceeași adresă în ADMIN_EMAILS — proiectele Supabase acceptă înregistrări implicit, iar fără listă orice cont creat pe proiect ar vedea toate lead-urile.",
    code: "ADMIN_EMAILS",
  },
  {
    title: "Pornește emailurile",
    body: "Cheie Resend, domeniu verificat, adresa pe care vin notificările. Fără ele, lead-urile se salvează, dar nu află nimeni de ele.",
    code: "RESEND_API_KEY · RESEND_FROM_EMAIL · LEAD_NOTIFICATION_EMAIL",
  },
];

export function SetupNotice() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 sm:px-8 sm:py-20">
      <div className="flex items-center gap-2.5 text-bone">
        <Mark size={22} />
        <span className="font-md-display text-[14px] font-semibold tracking-[0.2em]">
          MERIDIAN
        </span>
      </div>

      <p className="eyebrow mt-10">Configurare · 5 pași</p>
      <h1 className="display mt-3 text-[2rem] text-bone sm:text-[2.5rem]">
        Panoul e gata. Baza de date, încă nu.
      </h1>
      <p className="mt-4 text-pretty text-[15px] leading-relaxed text-dim">
        Lipsesc variabilele de mediu pentru Supabase, deci nu avem de unde
        citi lead-uri. Cinci pași, o singură dată. La final,
        <code className="mx-1 font-md-mono text-[0.9em] text-bone">/api/health</code>
        îți confirmă că toate sunt legate.
      </p>

      <ol className="mt-10 overflow-hidden rounded-panel-lg border border-hair bg-char">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="grid grid-cols-[2.75rem_1fr] gap-4 border-b border-hair px-5 py-5 last:border-b-0 sm:px-6"
          >
            <span className="font-md-mono text-[11px] tabular-nums leading-6 tracking-[0.18em] text-bone/60">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <h2 className="text-[16px] font-semibold leading-6 tracking-tight text-bone">
                {step.title}
              </h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-dim">
                {step.body}
              </p>
              {step.code ? (
                <p className="mt-3 overflow-x-auto whitespace-pre-line rounded-panel-sm border border-hair bg-glass px-3 py-2 font-md-mono text-[11.5px] leading-relaxed text-bone/85">
                  {step.code}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-8 text-[14px] leading-relaxed text-dim">
        După ce ai completat fișierul, repornește serverul — variabilele de
        mediu se citesc la pornire, nu la fiecare cerere.
      </p>
    </main>
  );
}
