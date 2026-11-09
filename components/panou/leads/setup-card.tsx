import { WifiOff } from "lucide-react";
import { Card } from "../ui/primitives";

/**
 * Ecranul „Nu e configurat” din prototip („Baza de date nu e configurată”), cu pașii reali de
 * instalare ai panoului. Ecranele goale sunt o invitație la acțiune: aici omul nu are lead-uri
 * pentru că baza nu e legată, deci primește pașii, în ordine. Numerotarea e legitimă: chiar e
 * o secvență. Se arată doar nume de variabile și dacă sunt setate, niciodată valori.
 */

const STEPS: { title: string; body: string; code?: string }[] = [
  {
    title: "Creează proiectul Supabase",
    body: "Regiunea Frankfurt.",
  },
  {
    title: "Rulează ambele migrări, în ordine",
    body: "În SQL Editor. Fără a doua, panoul nu citește lead-urile.",
    code: "supabase/migrations/00000000000001_leads.sql\nsupabase/migrations/00000000000002_lead_activity.sql",
  },
  {
    title: "Completează variabilele de mediu",
    body: ".env.example → .env.local, cu valorile din Project Settings → API. Cheia service role: fără NEXT_PUBLIC, niciodată în client.",
    code: "NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY",
  },
  {
    title: "Pornește intrarea cu Google",
    body: "Supabase → Authentication → Providers → Google (client OAuth Web) și /admin/auth/callback la Redirect URLs. Pune-ți adresa în ADMIN_EMAILS: fără listă, orice cont Google vede lead-urile.",
    code: "ADMIN_EMAILS · /admin/auth/callback",
  },
  {
    title: "Pornește emailurile",
    body: "Cheie Resend, domeniu verificat, adresa notificărilor. Fără ele, nu află nimeni de lead-uri.",
    code: "RESEND_API_KEY · RESEND_FROM_EMAIL · LEAD_NOTIFICATION_EMAIL",
  },
];

/** Variabilele pe care le arată cardul, cu starea lor (doar „setat” / „lipsește”). */
function envStatus(): { name: string; set: boolean }[] {
  return [
    { name: "NEXT_PUBLIC_SUPABASE_URL", set: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
    { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", set: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) },
    { name: "SUPABASE_SERVICE_ROLE_KEY", set: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
    { name: "RESEND_API_KEY", set: Boolean(process.env.RESEND_API_KEY) },
  ];
}

export function LeadsSetupCard() {
  return (
    <Card className="mx-auto max-w-xl">
      <div className="flex flex-col items-center py-6 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-apricot/25 bg-apricot/10">
          <WifiOff className="h-5 w-5 text-apricot" aria-hidden="true" />
        </div>
        <h1 className="text-[19px] font-semibold">Baza de date nu e configurată</h1>
        <div className="mt-4 w-full max-w-sm rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-left font-mono text-[13px] text-muted-foreground">
          {envStatus().map((variable) => (
            <p key={variable.name} className="break-all">
              {variable.name} — <span className={variable.set ? "text-mint" : "text-apricot"}>{variable.set ? "setat" : "lipsește"}</span>
            </p>
          ))}
        </div>
      </div>

      <ol className="mt-1 divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.07]">
        {STEPS.map((step, index) => (
          <li key={step.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 px-4 py-4">
            <span className="pu-num pt-0.5 text-[12.5px] tracking-[0.18em] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold">{step.title}</h2>
              <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{step.body}</p>
              {step.code ? (
                <p className="mt-2 overflow-x-auto whitespace-pre-line rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-[12.5px] leading-relaxed text-foreground/85">{step.code}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-[13.5px] leading-relaxed text-muted-foreground">
        Apoi repornește serverul și verifică la <code className="font-mono text-foreground">/api/health</code>.
      </p>
    </Card>
  );
}

/** Aceeași card, singur pe pagină: pentru layout, când nici autentificarea nu e configurată și cadrul panoului nu se poate încărca. */
export function LeadsSetupScreen() {
  return (
    <div className="panou-ui min-h-screen bg-background px-4 py-12 text-foreground sm:py-20">
      <main>
        <LeadsSetupCard />
      </main>
    </div>
  );
}
