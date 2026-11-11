"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Cpu, Hammer, KeyRound, Loader2, Pencil, Plus, Search, Send, type LucideIcon } from "lucide-react";
import { arhiveazaRobot, creeazaRobot, proprietarRobot, redenumesteRobot, tokenNouRobot } from "@/app/(admin)/admin/prospectare/actions";
import { ConfirmDialog, CopyButton, InlineNote } from "@/components/panou/ui/actions";
import { Info } from "@/components/panou/ui/info";
import { dateTimeRo, num, relativeRo, untilRo } from "@/components/panou/ui/format";
import { Modal } from "@/components/panou/ui/modal";
import { Btn, Card, Pill } from "@/components/panou/ui/primitives";
import { SoftSelect } from "@/components/panou/ui/select";
import { EmptyState, inputClass } from "@/components/panou/ui/states";
import { useToast } from "@/components/panou/ui/toast";
import type { Dispozitiv, SesiuneRobot } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";
import { PageHead } from "./page-head";
import { EroareCitire } from "./prezentare-eroare";
import { linkFirma, numeCalculator, RobotStare, SEMN_MS, stareRobot, stareSesiune } from "./prezentare-comun";

/**
 * Ecranul Roboți. Un robot = un calculator (un singur token), cu mai multe terminale (sesiuni) pe el.
 * Fiecare calculator: numele lui mare („PC Ștefan”), numele tehnic mic dedesubt, starea (Lucrează acum / Pornit, dar nu
 * lucrează / Oprit), proprietarul (editabil) și terminalele, fiecare cu ce face și câte site-uri a făcut azi.
 * Acțiuni: Token nou (cel vechi nu mai merge), Redenumește (numele calculatorului), Arhivează (iese din listă, rămâne în
 * istoric, tokenul nu mai merge). Tokenul stă doar în starea componentei: nu intră în URL sau în log și dispare la închidere.
 */

const PROPRIETARI = [
  { value: "Ștefan", label: "Ștefan" },
  { value: "Vlăduț", label: "Vlăduț" },
];

/** Terminalele fără semn de o zi nu se mai listează: se numără. */
const TERMINAL_RECENT_MS = 24 * 3600 * 1000;

/** Mesajele acțiunii care privesc câmpul „Nume tehnic”: se arată sub el, nu doar în notificare. */
const eroareDeNume = (message: string) => message.startsWith("Numele robotului") || message.startsWith("Există deja un robot");

const SARCINI: Record<NonNullable<Dispozitiv["ce_face"]>, { label: string; icon: LucideIcon; culoare: string }> = {
  cercetare: { label: "Cercetare", icon: Search, culoare: "text-sky" },
  constructie: { label: "Construcție", icon: Hammer, culoare: "text-apricot" },
  trimitere: { label: "Trimitere", icon: Send, culoare: "text-mint" },
};

/** Cel mai recent semn al calculatorului (cerere sau sarcină raportată, de pe oricare terminal). */
function vazutLa(d: Dispozitiv): string | null {
  const momente = [d.ultima_activitate, d.ce_face_la, ...d.sesiuni.map((s) => s.ultima_activitate)].filter((v): v is string => Boolean(v));
  if (momente.length === 0) return null;
  return momente.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a));
}

function Cand({ la, acum, prefix = "" }: { la: string | null; acum: number; prefix?: string }) {
  if (!la) return <span>niciodată</span>;
  return (
    <time dateTime={la} title={dateTimeRo(la)}>
      {prefix}
      {relativeRo(la, acum)}
    </time>
  );
}

