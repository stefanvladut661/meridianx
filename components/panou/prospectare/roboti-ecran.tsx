"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cpu, Hammer, KeyRound, Loader2, Plus, Search, Send, type LucideIcon } from "lucide-react";
import { comutaRobot, creeazaRobot } from "@/app/(admin)/admin/prospectare/actions";
import { ConfirmDialog, CopyButton, InlineNote } from "@/components/panou/ui/actions";
import { dateTimeRo, num, relativeRo, untilRo } from "@/components/panou/ui/format";
import { Modal } from "@/components/panou/ui/modal";
import { Btn, Card } from "@/components/panou/ui/primitives";
import { SoftSelect } from "@/components/panou/ui/select";
import { EmptyState, inputClass } from "@/components/panou/ui/states";
import { useToast } from "@/components/panou/ui/toast";
import type { Dispozitiv } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";
import { PageHead } from "./page-head";
import { EroareCitire } from "./prezentare-eroare";
import { linkFirma, RobotStare, stareRobot } from "./prezentare-comun";

/**
 * Ecranul Roboți, ca `RobotsPage` din prototip: tabelul dispozitivelor (carduri
 * sub 768), „Adaugă robot” cu tokenul arătat o singură dată și
 * activare / dezactivare. Tokenul stă doar în starea componentei: nu intră în
 * URL, în log sau în altă parte și dispare când se închide fereastra.
 */

const PROPRIETARI = [
  { value: "Ștefan", label: "Ștefan" },
  { value: "Vlăduț", label: "Vlăduț" },
];

/** Mesajele acțiunii care privesc câmpul „Nume”: se arată sub el, nu doar în notificare. */
const eroareDeNume = (message: string) => message.startsWith("Numele robotului") || message.startsWith("Există deja un robot");

/** Fără sarcină raportată în ultima jumătate de oră, robotul e „Inactiv”. */
const INACTIV_DUPA_MS = 30 * 60 * 1000;

const SARCINI: Record<NonNullable<Dispozitiv["ce_face"]>, { label: string; icon: LucideIcon; culoare: string }> = {
  cercetare: { label: "Cercetare", icon: Search, culoare: "text-sky" },
  constructie: { label: "Construcție", icon: Hammer, culoare: "text-apricot" },
  trimitere: { label: "Trimitere", icon: Send, culoare: "text-mint" },
};

/** Cel mai recent dintre momentele în care robotul a dat semn (cerere sau sarcină raportată). */
function vazutLa(d: Dispozitiv): string | null {
  const momente = [d.ultima_activitate, d.ce_face_la].filter((v): v is string => Boolean(v));
  if (momente.length === 0) return null;
  return momente.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a));
}

/** Ce face robotul acum: „Cercetare: instalatori · Muntenia · acum 3 min”, sau „Inactiv · văzut acum 2 h”. */
function CeFace({ d, acum }: { d: Dispozitiv; acum: number }) {
  const la = d.ce_face_la ? Date.parse(d.ce_face_la) : NaN;
  const sarcina = d.ce_face ? SARCINI[d.ce_face] : undefined;
  if (!sarcina || !d.ce_face_la || Number.isNaN(la) || acum - la > INACTIV_DUPA_MS) {
    const vazut = vazutLa(d);
    const ultima = sarcina && d.ce_face_la ? `Ultima sarcină: ${sarcina.label}${d.ce_face_detaliu ? `, ${d.ce_face_detaliu}` : ""} (${dateTimeRo(d.ce_face_la)})` : undefined;
    return (
      <span className="flex items-start gap-1.5 text-[12px]" title={ultima}>
        <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" aria-hidden="true" />
        <span className="min-w-0">
          <span className="font-medium text-foreground/80">Inactiv</span>
          <span className="text-muted-foreground">
            {" · "}
            {vazut ? (
              <time dateTime={vazut} title={dateTimeRo(vazut)}>
                văzut {relativeRo(vazut, acum)}
              </time>
            ) : (
              "nevăzut încă"
            )}
          </span>
        </span>
      </span>
    );
  }
  return (
    <span className="flex items-start gap-1.5 text-[12px]">
      <sarcina.icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", sarcina.culoare)} aria-hidden="true" />
      <span className="min-w-0 break-words">
        <span className="font-medium text-foreground">{sarcina.label}</span>
        {d.ce_face_detaliu ? `: ${d.ce_face_detaliu}` : null}
        <span className="text-muted-foreground">
          {" · "}
          <time dateTime={d.ce_face_la} title={dateTimeRo(d.ce_face_la)}>
            {relativeRo(d.ce_face_la, acum)}
          </time>
        </span>
      </span>
    </span>
  );
}

