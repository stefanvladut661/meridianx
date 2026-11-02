import { ArrowRightLeft, Bot, CircleSlash, ClipboardCheck, Lock, LockOpen, Mail, MailX, MessageCircle, Phone, Reply, Search, StickyNote, type LucideIcon } from "lucide-react";
import { dateTimeRo, relativeRo } from "@/components/panou/ui/format";
import { CANALE, ETAPE, REZULTATE, isCanal, isEtapa } from "@/lib/prospectare/labels";
import { REZULTATE_IDS, type Activitate, type Canal, type Rezultat } from "@/lib/prospectare/types";
import { faraProtocol, linkWeb } from "./firme-format";

/**
 * Cronologia unei firme (prototip: ActivityFeed.jsx). În bază, `detalii` e un
 * obiect scris de funcțiile din migrările 28–34; aici devine o propoziție în
 * română. Tipurile necunoscute (din import) se arată cu cheile lor, nu dispar.
 */

const ICONITE: Record<string, LucideIcon> = {
  creata: Search,
  etapa: CircleSlash,
  canal: Lock,
  apel: Phone,
  email: Mail,
  bounce: MailX,
  whatsapp: MessageCircle,
  raspuns: Reply,
  site: Bot,
  rezervare: Bot,
  nota: StickyNote,
  recontactare: LockOpen,
  evaluare: ClipboardCheck,
};

interface Descriere {
  titlu: string;
  detaliu?: string | null;
  citat?: string | null;
  linkuri?: { href: string; eticheta: string }[];
}

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const numar = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
const etapa = (v: unknown): string => (isEtapa(v) ? ETAPE[v].label : (text(v) ?? "—"));
const canal = (v: unknown): string => (isCanal(v) ? CANALE[v].label : (text(v) ?? "—"));
const rezultat = (v: unknown): string =>
  typeof v === "string" && (REZULTATE_IDS as readonly string[]).includes(v) ? REZULTATE[v as Rezultat].label : (text(v) ?? "fără rezultat");
const unite = (parti: (string | null | undefined | false)[]): string | null => parti.filter(Boolean).join(" · ") || null;
const moment = (v: unknown): string | null => {
  const t = text(v);
  return t && !Number.isNaN(Date.parse(t)) ? dateTimeRo(t) : null;
};

/** Datele canalelor cu care a venit firma din import (`email_la`, `whatsapp_la`, `telefon_la`). */
const CANALE_LA: { cheie: string; canal: Canal }[] = [
  { cheie: "email_la", canal: "email" },
  { cheie: "whatsapp_la", canal: "whatsapp" },
  { cheie: "telefon_la", canal: "telefon" },
];

function canaleLaCreare(d: Record<string, unknown>): string | null {
  const folosite = CANALE_LA.filter((c) => text(d[c.cheie])).map((c) => {
    const la = moment(d[c.cheie]);
    return la ? `${CANALE[c.canal].label} (${la})` : CANALE[c.canal].label;
  });
  if (folosite.length) return `canale deja folosite: ${folosite.join(", ")}`;
  // Modelul vechi (până la migrarea 33): un singur câmp `canal`.
  return text(d.canal) ? `canal ${canal(d.canal)}` : null;
}

const RASPUNSURI: Record<string, string> = { pozitiv: "pozitiv", nu: "„NU”", automat: "automat", altul: "alt răspuns" };

/** `canale_folosite` de la o recontactare: „email și WhatsApp”. */
const canaleFolosite = (v: unknown): string | null => {
  const lista = Array.isArray(v) ? v.filter(isCanal).map((c) => (c === "email" ? "email" : c === "whatsapp" ? "WhatsApp" : "telefon")) : [];
  return lista.length ? lista.join(" și ") : null;
};

/** „Cont 2” (din migrarea 34) sau „contul 2” (rândurile vechi, doar cu numărul). */
const contWhatsapp = (d: Record<string, unknown>): string | null => text(d.cont_nume) ?? (numar(d.cont) ? `contul ${numar(d.cont)}` : null);

