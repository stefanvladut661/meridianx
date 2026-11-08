"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, MessageCircle, Send } from "lucide-react";
import { anuleazaWhatsapp, trimiteWhatsapp } from "@/app/(admin)/admin/prospectare/actions";
import { InlineNote } from "@/components/panou/ui/actions";
import { num } from "@/components/panou/ui/format";
import { btnClass, Card } from "@/components/panou/ui/primitives";
import { EmptyState } from "@/components/panou/ui/states";
import { linkWhatsApp, umpleSablon } from "@/lib/prospectare/contact";
import type { ContWhatsapp, FirmaRand, ProgramareCuFirma } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";
import { PageHead } from "./page-head";
import { EroareCitire } from "./prezentare-eroare";
import { VcfButton } from "./vcf-button";
import { BaraTrimitere, type BaraWhatsapp } from "./whatsapp-bara";
import { pregatesteFereastra, WhatsAppRand, WhatsAppTrimisaRand } from "./whatsapp-card";

/**
 * „WhatsApp azi”: firmele programate azi (la 00:00 sau manual), pe conturi.
 * „Trimite pe WhatsApp” deschide fereastra chiar în clic (după `await`
 * browserul ar bloca-o), marchează firma pe contul programat și abia apoi
 * trimite fereastra la wa.me, cu mesajul gata. Dacă baza refuză (trimisă deja
 * de altcineva, nu mai e programată), fereastra se închide și motivul apare
 * jos. Firma trece imediat în „Trimise azi” și contorul contului crește fără
 * să așteptăm reîncărcarea; „Anulează” merge 10 secunde din bară și 2 minute
 * din „Trimise azi”.
 */

/** Ce știe ecranul înaintea bazei, pe firmă (până când reîncărcarea spune același lucru). */
type Locala =
  | { tip: "trimitere"; cont: number }
  | { tip: "trimisa"; cont: number; la: string; reper: number }
  | { tip: "anulare"; cont: number }
  | { tip: "programata"; cont: number; reper: number };

interface Rand {
  programare: number;
  firma: FirmaRand;
  /** Contul pe care e programată sau de pe care a plecat. */
  cont: number;
  trimisa: boolean;
  la: string | null;
  lucru: "trimitere" | "anulare" | null;
}

/** Un cont din rândul de sus: contorul de azi și, cu mai multe conturi, filtrul listei. */
interface ContAzi {
  id: number;
  nume: string;
  /** null: conturile nu s-au citit, limita nu se știe. */
  limita: number | null;
  activ: boolean;
}

type Filtru = number | "toate";

/** Contul ales ca filtru se ține minte pe dispozitiv: fiecare telefon trimite, de obicei, de pe același cont. */
const CHEIE_FILTRU = "prospectare_whatsapp_cont";
const SETARI = "/admin/prospectare/setari";
const SETARI_CONTURI = "/admin/prospectare/setari#conturi-whatsapp";
/** Baza lasă anularea 2 minute; butonul dispare puțin mai devreme, ca cererea să nu ajungă după termen. */
const ANULARE_MS = 2 * 60 * 1000 - 5000;
/** O stare locală pe care baza n-o confirmă nici după atâta timp (a schimbat-o altcineva) cedează în fața bazei. */
const EXPIRA_MS = 20 * 1000;
const CONEXIUNE = "Conexiunea a căzut și nu știm dacă firma s-a marcat. Lista se reîncarcă: dacă firma e tot de trimis, încearcă din nou.";
const BTN_SUS = "h-10 px-3.5 text-[14.5px] sm:h-8 sm:px-3 sm:text-[14px]";