function FirmaCurenta({ d, acum, scurt = false }: { d: Dispozitiv; acum: number; scurt?: boolean }) {
  const f = d.firma_curenta;
  if (!f) return <span className="text-muted-foreground">{scurt ? "—" : "fără firmă în lucru"}</span>;
  return (
    <span className="min-w-0">
      <Link href={linkFirma(f.id)} className="block truncate rounded-sm underline-offset-2 hover:underline" title={f.nume}>
        <span className="pu-num text-muted-foreground">#{f.nr}</span> {f.nume}
      </Link>
      <span className="block text-[11px] text-muted-foreground" title={`Rezervarea expiră la ${dateTimeRo(f.expira_la)}`}>
        {f.tip_lucru === "refacere" ? "refacere" : "construire"} · expiră {untilRo(f.expira_la, acum)}
      </span>
    </span>
  );
}

export function RobotiEcran({ dispozitive, eroare, acum }: { dispozitive: Dispozitiv[]; eroare: string | null; acum: number }) {
  const router = useRouter();
  const { notify } = useToast();

  const [deschis, setDeschis] = useState(false);
  const [nume, setNume] = useState("");
  const [proprietar, setProprietar] = useState("Ștefan");
  const [eroareNume, setEroareNume] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [numeCreat, setNumeCreat] = useState("");
  const [creez, startCreare] = useTransition();
  const [comut, startComutare] = useTransition();
  const [comutId, setComutId] = useState<string | null>(null);
  const [deOprit, setDeOprit] = useState<Dispozitiv | null>(null);
  const numeRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef<HTMLElement>(null);

  // Formularul dispare când apare tokenul: focusul trece pe token, nu rămâne în gol.
  useEffect(() => {
    if (token) tokenRef.current?.focus();
  }, [token]);

  const deschide = () => {
    setToken(null);
    setNume("");
    setEroareNume(null);
    setDeschis(true);
  };

  const inchide = () => {
    setDeschis(false);
    setToken(null);
    setNumeCreat("");
    setNume("");
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
      const result = await creeazaRobot({ nume: curat, proprietar });
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
      setNumeCreat(result.data.nume);
      setToken(result.data.token);
      notify(result.message);
      router.refresh();
    });
  };

  const comuta = (d: Dispozitiv, activ: boolean) => {
    setComutId(d.id);
    startComutare(async () => {
      const result = await comutaRobot({ id: d.id, activ });
      notify(result.message, result.ok ? undefined : "error");
      router.refresh();
      setComutId(null);
    });
  };

  const acumActivi = dispozitive.filter((d) => stareRobot(d, acum) === "acum").length;

  const buton = (d: Dispozitiv, className?: string) => {
    const ocupat = comut && comutId === d.id;
    return d.activ ? (
      <Btn size="xs" variant="outline" className={className} disabled={ocupat} icon={ocupat ? Loader2 : undefined} onClick={() => setDeOprit(d)} aria-label={`Dezactivează ${d.nume}`}>
        Dezactivează
      </Btn>
    ) : (
      <Btn size="xs" variant="mint" className={className} disabled={ocupat} icon={ocupat ? Loader2 : undefined} onClick={() => comuta(d, true)} aria-label={`Activează ${d.nume}`}>
        {ocupat ? "Se activează…" : "Activează"}
      </Btn>
    );
  };

  return (
    <div className="space-y-4">
      <PageHead
        title="Roboți"
        pill={eroare ? undefined : `${acumActivi} ${acumActivi === 1 ? "activ" : "activi"} acum`}
        pillTone="mint"
        actions={
          <Btn size="sm" variant="primary" icon={Plus} onClick={deschide}>
            Adaugă robot
          </Btn>
        }
      />

      <Card className="overflow-hidden p-0">
        {eroare ? (
          <EroareCitire title="Roboții nu s-au putut citi" message={eroare} />
        ) : dispozitive.length === 0 ? (
          <EmptyState
            icon={Cpu}
            title="Niciun robot conectat"
            text="Adaugă un robot și pune tokenul de acces pe calculatorul lui. Tokenul se arată o singură dată."
            action={
              <Btn size="sm" variant="primary" onClick={deschide}>
                Adaugă robot
              </Btn>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    <th scope="col" className="py-2.5 pl-4 pr-3 font-medium">
                      Nume
                    </th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">
                      Proprietar
                    </th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">
                      Stare
                    </th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">
                      Ce face acum
                    </th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">
                      Ultima activitate
                    </th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">
                      Firma curentă
                    </th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">
                      Site-uri azi / total
                    </th>
                    <th scope="col" className="py-2.5 pr-4 text-right font-medium">
                      Acțiune
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dispozitive.map((d) => (
                    <tr key={d.id} className="border-b border-border/70 last:border-0">
                      <td className="py-2.5 pl-4 pr-3 text-[12.5px] font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <Cpu className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                          {d.nume}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-[12px]">{d.proprietar}</td>
                      <td className="py-2.5 pr-3">
                        <RobotStare stare={stareRobot(d, acum)} />
                      </td>
                      <td className="min-w-[200px] max-w-[300px] py-2.5 pr-3">
                        <CeFace d={d} acum={acum} />
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-[12px] text-muted-foreground">
                        {d.ultima_activitate ? (
                          <time dateTime={d.ultima_activitate} title={dateTimeRo(d.ultima_activitate)}>
                            {relativeRo(d.ultima_activitate, acum)}
                          </time>
                        ) : (
                          "niciodată"
                        )}
                      </td>
                      <td className="max-w-[240px] py-2.5 pr-3 text-[12px]">
                        <FirmaCurenta d={d} acum={acum} scurt />
                      </td>
                      <td className="pu-num whitespace-nowrap py-2.5 pr-3 text-[12px]">
                        {num(d.site_uri_azi)} / {num(d.site_uri_total)}
                      </td>
                      <td className="py-2.5 pr-4 text-right">{buton(d)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-border xl:hidden">
              {dispozitive.map((d) => (
                <li key={d.id} className="space-y-2 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium">
                      <Cpu className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{d.nume}</span>
                    </span>
                    <RobotStare stare={stareRobot(d, acum)} />
                  </div>
                  <p className="text-[11.5px] text-muted-foreground">
                    {d.proprietar} · {d.ultima_activitate ? relativeRo(d.ultima_activitate, acum) : "niciodată activ"}
                  </p>
                  <CeFace d={d} acum={acum} />
                  <div className="flex gap-1 text-[11.5px]">
                    <span className="shrink-0 text-muted-foreground">construiește:</span>
                    <FirmaCurenta d={d} acum={acum} scurt />
                  </div>
                  <p className="pu-num text-[11.5px] text-muted-foreground">
                    {num(d.site_uri_azi)} azi / {num(d.site_uri_total)} total
                  </p>
                  {buton(d)}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <InlineNote tone="neutral">
        Cum vorbește robotul cu adminul (rutele, codurile de răspuns, exemplele): <code className="font-mono text-[11.5px] text-foreground">docs/prospectare-api.md</code>, în
        repo. Pe calculatorul robotului, tokenul stă în variabila de mediu <code className="font-mono text-[11.5px] text-foreground">MERIDIAN_ROBOT_TOKEN</code>, niciodată într-un
        fișier din repo.
      </InlineNote>

      <Modal open={deschis} onOpenChange={(v) => (v ? setDeschis(true) : inchide())} label={token ? `Tokenul robotului ${numeCreat}` : "Adaugă robot"}>
        <h2 className="text-[17px] font-semibold">{token ? `Tokenul robotului ${numeCreat}` : "Adaugă robot"}</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          {token
            ? "Copiază tokenul acum și pune-l pe calculatorul robotului. Nu se mai afișează după ce închizi fereastra."
            : "Dă-i un nume scurt, ca să știi ce calculator e. Tokenul de acces apare o singură dată."}
        </p>

        {token ? (
          <div className="mt-4 space-y-3">
            <code
              ref={tokenRef}
              tabIndex={0}
              aria-label="Tokenul robotului"
              className="block select-all break-all rounded-lg border border-border bg-secondary px-3 py-2.5 font-mono text-[12px] leading-relaxed"
            >
              {token}
            </code>
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton value={token} label="Copiază tokenul" clearAfter={120} />
              <span className="text-[11px] text-muted-foreground">Clipboardul se golește singur după 2 minute.</span>
            </div>
            <InlineNote tone="apricot" className="flex items-start gap-2">
              <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                Tokenul nu poate fi afișat din nou. Pune-l în variabila de mediu <code className="font-mono">MERIDIAN_ROBOT_TOKEN</code> a robotului, nu într-un fișier din repo și nu
                în chat. Dacă îl pierzi, dezactivează robotul și adaugă altul, cu alt nume.
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
              <span className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Nume robot</span>
              <input
                ref={numeRef}
                value={nume}
                onChange={(e) => {
                  setNume(e.target.value);
                  if (eroareNume) setEroareNume(null);
                }}
                placeholder="ex. robot-14"
                maxLength={80}
                autoComplete="off"
                aria-invalid={eroareNume ? true : undefined}
                aria-describedby={eroareNume ? "robot-nume-eroare" : "robot-nume-ajutor"}
                className={inputClass(`mt-1.5 ${eroareNume ? "border-rose/50" : ""}`)}
              />
              {eroareNume ? (
                <span id="robot-nume-eroare" role="alert" className="mt-1 block text-[11.5px] text-rose">
                  {eroareNume}
                </span>
              ) : (
                <span id="robot-nume-ajutor" className="mt-1 block text-[11.5px] text-muted-foreground/80">
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

      <ConfirmDialog
        open={deOprit !== null}
        onOpenChange={(v) => {
          if (!v) setDeOprit(null);
        }}
        title={deOprit ? `Dezactivezi ${deOprit.nume}?` : "Dezactivezi robotul?"}
        description="Robotul nu mai primește firme și nu mai poate raporta nimic până îl activezi din nou."
        consequence={
          deOprit
            ? `La următoarea cerere primește 401. ${
                deOprit.firma_curenta
                  ? `Firma lui de acum (#${deOprit.firma_curenta.nr} ${deOprit.firma_curenta.nume}) trece la alt robot când îi expiră rezervarea, ${untilRo(deOprit.firma_curenta.expira_la, acum)}.`
                  : "Nu are nicio firmă rezervată acum."
              }`
            : undefined
        }
        confirmLabel="Dezactivează"
        tone="danger"
        onConfirm={async () => {
          if (!deOprit) return;
          const d = deOprit;
          setComutId(d.id);
          const result = await comutaRobot({ id: d.id, activ: false });
          notify(result.message, result.ok ? undefined : "error");
          setComutId(null);
          router.refresh();
        }}
      />

      <p className="sr-only" aria-live="polite">
        {creez ? "Se generează tokenul." : comut ? "Se schimbă starea robotului." : ""}
      </p>
    </div>
  );
}