export function descrieActivitate(a: Activitate): Descriere {
  const d: Record<string, unknown> = a.detalii && typeof a.detalii === "object" && !Array.isArray(a.detalii) ? a.detalii : {};

  switch (a.tip) {
    case "creata":
      return { titlu: "Firmă adăugată", detaliu: unite([text(d.etapa) && `etapa ${etapa(d.etapa)}`, canaleLaCreare(d)]) };
    case "etapa":
      return { titlu: text(d.din) ? `Etapă: ${etapa(d.din)} → ${etapa(d.in)}` : `Etapă: ${etapa(d.in)}`, detaliu: text(d.motiv) };
    case "canal": {
      // Din migrarea 33: `{ in, la, cont?, motiv? }` când se folosește un canal, `{ din: "telefon", motiv }` când se golește telefonul.
      // Rândurile vechi au `{ din?, in? }`, fără `la`: canalul era doar setat, nu folosit.
      const nou = text(d.in);
      const vechi = text(d.din);
      const motiv = text(d.motiv);
      if (nou === "telefon") return { titlu: "Intrată pe telefon", detaliu: motiv };
      if (nou) {
        const cont = numar(d.cont);
        if (!text(d.la)) return { titlu: `Canal setat: ${canal(nou)}`, detaliu: motiv };
        return { titlu: `Canal folosit: ${canal(nou)}${nou === "whatsapp" && cont ? ` (contul ${cont})` : ""}`, detaliu: motiv };
      }
      if (!vechi || vechi === "telefon") return { titlu: "Telefon golit", detaliu: motiv };
      return { titlu: `Canal golit: ${canal(vechi)}`, detaliu: motiv };
    }
    case "apel": {
      const incercari = numar(d.incercari);
      const limita = numar(d.limita);
      const sunaLa = text(d.suna_inapoi_la);
      return {
        titlu: `Apel: ${rezultat(d.rezultat)}${incercari && limita ? ` (${incercari}/${limita})` : incercari ? ` (încercarea ${incercari})` : ""}`,
        detaliu: unite([d.revenit_in_rezerva === true && "a ieșit din listă, și-a pierdut telefonul și a revenit în rezerva de apeluri", sunaLa && `sună înapoi ${dateTimeRo(sunaLa)}`]),
        citat: text(d.nota),
      };
    }
    case "email":
      return { titlu: `Email trimis${text(d.casuta) ? ` de pe ${text(d.casuta)}` : ""}`, detaliu: text(d.message_id) ? `id mesaj ${text(d.message_id)}` : null };
    case "bounce":
      return { titlu: `Email întors (bounce)${text(d.casuta) ? ` la ${text(d.casuta)}` : ""}` };
    case "whatsapp":
      // Excepția acceptată: după un apel „Interesat”, firma rămâne pe Telefon.
      if (d.continuare_apel === true) return { titlu: "Continuare apel pe WhatsApp", detaliu: "după „Interesat”; firma rămâne pe telefon, canalul WhatsApp nu se folosește" };
      return { titlu: `WhatsApp trimis${contWhatsapp(d) ? ` de pe ${contWhatsapp(d)}` : ""}` };
    case "raspuns":
      return {
        titlu: `Răspuns la email: ${RASPUNSURI[text(d.tip) ?? ""] ?? "alt răspuns"}`,
        detaliu: text(d.casuta) ? `la ${text(d.casuta)}` : null,
        citat: text(d.extras),
      };
    case "site": {
      const demo = linkWeb(text(d.link_demo));
      const captura = linkWeb(text(d.captura_url));
      return {
        titlu: "Site demo gata",
        linkuri: [demo && { href: demo, eticheta: faraProtocol(demo) }, captura && { href: captura, eticheta: "captura" }].filter((l): l is { href: string; eticheta: string } => Boolean(l)),
      };
    }
    case "rezervare": {
      const expira = text(d.expira_la);
      return {
        titlu: `Rezervată de un robot: ${text(d.tip_lucru) === "refacere" ? "refacere" : "construire"}`,
        detaliu: unite([expira && `până la ${dateTimeRo(expira)}`, text(d.preluata_de_la) && "preluată de la alt robot"]),
      };
    }
    case "nota":
      return { titlu: text(d.text) ?? "Notă actualizată" };
    case "recontactare": {
      // Din migrarea 34: un admin permite al doilea canal din fișă, cu motiv. Cine, apare la autor.
      const folosite = canaleFolosite(d.canale_folosite);
      return {
        titlu: `Recontactare permisă: ${canal(d.canal ?? a.canal)}`,
        detaliu: folosite ? `a primit deja ${folosite}` : null,
        citat: text(d.motiv),
      };
    }
    case "evaluare": {
      const scor = numar(d.scor);
      const fel = d.evaluare === "eligibila" ? "eligibilă" : d.evaluare === "respinsa" ? "respinsă" : (text(d.evaluare) ?? "fără verdict");
      return {
        titlu: `Evaluată: ${fel}${scor !== null ? `, scor ${scor}` : ""}`,
        detaliu: unite([text(d.motiv), text(d.nisa) && `nișa ${text(d.nisa)}`]),
      };
    }
    default: {
      const tip = a.tip.replace(/_/g, " ");
      return {
        titlu: tip.charAt(0).toUpperCase() + tip.slice(1),
        detaliu: unite(
          Object.entries(d)
            .filter(([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean")
            .slice(0, 4)
            .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`)
        ),
      };
    }
  }
}

export function ActivitateFirma({ activitate, acum, gol = "Nicio activitate pentru firma asta." }: { activitate: Activitate[]; acum: number; gol?: string }) {
  if (!activitate.length) {
    return <p className="py-4 text-[12.5px] text-muted-foreground">{gol}</p>;
  }

  return (
    <ol className="space-y-0">
      {activitate.map((a, i) => {
        const Icon = ICONITE[a.tip] ?? ArrowRightLeft;
        const d = descrieActivitate(a);
        return (
          <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < activitate.length - 1 ? <span className="absolute left-[13px] top-7 h-full w-px bg-border" aria-hidden="true" /> : null}
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-[#121216]">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="break-words text-[12.5px] leading-snug">{d.titlu}</p>
              {d.detaliu ? <p className="mt-0.5 break-words text-[12px] leading-snug text-foreground/65">{d.detaliu}</p> : null}
              {d.citat ? <p className="mt-1 break-words border-l-2 border-white/[0.12] pl-2 text-[12px] italic leading-snug text-foreground/75">„{d.citat}”</p> : null}
              {d.linkuri?.length ? (
                <p className="mt-0.5 flex flex-wrap gap-x-3 text-[12px]">
                  {d.linkuri.map((l) => (
                    <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="truncate text-lav hover:underline">
                      {l.eticheta}
                      <span className="sr-only"> (se deschide într-o filă nouă)</span>
                    </a>
                  ))}
                </p>
              ) : null}
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground/70">{a.autor}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={a.la} title={dateTimeRo(a.la)}>
                  {relativeRo(a.la, acum)}
                </time>
                {/* La „canal” și „recontactare”, titlul spune deja canalul. */}
                {isCanal(a.canal) && a.tip !== "canal" && a.tip !== "recontactare" ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{CANALE[a.canal].label}</span>
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
