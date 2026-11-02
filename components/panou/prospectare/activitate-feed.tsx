import Link from "next/link";
import { ArrowRightLeft, Bot, CircleSlash, Cpu, Lock, Mail, MailX, MessageCircle, Phone, Reply, Search, StickyNote, type LucideIcon } from "lucide-react";
import { dateTimeRo, relativeRo } from "@/components/panou/ui/format";
import type { ActivitateCuFirma } from "@/lib/prospectare/citire";
import { CANALE, ETAPE, isCanal, isEtapa, REZULTATE } from "@/lib/prospectare/labels";
import type { Rezultat } from "@/lib/prospectare/types";
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

/** Ce s-a întâmplat (rândul principal) și, dacă are, amănuntul (motiv, notă, extras). */
export function descrieActivitate(a: Pick<ActivitateCuFirma, "tip" | "detalii">): { ce: string; amanunt: string | null } {
  const d = a.detalii ?? {};
  switch (a.tip) {
    case "etapa":
      return { ce: `Etapă: ${etapa(d.din)} → ${etapa(d.in)}`, amanunt: text(d.motiv) };
    case "canal": {
      const nou = canal(d.in);
      return nou ? { ce: `Canal setat: ${nou}`, amanunt: text(d.motiv) } : { ce: `Canal scos: ${canal(d.din) ?? "—"}`, amanunt: text(d.motiv) };
    }
    case "apel": {
      const rezultat = d.rezultat;
      const r = typeof rezultat === "string" && rezultat in REZULTATE ? REZULTATE[rezultat as Rezultat].label : (text(rezultat) ?? "fără rezultat");
      const incercari = numar(d.incercari);
      const limita = numar(d.limita);
      const contor = d.rezultat === "nu_raspunde" && incercari && limita ? ` (${incercari}/${limita})` : "";
      const inapoi = ora(d.suna_inapoi_la);
      const amanunt = [
        d.revenit_in_rezerva === true ? "A ieșit din listă, și-a pierdut canalul Telefon și a revenit în rezervă." : null,
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
      const cont = numar(d.cont);
      return { ce: cont ? `WhatsApp trimis de pe contul ${cont}` : "WhatsApp trimis", amanunt: null };
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
    case "creata": {
      const start = d.etapa;
      return { ce: "Firmă adăugată în prospectare", amanunt: isEtapa(start) ? `Etapa de start: ${ETAPE[start].label}` : null };
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
  gol = "Nicio activitate încă. Când roboții cercetează firme sau voi sunați și trimiteți mesaje, fiecare pas apare aici.",
}: {
  activitate: ActivitateCuFirma[];
  /** Ora citirii (de pe server), ca „acum 5 min” să fie același la randare și la hidratare. */
  acum: number;
  gol?: string;
}) {
  if (!activitate.length) {
    return <p className="py-4 text-[12.5px] text-muted-foreground">{gol}</p>;
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
              <p className="break-words text-[12.5px] leading-snug">
                <Link href={linkFirma(a.firma.id)} className="rounded-sm font-medium underline-offset-2 hover:underline">
                  <span className="pu-num text-muted-foreground">#{a.firma.nr}</span> {a.firma.nume}
                </Link>
                <span className="text-foreground/80"> — {ce}</span>
              </p>
              {amanunt ? <p className="mt-0.5 line-clamp-2 break-words text-[11.5px] leading-relaxed text-muted-foreground">{amanunt}</p> : null}
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground/70">{a.autor}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={a.la} title={dateTimeRo(a.la)}>
                  {relativeRo(a.la, acum)}
                </time>
                {a.canal ? (
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