/** Un terminal: numele, starea, ce face (cu firma în lucru), când a dat semn și câte site-uri azi. */
function Terminal({ s, acum }: { s: SesiuneRobot; acum: number }) {
  const stare = stareSesiune(s, acum);
  const la = s.ce_face_la ? Date.parse(s.ce_face_la) : NaN;
  const sarcina = s.ce_face && s.ce_face_la && !Number.isNaN(la) && acum - la <= SEMN_MS ? SARCINI[s.ce_face] : undefined;
  const f = stare === "lucreaza" ? s.firma_curenta : null;
  const detaliu = s.ce_face_detaliu;
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2 text-[13.5px] first:pt-0 last:pb-0">
      <span className="w-[8.5rem] shrink-0 truncate font-mono text-[13.5px] font-semibold text-foreground" title={`Terminalul ${s.sesiune}`}>
        {s.sesiune}
      </span>
      <span className="min-w-0 flex-1 basis-[16rem]">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <RobotStare stare={stare} />
          <span className="text-muted-foreground">
            <Cand la={s.ultima_activitate} acum={acum} />
          </span>
        </span>
        {sarcina && !f ? (
          // Firma în construcție are rândul ei (mai jos). Lucrează: sarcina, plin. Pornit: ultima sarcină, stins (ex. „Construcție: lista de construcție: 4 firme”).
          <span className={cn("mt-0.5 flex items-start gap-1.5", stare !== "lucreaza" && "text-muted-foreground")}>
            <sarcina.icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", stare === "lucreaza" ? sarcina.culoare : "text-muted-foreground")} aria-hidden="true" />
            <span className="min-w-0 break-words">
              <span className={stare === "lucreaza" ? "font-medium text-foreground" : undefined}>{sarcina.label}</span>
              {detaliu ? `: ${detaliu}` : null}
            </span>
          </span>
        ) : null}
        {f ? (
          <span className="mt-0.5 flex items-start gap-1.5">
            <Hammer className="mt-0.5 h-3.5 w-3.5 shrink-0 text-apricot" aria-hidden="true" />
            <span className="min-w-0 break-words">
              <span className="font-medium text-foreground">{f.tip_lucru === "refacere" ? "Reface" : "Construiește"}</span>{" "}
              <Link href={linkFirma(f.id)} className="rounded-sm text-foreground/85 underline-offset-2 hover:underline" title={f.nume}>
                #{f.nr} {f.nume}
              </Link>
              <span className="text-muted-foreground">
                {" · "}
                <span title={`Rezervarea expiră la ${dateTimeRo(f.expira_la)}`}>expiră {untilRo(f.expira_la, acum)}</span>
              </span>
            </span>
          </span>
        ) : null}
      </span>
      <span className="pu-num shrink-0 whitespace-nowrap text-[13.5px]" title={`${num(s.site_uri_total)} în total`}>
        <span className={cn("font-semibold", s.site_uri_azi ? "text-foreground" : "text-muted-foreground")}>{num(s.site_uri_azi)}</span>
        <span className="text-muted-foreground"> {s.site_uri_azi === 1 ? "site azi" : "site-uri azi"}</span>
      </span>
    </li>
  );
}

function Terminale({ d, acum }: { d: Dispozitiv; acum: number }) {
  const recente = d.sesiuni.filter((s) => stareSesiune(s, acum) !== "oprit" || acum - Date.parse(s.ultima_activitate) <= TERMINAL_RECENT_MS || s.site_uri_azi > 0);
  const vechi = d.sesiuni.filter((s) => !recente.includes(s));
  if (d.sesiuni.length === 0) return <p className="text-[13px] text-muted-foreground">Niciun terminal încă: apar aici după prima cerere.</p>;
  return (
    <div>
      {recente.length > 0 ? (
        <ul className="divide-y divide-border/60" aria-label={`Terminalele de pe ${numeCalculator(d)}`}>
          {recente.map((s) => (
            <Terminal key={s.sesiune} s={s} acum={acum} />
          ))}
        </ul>
      ) : null}
      {vechi.length > 0 ? (
        <p className={cn("text-[12.5px] text-muted-foreground", recente.length > 0 && "mt-1.5")} title={vechi.map((s) => s.sesiune).join(", ")}>
          {recente.length > 0 ? "+ " : ""}
          {vechi.length} {vechi.length === 1 ? "terminal" : "terminale"} fără semn de o zi
        </p>
      ) : null}
    </div>
  );
}

