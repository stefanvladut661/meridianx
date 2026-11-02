import { ArrowRightLeft, Bot, CircleSlash, Lock, Mail, MailX, MessageCircle, Phone, Reply, Search, StickyNote, type LucideIcon } from "lucide-react";
import { dateTimeRo, relativeRo } from "@/components/panou/ui/format";
import { CANALE, ETAPE, REZULTATE, isCanal, isEtapa } from "@/lib/prospectare/labels";
import { REZULTATE_IDS, type Activitate, type Rezultat } from "@/lib/prospectare/types";
import { faraProtocol, linkWeb } from "./firme-format";

/**
 * Cronologia unei firme (prototip: ActivityFeed.jsx). În bază, `detalii` e un
 * obiect scris de funcțiile din migrările 28–30; aici devine o propoziție în
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

const RASPUNSURI: Record<string, string> = { pozitiv: "pozitiv", nu: "„NU”", automat: "automat", altul: "alt răspuns" };

export function descrieActivitate(a: Activitate): Descriere {
  const d: Record<string, unknown> = a.detalii && typeof a.detalii === "object" && !Array.isArray(a.detalii) ? a.detalii : {};

  switch (a.tip) {
    case "creata":
      return { titlu: "Firmă adăugată", detaliu: unite([text(d.etapa) && `etapa ${etapa(d.etapa)}`, text(d.canal) && `canal ${canal(d.canal)}`]) };
    case "etapa":
      return { titlu: text(d.din) ? `Etapă: ${etapa(d.din)} → ${etapa(d.in)}` : `Etapă: ${etapa(d.in)}`, detaliu: text(d.motiv) };
    case "canal":
      return {
        titlu: text(d.in) ? `Canal setat: ${canal(d.in)}` : `Canal golit${text(d.din) ? `: ${canal(d.din)}` : ""}`,
        detaliu: text(d.motiv),
      };
    case "apel": {
      const incercari = numar(d.incercari);
      const limita = numar(d.limita);
      const sunaLa = text(d.suna_inapoi_la);
      return {
        titlu: `Apel: ${rezultat(d.rezultat)}${incercari && limita ? ` (${incercari}/${limita})` : incercari ? ` (încercarea ${incercari})` : ""}`,
        detaliu: unite([d.revenit_in_rezerva === true && "a ieșit din listă și a revenit în rezervă, fără canal", sunaLa && `sună înapoi ${dateTimeRo(sunaLa)}`]),
        citat: text(d.nota),
      };
    }
    case "email":
      return { titlu: `Email trimis${text(d.casuta) ? ` de pe ${text(d.casuta)}` : ""}`, detaliu: text(d.message_id) ? `id mesaj ${text(d.message_id)}` : null };
    case "bounce":
      return { titlu: `Email întors (bounce)${text(d.casuta) ? ` la ${text(d.casuta)}` : ""}` };
    case "whatsapp":
      return { titlu: `WhatsApp trimis${numar(d.cont) ? ` de pe contul ${numar(d.cont)}` : ""}` };
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
                {isCanal(a.canal) ? (
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
