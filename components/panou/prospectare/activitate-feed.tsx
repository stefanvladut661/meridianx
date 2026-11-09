import Link from "next/link";
import { ArrowRightLeft, Bot, CalendarClock, CircleSlash, ClipboardCheck, Cpu, Lock, LockOpen, Mail, MailX, MessageCircle, Phone, Reply, Search, StickyNote, type LucideIcon } from "lucide-react";
import { dateTimeRo, relativeRo } from "@/components/panou/ui/format";
import type { ActivitateCuFirma } from "@/lib/prospectare/citire";
import { CANALE, ETAPE, isCanal, isEtapa, REZULTATE } from "@/lib/prospectare/labels";
import type { Canal, Rezultat } from "@/lib/prospectare/types";
import { linkFirma } from "./prezentare-comun";

/**
 * Activitatea recentă, ca `ActivityFeed` din prototip (linie de timp cu
 * iconițe), pentru toate firmele: fiecare rând începe cu firma (link spre
 * fișa ei) și spune pe românește ce s-a întâmplat, din `tip` + `detalii`
 * scrise de funcțiile din bază.
 */

const TIPURI: Record<string, { icon: LucideIcon; label: string }> = {
  creata: { icon: Search, label: "Cercetare" },
  site: { icon: Bot, label: "Robot" },
  rezervare: { icon: Cpu, label: "Robot" },
  email: { icon: Mail, label: "Email" },
  bounce: { icon: MailX, label: "Email" },
  raspuns: { icon: Reply, label: "Email" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp" },
  apel: { icon: Phone, label: "Apel" },
  nota: { icon: StickyNote, label: "Notă" },
  canal: { icon: Lock, label: "Canal" },
  recontactare: { icon: LockOpen, label: "Recontactare" },
  programare: { icon: CalendarClock, label: "Programare" },
  evaluare: { icon: ClipboardCheck, label: "Evaluare" },
  import: { icon: ArrowRightLeft, label: "Listă" },
  etapa: { icon: CircleSlash, label: "Etapă" },
};

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const numar = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
const etapa = (v: unknown): string => (isEtapa(v) ? ETAPE[v].label : (text(v) ?? "—"));
const canal = (v: unknown): string | null => (isCanal(v) ? CANALE[v].label : text(v));
const citat = (v: string | null): string | null => (v ? `„${v}”` : null);
const ora = (v: unknown): string | null => {
  const t = text(v);
  return t && !Number.isNaN(new Date(t).getTime()) ? dateTimeRo(t) : null;
};

const RASPUNS: Record<string, string> = { pozitiv: "pozitiv", nu: "„NU”", automat: "automat", altul: "de citit" };

/** `canale_folosite` de la o recontactare: „email și WhatsApp”. */
const canaleFolosite = (v: unknown): string | null => {
  const lista = Array.isArray(v) ? v.filter(isCanal).map((c) => (c === "email" ? "email" : c === "whatsapp" ? "WhatsApp" : "telefon")) : [];
  return lista.length ? lista.join(" și ") : null;
};

/** Datele canalelor cu care a venit firma din import (`email_la`, `whatsapp_la`, `telefon_la`). */
const CANALE_LA: { cheie: string; canal: Canal }[] = [
  { cheie: "email_la", canal: "email" },
  { cheie: "whatsapp_la", canal: "whatsapp" },
  { cheie: "telefon_la", canal: "telefon" },
];

/** Ce s-a întâmplat (rândul principal) și, dacă are, amănuntul (motiv, notă, extras). */
export function descrieActivitate(a: Pick<ActivitateCuFirma, "tip" | "detalii">): { ce: string; amanunt: string | null } {
  const d = a.detalii ?? {};
  switch (a.tip) {
    case "etapa":
      return { ce: `Etapă: ${etapa(d.din)} → ${etapa(d.in)}`, amanunt: text(d.motiv) };
    case "canal": {
      // Din migrarea 33: `{ in, la, cont?, motiv? }` când se folosește un canal, `{ din: "telefon", motiv }` când se golește telefonul.
      // Rândurile vechi au `{ din?, in? }`, fără `la`: canalul era doar setat, nu folosit.
      const nou = text(d.in);
      const vechi = text(d.din);
      const motiv = text(d.motiv);
      if (nou === "telefon") return { ce: "Intrată pe telefon", amanunt: motiv };
      if (nou) {
        const cont = numar(d.cont);
        if (!text(d.la)) return { ce: `Canal setat: ${canal(nou)}`, amanunt: motiv };
        return { ce: `Canal folosit: ${canal(nou)}${nou === "whatsapp" && cont ? ` (contul ${cont})` : ""}`, amanunt: motiv };
      }
      if (!vechi || vechi === "telefon") return { ce: "Ieșită din apeluri: înapoi în distribuție", amanunt: motiv };
      if (vechi === "whatsapp") return { ce: "WhatsApp anulat", amanunt: motiv };
      return { ce: `Canal scos: ${canal(vechi)}`, amanunt: motiv };
    }
    case "apel": {
      const rezultat = d.rezultat;
      const r = typeof rezultat === "string" && rezultat in REZULTATE ? REZULTATE[rezultat as Rezultat].label : (text(rezultat) ?? "fără rezultat");
      const incercari = numar(d.incercari);
      const limita = numar(d.limita);
      const contor = d.rezultat === "nu_raspunde" && incercari && limita ? ` (${incercari}/${limita})` : "";
      const inapoi = ora(d.suna_inapoi_la);
      const amanunt = [
        d.revenit_in_rezerva === true ? "Ieșită din listă, înapoi în rezerva de apeluri." : null,
        d.revenit_in_distributie === true ? (d.doar_email === true ? "Înapoi în distribuție, doar pentru email." : "Înapoi în distribuție.") : null,
        inapoi ? `Sună înapoi: ${inapoi}` : null,
        citat(text(d.nota)),
      ]
        .filter(Boolean)
        .join(" · ");
      return { ce: `Apel: ${r}${contor}`, amanunt: amanunt || null };
    }
    case "email": {
      const casuta = text(d.casuta);
      return { ce: casuta ? `Email trimis din ${casuta}` : "Email trimis", amanunt: text(d.subiect) };
    }
    case "bounce": {
      const casuta = text(d.casuta);
      return { ce: casuta ? `Email întors (bounce) la ${casuta}` : "Email întors (bounce)", amanunt: text(d.motiv) };
    }
    case "raspuns": {
      const fel = d.tip;
      const tip = typeof fel === "string" ? (RASPUNS[fel] ?? fel) : "de citit";
      return { ce: `Răspuns la email: ${tip}`, amanunt: citat(text(d.extras)) };
    }
    case "whatsapp": {
      // Excepția acceptată: după un apel „Interesat”, firma rămâne pe Telefon.
      if (d.continuare_apel === true) return { ce: "Continuare apel pe WhatsApp", amanunt: "După „Interesat”; rămâne pe telefon." };
      if (d.anulat === true) return { ce: "WhatsApp anulat imediat după trimitere", amanunt: "Firma e din nou în lista zilei." };
      // „Cont 2” din migrarea 34; rândurile vechi au doar numărul contului.
      const cont = text(d.cont_nume) ?? (numar(d.cont) ? `contul ${numar(d.cont)}` : null);
      return { ce: cont ? `WhatsApp trimis de pe ${cont}` : "WhatsApp trimis", amanunt: null };
    }
    case "site":
      return { ce: "Site demo gata", amanunt: null };
    case "rezervare": {
      const lucru = d.tip_lucru === "refacere" ? "refacere" : "construire";
      const pana = ora(d.expira_la);
      return {
        ce: `Luată în lucru de robot (${lucru})`,
        amanunt: [pana ? `Rezervată până la ${pana}` : null, d.preluata_de_la ? "preluată de la alt robot" : null].filter(Boolean).join(" · ") || null,
      };
    }
    case "nota":
      return { ce: text(d.text) ?? "Notă actualizată", amanunt: null };
    case "recontactare": {
      // Din migrarea 34: un admin permite al doilea canal din fișă, cu motiv. Cine, apare la autor.
      const folosite = canaleFolosite(d.canale_folosite);
      const amanunt = [citat(text(d.motiv)), folosite ? `A primit deja ${folosite}.` : null].filter(Boolean).join(" · ");
      return { ce: `Recontactare permisă: ${canal(d.canal) ?? "alt canal"}`, amanunt: amanunt || null };
    }
    case "programare": {
      const zi = text(d.zi);
      const pe = zi ? ` pentru ${zi.slice(8, 10)}.${zi.slice(5, 7)}` : "";
      const cn = canal(d.canal) ?? "un canal";
      if (d.anulata === true) return { ce: `Programare anulată: ${cn}${pe}`, amanunt: "Firma s-a întors în rezervă." };
      return { ce: `Programată pe ${cn}${pe}`, amanunt: [text(d.sursa) === "manual" ? "Manual" : "Automat", text(d.casuta), d.zi_ceruta ? "ziua cerută era plină" : null].filter(Boolean).join(" · ") || cn };
    }
    case "evaluare": {
      const scor = numar(d.scor);
      const fel = d.evaluare === "eligibila" ? "eligibilă" : d.evaluare === "respinsa" ? "respinsă" : (text(d.evaluare) ?? "fără verdict");
      const nisa = text(d.nisa);
      const amanunt = [text(d.motiv), nisa ? `Nișa: ${nisa}` : null].filter(Boolean).join(" · ");
      return { ce: `Evaluată: ${fel}${scor !== null ? `, scor ${scor}` : ""}`, amanunt: amanunt || null };
    }
    case "creata": {
      const start = d.etapa;
      // Doar numele canalelor: datele lor sunt în fișa firmei, aici rândul rămâne scurt.
      const folosite = CANALE_LA.filter((c) => text(d[c.cheie])).map((c) => CANALE[c.canal].label);
      // Modelul vechi (până la migrarea 33) avea un singur câmp `canal`.
      const vechi = canal(d.canal);
      const amanunt = [
        isEtapa(start) ? `Etapa de start: ${ETAPE[start].label}` : null,
        folosite.length ? `Canale deja folosite: ${folosite.join(", ")}` : vechi ? `Canal: ${vechi}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return { ce: "Firmă adăugată în prospectare", amanunt: amanunt || null };
    }
    default: {
      const tip = a.tip ? a.tip.charAt(0).toUpperCase() + a.tip.slice(1).replace(/_/g, " ") : "Activitate";
      return { ce: tip, amanunt: text(d.text) ?? text(d.mesaj) ?? text(d.detalii) };
    }
  }
}

export function ActivitateFeed({
  activitate,
  acum,
  gol = "Nicio activitate încă.",
}: {
  activitate: ActivitateCuFirma[];
  /** Ora citirii (de pe server), ca „acum 5 min” să fie același la randare și la hidratare. */
  acum: number;
  gol?: string;
}) {
  if (!activitate.length) {
    return <p className="py-4 text-[14px] text-muted-foreground">{gol}</p>;
  }

  return (
    <ol className="space-y-0">
      {activitate.map((a, i) => {
        const meta = TIPURI[a.tip] ?? TIPURI.etapa;
        const Icon = meta.icon;
        const { ce, amanunt } = descrieActivitate(a);
        return (
          <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < activitate.length - 1 ? <span className="absolute left-[13px] top-7 h-full w-px bg-border" aria-hidden="true" /> : null}
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card" title={meta.label}>
              <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="break-words text-[14px] leading-snug">
                <Link href={linkFirma(a.firma.id)} className="rounded-sm font-medium underline-offset-2 hover:underline">
                  <span className="pu-num text-muted-foreground">#{a.firma.nr}</span> {a.firma.nume}
                </Link>
                <span className="text-foreground/80"> — {ce}</span>
              </p>
              {amanunt ? <p className="mt-0.5 line-clamp-2 break-words text-[13px] leading-relaxed text-muted-foreground">{amanunt}</p> : null}
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted-foreground">
                <span className="font-medium text-foreground/70">{a.autor}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={a.la} title={dateTimeRo(a.la)}>
                  {relativeRo(a.la, acum)}
                </time>
                {/* La „canal” și „recontactare”, ce s-a întâmplat spune deja canalul. */}
                {a.canal && a.tip !== "canal" && a.tip !== "recontactare" ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{CANALE[a.canal]?.label ?? a.canal}</span>
                  </>
                ) : null}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