export function RobotiEcran({ dispozitive, eroare, acum }: { dispozitive: Dispozitiv[]; eroare: string | null; acum: number }) {
  const router = useRouter();
  const { notify } = useToast();

  const [arataArhivati, setArataArhivati] = useState(false);

  // Adaugă robot
  const [deschis, setDeschis] = useState(false);
  const [nume, setNume] = useState("");
  const [calculatorNou, setCalculatorNou] = useState("");
  const [proprietar, setProprietar] = useState("Ștefan");
  const [eroareNume, setEroareNume] = useState<string | null>(null);
  const [creez, startCreare] = useTransition();
  const numeRef = useRef<HTMLInputElement>(null);

  // Tokenul arătat o singură dată (la creare sau la „Token nou”)
  const [token, setToken] = useState<{ valoare: string; pentru: string; nou: boolean } | null>(null);
  const tokenRef = useRef<HTMLElement>(null);

  // Acțiunile pe un robot
  const [deToken, setDeToken] = useState<Dispozitiv | null>(null);
  const [deArhivat, setDeArhivat] = useState<Dispozitiv | null>(null);
  const [deRedenumit, setDeRedenumit] = useState<Dispozitiv | null>(null);
  const [calculator, setCalculator] = useState("");
  const [eroareCalculator, setEroareCalculator] = useState<string | null>(null);
  const [salvez, startSalvare] = useTransition();
  const [ocupat, setOcupat] = useState<string | null>(null);
  const [proprietarLocal, setProprietarLocal] = useState<Record<string, string>>({});

  useEffect(() => {
    if (token) tokenRef.current?.focus();
  }, [token]);

  const activi = dispozitive.filter((d) => !d.arhivat_la);
  const arhivati = dispozitive.filter((d) => d.arhivat_la);
  const lista = arataArhivati ? [...activi, ...arhivati] : activi;
  const lucreaza = activi.filter((d) => stareRobot(d, acum) === "lucreaza").length;
  const terminalePornite = activi.reduce((n, d) => n + (d.activ ? d.sesiuni.filter((s) => stareSesiune(s, acum) !== "oprit").length : 0), 0);

  const deschide = () => {
    setToken(null);
    setNume("");
    setCalculatorNou("");
    setEroareNume(null);
    setDeschis(true);
  };

  const inchide = () => {
    setDeschis(false);
    setToken(null);
    setNume("");
    setCalculatorNou("");
    setEroareNume(null);
  };

  const creeaza = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const curat = nume.trim();
    if (curat.length < 2) {
      setEroareNume("Numele robotului: cel puțin 2 caractere.");
      numeRef.current?.focus();
      return;
    }
    setEroareNume(null);
    startCreare(async () => {
      const result = await creeazaRobot({ nume: curat, calculator: calculatorNou.trim(), proprietar });
      if (!result.ok || !result.data) {
        const message = result.message;
        if (eroareDeNume(message)) {
          setEroareNume(message);
          numeRef.current?.focus();
        } else {
          notify(message, "error");
        }
        return;
      }
      setToken({ valoare: result.data.token, pentru: result.data.nume, nou: false });
      notify(result.message);
      router.refresh();
    });
  };

  const deschideRedenumire = (d: Dispozitiv) => {
    setCalculator(d.calculator ?? "");
    setEroareCalculator(null);
    setDeRedenumit(d);
  };

  const redenumeste = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const d = deRedenumit;
    if (!d) return;
    startSalvare(async () => {
      const result = await redenumesteRobot({ id: d.id, calculator: calculator.trim() });
      if (!result.ok) {
        setEroareCalculator(result.message);
        return;
      }
      notify(result.message);
      setDeRedenumit(null);
      router.refresh();
    });
  };

  const schimbaProprietar = async (d: Dispozitiv, valoare: string) => {
    setProprietarLocal((p) => ({ ...p, [d.id]: valoare }));
    setOcupat(d.id);
    const result = await proprietarRobot({ id: d.id, proprietar: valoare });
    notify(result.message, result.ok ? undefined : "error");
    if (!result.ok) setProprietarLocal((p) => ({ ...p, [d.id]: d.proprietar }));
    setOcupat(null);
    router.refresh();
  };

  const scoateDinArhiva = async (d: Dispozitiv) => {
    setOcupat(d.id);
    const result = await arhiveazaRobot({ id: d.id, arhivat: false });
    notify(result.message, result.ok ? undefined : "error");
    setOcupat(null);
    router.refresh();
  };

  const firmeInLucru = (d: Dispozitiv) => {
    const vazute = new Map<string, { nr: number; nume: string }>();
    for (const s of d.sesiuni) if (s.firma_curenta) vazute.set(s.firma_curenta.id, s.firma_curenta);
    if (d.firma_curenta) vazute.set(d.firma_curenta.id, d.firma_curenta);
    return [...vazute.values()];
  };

  return (
    <div className="space-y-4">
      <PageHead
        title="Roboți"
        pill={eroare ? undefined : `${lucreaza} lucrează acum · ${terminalePornite} ${terminalePornite === 1 ? "terminal pornit" : "terminale pornite"}`}
        pillTone="mint"
        actions={
          <>
            <Info label="Cum funcționează roboții">
              Un robot = un calculator, cu un singur token. Pe el rulează mai multe terminale (stefan-1, stefan-2…), fiecare cu treaba lui și cu
              site-urile lui. Tokenul stă în <code className="font-mono">MERIDIAN_ROBOT_TOKEN</code> pe calculator, niciodată în repo sau în chat. „Token
              nou”: cel vechi nu mai merge. „Arhivează”: robotul iese din listă, rămâne în istoric, iar firmele lui trec la alți roboți. Protocolul e în{" "}
              <code className="font-mono">docs/prospectare-api.md</code>.
            </Info>
            <Btn size="sm" variant="primary" icon={Plus} onClick={deschide}>
              Adaugă robot
            </Btn>
          </>
        }
      />

      {arhivati.length > 0 && !eroare ? (
        <div className="flex justify-end">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
            <input
              type="checkbox"
              checked={arataArhivati}
              onChange={(e) => setArataArhivati(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-white/20 bg-transparent accent-[#9C8CFF]"
            />
            Arată arhivați ({arhivati.length})
          </label>
        </div>
      ) : null}

      <Card className="overflow-hidden p-0">
        {eroare ? (
          <EroareCitire title="Roboții nu s-au putut citi" message={eroare} />
        ) : lista.length === 0 ? (
          <EmptyState
            icon={Cpu}
            title={arhivati.length > 0 ? "Toți roboții sunt arhivați" : "Niciun robot conectat"}
            action={
              <Btn size="sm" variant="primary" onClick={deschide}>
                Adaugă robot
              </Btn>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {lista.map((d) => {
              const arhivat = Boolean(d.arhivat_la);
              const stare = stareRobot(d, acum);
              const vazut = vazutLa(d);
              const lucru = ocupat === d.id;
              return (
                <li key={d.id} className={cn("px-4 py-4 sm:px-5", arhivat && "bg-white/[0.015]")}>
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Cpu className={cn("h-4 w-4 shrink-0", arhivat ? "text-muted-foreground/60" : "text-muted-foreground")} aria-hidden="true" />
                        <h2 className={cn("min-w-0 break-words text-[18px] font-semibold leading-tight", arhivat && "text-foreground/60")}>{numeCalculator(d)}</h2>
                        {arhivat ? <Pill>Arhivat</Pill> : null}
                      </div>
                      <p className="mt-1 flex flex-wrap gap-x-2 text-[12.5px] text-muted-foreground">
                        <span className="font-mono" title="Numele tehnic">
                          {d.nume}
                        </span>
                        {arhivat && d.arhivat_la ? (
                          <span title={dateTimeRo(d.arhivat_la)}>
                            · arhivat {relativeRo(d.arhivat_la, acum)}
                            {d.arhivat_de ? ` de ${d.arhivat_de}` : ""}
                          </span>
                        ) : d.token_schimbat_la ? (
                          <span title={dateTimeRo(d.token_schimbat_la)}>· token din {dateTimeRo(d.token_schimbat_la)}</span>
                        ) : null}
                      </p>
                    </div>
                    {arhivat ? null : (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px]">
                        <RobotStare stare={stare} className="text-[14px] font-medium" />
                        {stare !== "lucreaza" ? (
                          <span className="text-muted-foreground">
                            <Cand la={vazut} acum={acum} prefix="ultima activitate " />
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2.5">
                    <div className="flex items-center gap-2 text-[13.5px]">
                      <span className="text-muted-foreground">Proprietar</span>
                      <SoftSelect
                        ariaLabel={`Proprietarul lui ${numeCalculator(d)}`}
                        value={proprietarLocal[d.id] ?? d.proprietar}
                        onChange={(v) => void schimbaProprietar(d, v)}
                        options={PROPRIETARI.some((p) => p.value === d.proprietar) ? PROPRIETARI : [...PROPRIETARI, { value: d.proprietar, label: d.proprietar }]}
                        disabled={lucru}
                        className="w-[7.5rem]"
                      />
                    </div>
                    <p className="pu-num text-[13.5px] text-muted-foreground" title="Toate terminalele calculatorului">
                      <span className="font-semibold text-foreground">{num(d.site_uri_azi)}</span> {d.site_uri_azi === 1 ? "site azi" : "site-uri azi"} ·{" "}
                      {num(d.site_uri_total)} în total
                    </p>
                    <div className="flex flex-wrap gap-1.5 sm:ml-auto">
                      {arhivat ? (
                        <Btn size="xs" variant="outline" icon={lucru ? Loader2 : ArchiveRestore} disabled={lucru} onClick={() => void scoateDinArhiva(d)}>
                          Scoate din arhivă
                        </Btn>
                      ) : (
                        <>
                          <Btn size="xs" variant="outline" icon={KeyRound} disabled={lucru} onClick={() => setDeToken(d)} aria-label={`Token nou pentru ${numeCalculator(d)}`}>
                            Token nou
                          </Btn>
                          <Btn size="xs" variant="outline" icon={Pencil} disabled={lucru} onClick={() => deschideRedenumire(d)} aria-label={`Redenumește ${numeCalculator(d)}`}>
                            Redenumește
                          </Btn>
                          <Btn size="xs" variant="ghost" icon={Archive} disabled={lucru} onClick={() => setDeArhivat(d)} aria-label={`Arhivează ${numeCalculator(d)}`}>
                            Arhivează
                          </Btn>
                        </>
                      )}
                    </div>
                  </div>

                  {arhivat ? null : (
                    <div className="mt-3 rounded-xl border border-border/70 bg-white/[0.02] px-3.5 py-2.5">
                      <Terminale d={d} acum={acum} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Adaugă robot / tokenul arătat o singură dată */}
      <Modal
        open={deschis || token !== null}
        onOpenChange={(v) => (v ? undefined : inchide())}
        label={token ? `Tokenul pentru ${token.pentru}` : "Adaugă robot"}
      >
        <h2 className="text-[18px] font-semibold">{token ? `Tokenul pentru ${token.pentru}` : "Adaugă robot"}</h2>

        {token ? (
          <div className="mt-4 space-y-3">
            <code
              ref={tokenRef}
              tabIndex={0}
              aria-label="Tokenul robotului"
              className="block select-all break-all rounded-lg border border-border bg-secondary px-3 py-2.5 font-mono text-[13.5px] leading-relaxed"
            >
              {token.valoare}
            </code>
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton value={token.valoare} label="Copiază tokenul" clearAfter={120} />
              <span className="text-[13px] text-muted-foreground">Clipboardul se golește în 2 minute.</span>
            </div>
            <InlineNote tone="apricot" className="flex items-start gap-2">
              <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                Nu se mai afișează. Pune-l în <code className="font-mono">MERIDIAN_ROBOT_TOKEN</code> pe calculator, nu în repo sau în chat.
                {token.nou ? " Cel vechi nu mai merge." : ""} Pierdut: „Token nou”.
              </span>
            </InlineNote>
            <div className="flex justify-end">
              <Btn variant="primary" onClick={inchide}>
                Am salvat tokenul
              </Btn>
            </div>
          </div>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={creeaza} noValidate>
            <label className="block">
              <span className="text-[13px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Calculator</span>
              <input
                value={calculatorNou}
                onChange={(e) => setCalculatorNou(e.target.value)}
                placeholder="ex. PC Ștefan"
                maxLength={80}
                autoComplete="off"
                className={inputClass("mt-1.5")}
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Nume tehnic</span>
              <input
                ref={numeRef}
                value={nume}
                onChange={(e) => {
                  setNume(e.target.value);
                  if (eroareNume) setEroareNume(null);
                }}
                placeholder="ex. pc-stefan"
                maxLength={80}
                autoComplete="off"
                aria-invalid={eroareNume ? true : undefined}
                aria-describedby={eroareNume ? "robot-nume-eroare" : "robot-nume-ajutor"}
                className={inputClass(`mt-1.5 ${eroareNume ? "border-rose/50" : ""}`)}
              />
              {eroareNume ? (
                <span id="robot-nume-eroare" role="alert" className="mt-1 block text-[13px] text-rose">
                  {eroareNume}
                </span>
              ) : (
                <span id="robot-nume-ajutor" className="mt-1 block text-[13px] text-muted-foreground/80">
                  Litere, cifre, punct, liniuță, spațiu. Unic.
                </span>
              )}
            </label>
            <SoftSelect label="Proprietar" value={proprietar} onChange={setProprietar} options={PROPRIETARI} />
            <div className="flex justify-end gap-2 pt-1">
              <Btn variant="ghost" onClick={inchide}>
                Renunță
              </Btn>
              <Btn type="submit" variant="primary" disabled={!nume.trim() || creez} icon={creez ? Loader2 : undefined} aria-busy={creez}>
                {creez ? "Se generează…" : "Generează tokenul"}
              </Btn>
            </div>
          </form>
        )}
      </Modal>

      {/* Redenumește: doar numele calculatorului */}
      <Modal open={deRedenumit !== null} onOpenChange={(v) => (v ? undefined : setDeRedenumit(null))} label="Redenumește calculatorul">
        <h2 className="text-[18px] font-semibold">Redenumește</h2>
        <form className="mt-4 space-y-3" onSubmit={redenumeste} noValidate>
          <label className="block">
            <span className="text-[13px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Calculator</span>
            <input
              value={calculator}
              onChange={(e) => {
                setCalculator(e.target.value);
                if (eroareCalculator) setEroareCalculator(null);
              }}
              placeholder="ex. PC Ștefan, Laptop Vlăduț"
              maxLength={80}
              autoComplete="off"
              autoFocus
              aria-invalid={eroareCalculator ? true : undefined}
              aria-describedby="robot-calculator-ajutor"
              className={inputClass(`mt-1.5 ${eroareCalculator ? "border-rose/50" : ""}`)}
            />
            <span id="robot-calculator-ajutor" role={eroareCalculator ? "alert" : undefined} className={cn("mt-1 block text-[13px]", eroareCalculator ? "text-rose" : "text-muted-foreground/80")}>
              {eroareCalculator ?? (deRedenumit ? `Numele tehnic (${deRedenumit.nume}) rămâne. Gol: se arată numele tehnic.` : "")}
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Btn variant="ghost" onClick={() => setDeRedenumit(null)}>
              Renunță
            </Btn>
            <Btn type="submit" variant="primary" disabled={salvez} icon={salvez ? Loader2 : undefined} aria-busy={salvez}>
              Salvează
            </Btn>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deToken !== null}
        onOpenChange={(v) => {
          if (!v) setDeToken(null);
        }}
        title={deToken ? `Token nou pentru ${numeCalculator(deToken)}?` : "Token nou?"}
        description="Tokenul vechi nu mai merge din clipa asta. Cel nou se arată o singură dată."
        consequence={
          deToken && stareRobot(deToken, acum) !== "oprit"
            ? "Terminalele care rulează acum primesc 401 până pui tokenul nou pe calculator."
            : undefined
        }
        confirmLabel="Generează tokenul"
        tone="primary"
        onConfirm={async () => {
          if (!deToken) return;
          const d = deToken;
          setOcupat(d.id);
          const result = await tokenNouRobot({ id: d.id });
          setOcupat(null);
          if (!result.ok || !result.data) {
            notify(result.message, "error");
            return;
          }
          setToken({ valoare: result.data.token, pentru: result.data.nume, nou: true });
          notify(result.message);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={deArhivat !== null}
        onOpenChange={(v) => {
          if (!v) setDeArhivat(null);
        }}
        title={deArhivat ? `Arhivezi ${numeCalculator(deArhivat)}?` : "Arhivezi robotul?"}
        description="Iese din listă și rămâne în istoric. Tokenul lui nu mai merge."
        consequence={
          deArhivat
            ? (() => {
                const firme = firmeInLucru(deArhivat);
                return firme.length > 0
                  ? `Firmele lui în lucru (${firme.map((f) => `#${f.nr} ${f.nume}`).join(", ")}) trec acum la alt terminal.`
                  : "Nu are nicio firmă în lucru.";
              })()
            : undefined
        }
        confirmLabel="Arhivează"
        tone="danger"
        onConfirm={async () => {
          if (!deArhivat) return;
          const d = deArhivat;
          setOcupat(d.id);
          const result = await arhiveazaRobot({ id: d.id, arhivat: true });
          notify(result.message, result.ok ? undefined : "error");
          setOcupat(null);
          router.refresh();
        }}
      />

      <p className="sr-only" aria-live="polite">
        {creez ? "Se generează tokenul." : salvez ? "Se salvează numele calculatorului." : ocupat ? "Se salvează." : ""}
      </p>
    </div>
  );
}