/** Mesajul unei erori, ca propoziție încheiată (ca textul care urmează să înceapă curat). */
const fraza = (text: string): string => (/[.!?…]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

function cu<K, V>(m: Map<K, V>, k: K, v: V): Map<K, V> {
  const n = new Map(m);
  n.set(k, v);
  return n;
}

function fara<K, V>(m: Map<K, V>, k: K): Map<K, V> {
  if (!m.has(k)) return m;
  const n = new Map(m);
  n.delete(k);
  return n;
}

/** Rândul din listă, după ce știe ecranul în plus față de bază. */
function randDin(p: ProgramareCuFirma, o: Locala | undefined): Rand {
  const baza = { programare: p.id, firma: p.firma };
  if (!o) {
    const trimisa = p.stare === "folosita";
    return { ...baza, cont: p.cont_whatsapp ?? 0, trimisa, la: trimisa ? p.firma.whatsapp_la : null, lucru: null };
  }
  switch (o.tip) {
    case "trimitere":
      return { ...baza, cont: o.cont, trimisa: true, la: null, lucru: "trimitere" };
    case "trimisa":
      return { ...baza, cont: o.cont, trimisa: true, la: o.la, lucru: null };
    case "anulare":
      return { ...baza, cont: o.cont, trimisa: false, la: null, lucru: "anulare" };
    default:
      return { ...baza, cont: o.cont, trimisa: false, la: null, lucru: null };
  }
}

/**
 * Conturile de azi, sus: numele, „trimise azi / limită” și bara de umplere. La
 * limită, contorul se face portocaliu; nimic nu se blochează. Cu mai multe
 * conturi, fiecare e și filtru („Toate conturile” arată tot).
 */
function ConturiAzi({
  conturi,
  filtru,
  onAlege,
  contor,
  deTrimisPe,
  totalDeTrimis,
}: {
  conturi: ContAzi[];
  filtru: Filtru;
  onAlege: (f: Filtru) => void;
  contor: (id: number) => number;
  deTrimisPe: (id: number) => number;
  totalDeTrimis: number;
}) {
  const filtrabil = conturi.length > 1;
  const clasa = (ales: boolean) =>
    cn(
      "flex w-[9.25rem] shrink-0 snap-start flex-col rounded-[14px] border px-3 py-2 text-left transition-colors duration-150 sm:w-44",
      ales ? "border-lav/40 bg-lav/[0.09]" : "border-white/[0.07] bg-white/[0.03]",
      filtrabil && !ales && "hover:bg-white/[0.06]"
    );

  const chip = (c: ContAzi) => {
    const trimise = contor(c.id);
    const laLimita = c.limita !== null && trimise >= c.limita;
    const procent = c.limita ? Math.min(100, (trimise / c.limita) * 100) : 0;
    const continut = (
      <>
        <span className="flex items-center gap-1.5" aria-hidden="true">
          <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium leading-5">{c.nume}</span>
          {laLimita ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-apricot" /> : null}
        </span>
        <span className="pu-num text-[13.5px] leading-4 text-muted-foreground" aria-hidden="true">
          <span className={laLimita ? "text-[#FFC79C]" : "text-foreground/90"}>
            {num(trimise)}
            {c.limita !== null ? ` / ${num(c.limita)}` : ""}
          </span>{" "}
          azi{c.activ ? "" : " · dezactivat"}
        </span>
        <span aria-hidden="true" className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/[0.07]">
          <span className={cn("block h-full rounded-full transition-[width] duration-300", laLimita ? "bg-apricot" : "bg-lav/70")} style={{ width: `${procent}%` }} />
        </span>
        <span className="sr-only">
          {c.nume}: {num(trimise)} trimise azi{c.limita !== null ? ` din ${num(c.limita)}` : ""}, {num(deTrimisPe(c.id))} de trimis
          {laLimita ? ", limita e atinsă (doar avertisment)" : ""}
          {c.activ ? "" : ", dezactivat în Setări"}
        </span>
      </>
    );
    return filtrabil ? (
      <button key={c.id} type="button" aria-pressed={filtru === c.id} onClick={() => onAlege(c.id)} className={clasa(filtru === c.id)}>
        {continut}
      </button>
    ) : (
      <div key={c.id} className={clasa(false)}>
        {continut}
      </div>
    );
  };

  return (
    <div
      role="group"
      aria-label={filtrabil ? "Conturile de azi: trimise și filtrul listei" : "Contul de azi"}
      className="relative -mx-1 flex snap-x gap-1.5 overflow-x-auto overscroll-x-contain p-1 sm:flex-wrap sm:overflow-visible"
    >
      {filtrabil ? (
        <button type="button" aria-pressed={filtru === "toate"} onClick={() => onAlege("toate")} className={clasa(filtru === "toate")}>
          <span className="truncate text-[14.5px] font-medium leading-5">Toate conturile</span>
          <span className="pu-num text-[13.5px] leading-4 text-muted-foreground">
            <span className="text-foreground/90">{num(totalDeTrimis)}</span> de trimis
          </span>
          <span aria-hidden="true" className="mt-1.5 block h-1" />
        </button>
      ) : null}
      {conturi.map(chip)}
    </div>
  );
}

export function WhatsAppScreen({
  azi,
  programari,
  eroareProgramari,
  conturi,
  eroareConturi,
  sablon,
  eroareSetari,
  eroareCiclu,
  programeaza,
}: {
  azi: string;
  /** Programările de azi pe WhatsApp (programate și folosite); null: nu s-au citit. */
  programari: ProgramareCuFirma[] | null;
  eroareProgramari: string | null;
  /** Toate conturile din Setări (și cele dezactivate, pentru nume); null: nu s-au citit. */
  conturi: ContWhatsapp[] | null;
  eroareConturi: string | null;
  /** `sablon_whatsapp_primul` din Setări. */
  sablon: string;
  eroareSetari: string | null;
  /** Programarea de la 00:00 n-a putut fi verificată. */
  eroareCiclu: string | null;
  /** Butonul „Programează” (canal whatsapp), făcut pe server. */
  programeaza: ReactNode;
}) {
  const router = useRouter();
  const [filtru, setFiltru] = useState<Filtru>("toate");
  const [locale, setLocale] = useState<Map<string, Locala>>(() => new Map());
  // „trimise azi” întors de ultima acțiune pe cont, până la următoarea citire din bază.
  const [raportat, setRaportat] = useState<Map<number, number>>(() => new Map());
  const [erori, setErori] = useState<Map<string, string>>(() => new Map());
  // Contul dezactivat → contul activ de pe care pleacă firmele lui azi.
  const [inlocuiri, setInlocuiri] = useState<Map<number, number>>(() => new Map());
  const [bara, setBara] = useState<BaraWhatsapp | null>(null);
  const [anunt, setAnunt] = useState("");
  const [trimiseDeschis, setTrimiseDeschis] = useState(false);
  const [acum, setAcum] = useState<number | null>(null);
  // Două atingeri rapide ar ajunge amândouă înainte de randare: a doua se oprește aici.
  const inCurs = useRef(new Set<string>());
  const ferestre = useRef(new Map<string, Window>());
  const butoane = useRef(new Map<string, HTMLButtonElement>());
  const comutatorTrimise = useRef<HTMLButtonElement>(null);
  const titluLista = useRef<HTMLHeadingElement>(null);
  const deFocalizat = useRef<string | null>(null);
  const secventa = useRef(0);

  const anunta = useCallback((text: string) => setAnunt((vechi) => (vechi === text ? `${text} ` : text)), []);

  // ---- conturile ----------------------------------------------------------
  const dupaId = useMemo(() => new Map((conturi ?? []).map((c) => [c.id, c])), [conturi]);
  const numeCont = (id: number): string => dupaId.get(id)?.nume ?? `Contul ${id}`;
  // Fără conturi citite nu blocăm nimic: baza trimite de pe contul programat.
  const eActiv = (id: number): boolean => conturi === null || dupaId.get(id)?.activ === true;
  const active = (conturi ?? []).filter((c) => c.activ);

  const trimiseServer = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of programari ?? []) if (p.stare === "folosita" && p.cont_whatsapp !== null) m.set(p.cont_whatsapp, (m.get(p.cont_whatsapp) ?? 0) + 1);
    return m;
  }, [programari]);

  const delta = new Map<number, number>();
  for (const o of locale.values()) {
    if (o.tip === "trimitere") delta.set(o.cont, (delta.get(o.cont) ?? 0) + 1);
    if (o.tip === "anulare") delta.set(o.cont, (delta.get(o.cont) ?? 0) - 1);
  }
  const contor = (id: number): number => Math.max(0, (raportat.get(id) ?? trimiseServer.get(id) ?? 0) + (delta.get(id) ?? 0));

  // ---- rândurile ----------------------------------------------------------
  const randuri = (programari ?? []).map((p) => randDin(p, locale.get(p.firma_id)));
  const inLista = new Set(randuri.map((r) => r.cont));
  const conturiAzi: ContAzi[] = [
    ...(conturi ?? []).filter((c) => c.activ || inLista.has(c.id)).map((c) => ({ id: c.id, nume: c.nume, limita: c.limita_zi, activ: c.activ })),
    ...[...inLista]
      .filter((id) => !dupaId.has(id))
      .sort((a, b) => a - b)
      .map((id) => ({ id, nume: numeCont(id), limita: null, activ: true })),
  ];
  const ordine = new Map(conturiAzi.map((c, i) => [c.id, i]));
  const cheiConturi = conturiAzi.map((c) => c.id).join(",");
  const filtruEfectiv: Filtru = filtru !== "toate" && ordine.has(filtru) ? filtru : "toate";
  const potrivit = (r: Rand) => filtruEfectiv === "toate" || r.cont === filtruEfectiv;

  const toateDeTrimis = randuri.filter((r) => !r.trimisa).sort((a, b) => (ordine.get(a.cont) ?? 999) - (ordine.get(b.cont) ?? 999));
  const deTrimis = toateDeTrimis.filter(potrivit);
  const trimise = randuri
    .filter((r) => r.trimisa && potrivit(r))
    .sort((a, b) => (a.lucru ? -1 : b.lucru ? 1 : (b.la ?? "").localeCompare(a.la ?? "")));
  const deTrimisPe = (id: number) => toateDeTrimis.filter((r) => r.cont === id).length;
  const contInlocuitor = (r: Rand): number | null => (eActiv(r.cont) ? null : (inlocuiri.get(r.cont) ?? null));
  const inactiveCuFirme = conturiAzi.filter((c) => !c.activ && deTrimisPe(c.id) > 0);
  const mesajPentru = (firma: FirmaRand): string => (sablon.trim() ? umpleSablon(sablon, firma, "") : "");

  // ---- efecte ---------------------------------------------------------------
  // Citit după hidratare: serverul nu știe ce cont urmărește telefonul ăsta.
  useEffect(() => {
    let salvat = Number.NaN;
    try {
      salvat = Number(window.localStorage.getItem(CHEIE_FILTRU));
    } catch {
      /* stocarea poate fi blocată (navigare privată) */
    }
    if (Number.isInteger(salvat) && cheiConturi.split(",").map(Number).includes(salvat)) setFiltru(salvat);
  }, [cheiConturi]);

  // Fiecare citire nouă din bază: contoarele vin iar de acolo, iar stările locale pe care baza le confirmă (sau prea vechi) se uită.
  useEffect(() => {
    const momentul = Date.now();
    const stari = new Map((programari ?? []).map((p) => [p.firma_id, p.stare]));
    setRaportat((m) => (m.size ? new Map() : m));
    setLocale((vechi) => {
      let schimbat = false;
      const nou = new Map(vechi);
      for (const [id, o] of vechi) {
        if (o.tip === "trimitere" || o.tip === "anulare") continue;
        const stare = stari.get(id);
        const deAcord = o.tip === "trimisa" ? stare === "folosita" : stare === "programata";
        if (deAcord || stare === undefined || momentul - o.reper > EXPIRA_MS) {
          nou.delete(id);
          schimbat = true;
        }
      }
      return schimbat ? nou : vechi;
    });
  }, [programari]);

  // Înapoi din WhatsApp: lista se recitește, ca firmele trimise între timp de pe alt telefon să treacă la „Trimise azi”.
  useEffect(() => {
    let ultima = 0;
    const laRevenire = () => {
      if (document.visibilityState !== "visible" || Date.now() - ultima < 5000) return;
      ultima = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", laRevenire);
    return () => document.removeEventListener("visibilitychange", laRevenire);
  }, [router]);

  // „Anulează” din „Trimise azi” apare doar cât mai merge: ceasul merge cât secțiunea e deschisă.
  useEffect(() => {
    if (!trimiseDeschis) return;
    const tick = () => setAcum(Date.now());
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, [trimiseDeschis]);

  // După o anulare, focusul merge pe butonul firmei întoarse în listă, dacă omul n-a mutat focusul în altă parte.
  useEffect(() => {
    const tinta = deFocalizat.current;
    if (!tinta) return;
    const el = butoane.current.get(tinta);
    if (!el || el.disabled) return;
    deFocalizat.current = null;
    const activ = document.activeElement;
    if (!activ || activ === document.body) el.focus();
  });

  // ---- acțiuni ----------------------------------------------------------------
  const alegeFiltru = (f: Filtru) => {
    setFiltru(f);
    try {
      window.localStorage.setItem(CHEIE_FILTRU, String(f));
    } catch {
      /* fără stocare, alegerea ține până la reîncărcare */
    }
  };

  const inchideBara = useCallback((deLaButon: boolean) => {
    setBara(null);
    if (deLaButon) titluLista.current?.focus();
  }, []);

  const trimite = (r: Rand) => {
    const { firma } = r;
    const telefon = firma.telefon;
    const inlocuitor = contInlocuitor(r);
    if (!telefon || inCurs.current.has(firma.id) || (!eActiv(r.cont) && inlocuitor === null)) return;
    inCurs.current.add(firma.id);

    // Fereastra se deschide acum, cât suntem încă în clic; primește adresa după ce baza a marcat firma.
    const fereastra = window.open("", "_blank");
    if (fereastra) pregatesteFereastra(fereastra);
    const mesaj = mesajPentru(firma);
    const contOptimist = inlocuitor ?? r.cont;

    // Rândul pleacă din listă: focusul trece pe următoarea firmă care se poate trimite (sau pe „Trimise azi”).
    const i = deTrimis.findIndex((x) => x.firma.id === firma.id);
    const vecini = [...deTrimis.slice(i + 1), ...deTrimis.slice(0, Math.max(0, i)).reverse()];
    const urmatorul = vecini.map((x) => butoane.current.get(x.firma.id)).find((el) => el && !el.disabled);
    (urmatorul ?? comutatorTrimise.current)?.focus();

    setErori((m) => fara(m, firma.id));
    setLocale((m) => cu(m, firma.id, { tip: "trimitere", cont: contOptimist }));

    void (async () => {
      const res = await trimiteWhatsapp(inlocuitor !== null ? { firmaId: firma.id, cont: inlocuitor } : { firmaId: firma.id }).catch(() => ({
        ok: false as const,
        message: CONEXIUNE,
      }));
      inCurs.current.delete(firma.id);

      if (!res.ok) {
        if (fereastra && !fereastra.closed) fereastra.close();
        setLocale((m) => fara(m, firma.id));
        setErori((m) => cu(m, firma.id, res.message));
        setBara({ id: ++secventa.current, tip: "eroare", firmaId: firma.id, firma: firma.nume, titlu: `Netrimis: ${firma.nume}`, detaliu: res.message });
        anunta(`Netrimis: ${firma.nume}. ${res.message}`);
        router.refresh();
        return;
      }

      const d = res.data;
      const cont = d?.cont ?? contOptimist;
      const contNume = d?.contNume ?? numeCont(cont);
      if (d) setRaportat((m) => cu(m, d.cont, d.trimiseAzi));
      setLocale((m) => cu(m, firma.id, { tip: "trimisa", cont, la: new Date().toISOString(), reper: Date.now() }));

      const link = linkWhatsApp(telefon, mesaj);
      let deschis = false;
      if (fereastra && !fereastra.closed) {
        try {
          fereastra.location.href = link;
          ferestre.current.set(firma.id, fereastra);
          deschis = true;
        } catch {
          /* fereastra nu mai e a noastră: omul o deschide din bară */
        }
      }

      const contorText = d ? `${num(d.trimiseAzi)} / ${num(d.limita)} azi` : null;
      if (deschis) {
        setBara({
          id: ++secventa.current,
          tip: "trimis",
          firmaId: firma.id,
          firma: firma.nume,
          contNume,
          titlu: `Trimis pe ${contNume}`,
          detaliu: [firma.nume, contorText, d?.pesteLimita ? "peste limită: mesajul a plecat, dar crește riscul ca WhatsApp să blocheze numărul" : null]
            .filter(Boolean)
            .join(" · "),
          pesteLimita: d?.pesteLimita,
          link,
        });
        anunta(
          `Trimis pe ${contNume}: ${firma.nume}${contorText ? `, ${contorText}` : ""}.${d?.pesteLimita ? " Contul e peste limită." : ""} Poți anula 10 secunde din bara de jos sau 2 minute din „Trimise azi”.`
        );
      } else {
        setBara({
          id: ++secventa.current,
          tip: "blocat",
          firmaId: firma.id,
          firma: firma.nume,
          contNume,
          titlu: `Marcat pe ${contNume}, dar WhatsApp nu s-a deschis`,
          detaliu: `${firma.nume}: browserul a oprit fereastra nouă. Deschide conversația de aici.`,
          pesteLimita: d?.pesteLimita,
          link,
        });
        anunta(`${firma.nume} e marcată pe ${contNume}, dar browserul n-a deschis WhatsApp. Apasă „Deschide WhatsApp” în bara de jos.`);
      }
      router.refresh();
    })();
  };

  const anuleaza = (firmaId: string) => {
    const r = randuri.find((x) => x.firma.id === firmaId);
    if (!r || !r.trimisa || inCurs.current.has(firmaId)) return;
    inCurs.current.add(firmaId);
    const inainte = locale.get(firmaId);
    const nume = r.firma.nume;

    deFocalizat.current = firmaId;
    setLocale((m) => cu(m, firmaId, { tip: "anulare", cont: r.cont }));
    setBara({ id: ++secventa.current, tip: "anulare", firmaId, firma: nume, titlu: "Se anulează marcarea…", detaliu: nume });

    void (async () => {
      const res = await anuleazaWhatsapp(firmaId).catch(() => ({
        ok: false as const,
        message: "Conexiunea a căzut și nu știm dacă marcarea s-a anulat. Lista se reîncarcă: verifică unde e firma.",
      }));
      inCurs.current.delete(firmaId);

      if (!res.ok) {
        deFocalizat.current = null;
        setLocale((m) => (inainte ? cu(m, firmaId, inainte) : fara(m, firmaId)));
        setBara({ id: ++secventa.current, tip: "eroare", firmaId, firma: nume, titlu: `Nu s-a anulat: ${nume}`, detaliu: res.message });
        anunta(`Nu s-a anulat: ${nume}. ${res.message}`);
        router.refresh();
        return;
      }

      const d = res.data;
      if (d) setRaportat((m) => cu(m, d.cont, d.trimiseAzi));
      setLocale((m) => cu(m, firmaId, { tip: "programata", cont: r.cont, reper: Date.now() }));
      // Conversația deschisă în browser (WhatsApp Web) se închide; aplicația de pe telefon rămâne cum e.
      const fereastra = ferestre.current.get(firmaId);
      ferestre.current.delete(firmaId);
      try {
        if (fereastra && !fereastra.closed) fereastra.close();
      } catch {
        /* nu mai e a noastră */
      }
      setBara({
        id: ++secventa.current,
        tip: "anulat",
        firmaId,
        firma: nume,
        titlu: "Marcarea s-a anulat",
        detaliu: `${nume} e din nou de trimis. Dacă WhatsApp e deschis cu mesajul, nu-l mai trimite.`,
      });
      anunta(`Marcarea s-a anulat: ${nume} e din nou de trimis.`);
      router.refresh();
    })();
  };

  const laDeschis = useCallback(() => {
    // WhatsApp s-a deschis din bară: devine bara obișnuită, cu cele 10 secunde de „Anulează”.
    setBara((b) => (b && b.tip === "blocat" ? { ...b, id: ++secventa.current, tip: "trimis", titlu: `Trimis pe ${b.contNume ?? "cont"}`, detaliu: b.firma } : b));
  }, []);

  // ---- notele de sus ----------------------------------------------------------
  const note: ReactNode[] = [];
  if (eroareCiclu) {
    note.push(
      <InlineNote key="ciclu" tone="apricot">
        Programarea de la 00:00 nu s-a putut verifica: {fraza(eroareCiclu)} Lista arată doar ce era deja programat. Reîncarcă pagina peste un minut.
      </InlineNote>
    );
  }
  if (eroareSetari) {
    note.push(
      <InlineNote key="setari" tone="rose">
        Setările nu s-au citit: {fraza(eroareSetari)} Până se rezolvă, WhatsApp se deschide fără mesajul pregătit.
      </InlineNote>
    );
  } else if (!sablon.trim()) {
    note.push(
      <InlineNote key="sablon" tone="apricot" className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1">Șablonul primului mesaj e gol: WhatsApp se deschide fără text. Scrie-l în Setări, la șabloane.</p>
        <Link href={SETARI} className={btnClass({ variant: "outline", size: "sm", className: BTN_SUS })}>
          Deschide Setările
        </Link>
      </InlineNote>
    );
  } else if (sablon.includes("{utilizator}")) {
    note.push(
      <InlineNote key="utilizator" tone="apricot" className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1">Șablonul conține {"{utilizator}"}, care aici rămâne gol: pe WhatsApp trimiți de pe un cont, nu în numele cuiva. Scoate-l din șablon.</p>
        <Link href={SETARI} className={btnClass({ variant: "outline", size: "sm", className: BTN_SUS })}>
          Deschide Setările
        </Link>
      </InlineNote>
    );
  }
  if (conturi === null) {
    note.push(
      <InlineNote key="conturi" tone="apricot">
        Conturile nu s-au citit: {fraza(eroareConturi ?? "citirea a căzut")} Limitele lipsesc, dar trimiterea merge, de pe contul programat.
      </InlineNote>
    );
  }
  for (const c of inactiveCuFirme) {
    const ales = inlocuiri.get(c.id);
    note.push(
      <InlineNote key={`inactiv-${c.id}`} tone="apricot" className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="min-w-0 flex-1 basis-60">
          „{c.nume}” e dezactivat în Setări, dar are {num(deTrimisPe(c.id))} de trimis azi.{" "}
          {active.length ? "Alege contul de pe care pleacă:" : "Niciun cont nu e activ: activează unul în Setări."}
        </p>
        {active.length ? (
          <select
            value={ales ?? ""}
            onChange={(e) => {
              const v = Number(e.target.value);
              setInlocuiri((m) => (v ? cu(m, c.id, v) : fara(m, c.id)));
            }}
            aria-label={`Contul de pe care pleacă firmele lui „${c.nume}”`}
            className="h-10 rounded-lg border border-white/[0.14] bg-[#141418] px-2.5 text-[14.5px] text-foreground sm:h-8 sm:text-[14px]"
          >
            <option value="">Alege contul</option>
            {active.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nume} ({num(contor(a.id))} / {num(a.limita_zi)} azi)
              </option>
            ))}
          </select>
        ) : (
          <Link href={SETARI_CONTURI} className={btnClass({ variant: "outline", size: "sm", className: BTN_SUS })}>
            Deschide conturile
          </Link>
        )}
      </InlineNote>
    );
  }

  // ---- lista ------------------------------------------------------------------
  const contFiltru = filtruEfectiv === "toate" ? null : numeCont(filtruEfectiv);
  let lista: ReactNode;
  if (programari === null) {
    lista = <EroareCitire title="Programările de azi nu s-au citit" message={eroareProgramari ?? "Citirea a căzut."} className="py-10" />;
  } else if (programari.length === 0) {
    lista = (
      <EmptyState
        icon={MessageCircle}
        title="Nimic programat azi pe WhatsApp"
        text="La 00:00 se programează singure firmele cu cele mai vechi site-uri demo și număr de mobil (și cele care au primit email într-o zi de dinainte), împărțite pe conturile active, cât încape în limita fiecăruia. Ziua se completează și când crește o limită sau apar site-uri noi. Cu „Programează” alegi tu firmele, de mâine încolo."
        hint={
          conturi !== null && active.length === 0 ? (
            <>
              Niciun cont WhatsApp nu e activ, deci la 00:00 nu se programează nimic.{" "}
              <Link href={SETARI_CONTURI} className="underline underline-offset-2 hover:text-foreground">
                Activează un cont în Setări
              </Link>
              .
            </>
          ) : undefined
        }
        className="py-10"
      />
    );
  } else if (deTrimis.length === 0 && toateDeTrimis.length === 0) {
    lista = (
      <EmptyState
        icon={Send}
        title="Ai trimis tot ce era programat azi"
        text="Următoarele firme se programează singure la 00:00. Ce ai trimis e mai jos, în „Trimise azi”."
        className="py-10"
      />
    );
  } else if (deTrimis.length === 0) {
    lista = (
      <EmptyState
        icon={Send}
        title={`Nimic de trimis pe ${contFiltru ?? "contul ales"}`}
        text={`Celelalte conturi mai au ${num(toateDeTrimis.length)} de trimis azi.`}
        action={
          <button type="button" onClick={() => alegeFiltru("toate")} className={btnClass({ variant: "outline", size: "sm", className: BTN_SUS })}>
            Arată toate conturile
          </button>
        }
        className="py-10"
      />
    );
  } else {
    lista = (
      <ul className="divide-y divide-white/[0.06]">
        {deTrimis.map((r) => {
          const inlocuitor = contInlocuitor(r);
          const contFolosit = inlocuitor ?? r.cont;
          const limita = dupaId.get(contFolosit)?.limita_zi;
          const trimisePeCont = contor(contFolosit);
          const blocatInactiv = !eActiv(r.cont) && inlocuitor === null;
          return (
            <WhatsAppRand
              key={r.programare}
              firma={r.firma}
              mesaj={mesajPentru(r.firma)}
              contNume={inlocuitor !== null ? `${numeCont(r.cont)} → ${numeCont(inlocuitor)}` : numeCont(r.cont)}
              limita={limita === undefined || trimisePeCont < limita ? null : trimisePeCont > limita ? "peste" : "la"}
              lucru={r.lucru === "anulare" ? "anulare" : null}
              eroare={erori.get(r.firma.id) ?? null}
              motivBlocare={
                !r.firma.telefon
                  ? "Firma nu are telefon în fișă."
                  : blocatInactiv
                    ? `„${numeCont(r.cont)}” e dezactivat: alege mai sus contul de pe care pleacă.`
                    : null
              }
              butonRef={(el) => {
                if (el) butoane.current.set(r.firma.id, el);
                else butoane.current.delete(r.firma.id);
              }}
              onTrimite={() => trimite(r)}
              onCopiat={anunta}
            />
          );
        })}
      </ul>
    );
  }

  return (
    <div className={cn("space-y-4", bara && "pb-24 lg:pb-16")}>
      <PageHead
        title="WhatsApp azi"
        pill={programari && programari.length ? `${num(toateDeTrimis.length)} de trimis` : undefined}
        actions={
          <>
            {programeaza}
            {toateDeTrimis.length ? <VcfButton firme={toateDeTrimis.map((r) => r.firma)} numeFisier={`whatsapp-${azi}.vcf`} className={BTN_SUS} /> : null}
          </>
        }
      />

      {note}

      <Card as="section" padded={false} aria-labelledby="whatsapp-de-trimis" className="overflow-hidden">
        <div className="space-y-2.5 border-b border-white/[0.06] px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id="whatsapp-de-trimis" ref={titluLista} tabIndex={-1} className="text-[16px] font-semibold tracking-[-0.01em]">
              De trimis azi
              {programari ? <span className="pu-num font-normal text-muted-foreground"> · {num(deTrimis.length)}</span> : null}
              {contFiltru ? <span className="font-normal text-muted-foreground"> pe {contFiltru}</span> : null}
            </h2>
            <Link
              href={SETARI_CONTURI}
              className="-my-2 inline-flex min-h-10 items-center rounded-sm text-[13.5px] text-muted-foreground hover:text-foreground sm:min-h-0 sm:text-[13px]"
            >
              Conturi și limite, în Setări →
            </Link>
          </div>
          {programari && conturiAzi.length ? (
            <ConturiAzi
              conturi={conturiAzi}
              filtru={filtruEfectiv}
              onAlege={alegeFiltru}
              contor={contor}
              deTrimisPe={deTrimisPe}
              totalDeTrimis={toateDeTrimis.length}
            />
          ) : null}
        </div>
        {lista}
      </Card>

      {programari && programari.length ? (
        <Card as="section" padded={false} aria-labelledby="whatsapp-trimise-titlu" className="overflow-hidden">
          <h2 id="whatsapp-trimise-titlu">
            <button
              ref={comutatorTrimise}
              type="button"
              aria-expanded={trimiseDeschis}
              aria-controls="whatsapp-trimise"
              onClick={() => setTrimiseDeschis((v) => !v)}
              className="flex min-h-12 w-full items-center gap-2 rounded-[22px] px-3 py-2.5 text-left hover:bg-white/[0.03] sm:px-4"
            >
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", trimiseDeschis && "rotate-180")} aria-hidden="true" />
              <span className="text-[16px] font-semibold tracking-[-0.01em]">Trimise azi</span>
              <span className="pu-num text-[14.5px] text-muted-foreground">
                · {num(trimise.length)}
                {contFiltru ? ` pe ${contFiltru}` : ""}
              </span>
              <span className="ml-auto text-[13.5px] text-muted-foreground" aria-hidden="true">
                {trimiseDeschis ? "Ascunde" : "Arată"}
              </span>
            </button>
          </h2>
          <div id="whatsapp-trimise" hidden={!trimiseDeschis}>
            <p className="border-t border-white/[0.06] px-3 py-2 text-[13.5px] leading-snug text-muted-foreground sm:px-4">
              „Anulează” merge în primele 2 minute de la trimitere. Conversația se redeschide fără mesaj, ca să nu-l trimiți de două ori.
            </p>
            {trimise.length ? (
              <ul className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
                {trimise.map((r) => (
                  <WhatsAppTrimisaRand
                    key={r.programare}
                    firma={r.firma}
                    contNume={numeCont(r.cont)}
                    la={r.la}
                    lucru={r.lucru === "trimitere" ? "trimitere" : null}
                    poateAnula={acum !== null && r.la !== null && acum - Date.parse(r.la) < ANULARE_MS}
                    onAnuleaza={() => anuleaza(r.firma.id)}
                  />
                ))}
              </ul>
            ) : (
              <p className="border-t border-white/[0.06] px-3 py-4 text-[14px] text-muted-foreground sm:px-4">
                Nimic trimis azi{contFiltru ? ` pe ${contFiltru}` : ""}. Ce trimiți apare aici, cu ora și contul.
              </p>
            )}
          </div>
        </Card>
      ) : null}

      <p role="status" aria-live="polite" className="sr-only">
        {anunt}
      </p>

      <BaraTrimitere bara={bara} onAnuleaza={anuleaza} onDeschis={laDeschis} onInchide={inchideBara} />
    </div>
  );
}
