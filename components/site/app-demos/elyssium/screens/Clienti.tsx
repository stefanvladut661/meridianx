"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Award, CalendarDays, Check, ChevronLeft, ChevronRight, FileText, Lock, Mail, Pencil, Phone, Plus, Search, Trash2, UserCheck } from "lucide-react";
import { num, rng } from "../../kit";
import {
  C,
  CATEGORII,
  ETICHETA_METODA,
  ETICHETA_TIP,
  PLANURI,
  STAFF_ALT,
  candRelativ,
  dataLunga,
  dataScurta,
  lume,
  lunaAn,
  ora,
  pluralZile,
  stareClient,
  subsActive,
  valabilPana,
  valabilPanaScurt,
  type Member,
  type Metoda,
  type Stare,
  type Sub,
} from "../data";
import { useDemo } from "../store";
import { AntetPagina, StaffShell } from "../shell";
import { Avatar, Btn, Card, Chip, ContorStaff, Dialog, Eticheta, H2, MONO, focus, useAnim } from "../ui";

/* ============================================================
   Clienți: căutare după nume, tag sau telefon, filtrele de stare,
   profilul complet și abonamentul nou „în două clicuri”.
   ============================================================ */

const PE_PAGINA = 25;
type Filtru = "" | Stare;
const FILTRE: { v: Filtru; eticheta: string }[] = [
  { v: "", eticheta: "Toți" },
  { v: "activ", eticheta: "Cu abonament activ" },
  { v: "expirat", eticheta: "Expirați" },
  { v: "nou", eticheta: "Fără niciun abonament" },
];

const fara = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function StareClient({ m }: { m: Member }) {
  const s = stareClient(m);
  if (s === "nou") return <Chip ton="auriu">NOU</Chip>;
  if (s === "activ") {
    const a = subsActive(m).sort((x, y) => y.exp - x.exp)[0];
    return (
      <span className="flex flex-col items-start gap-1">
        <Chip ton="succes">ACTIV</Chip>
        <span style={{ fontSize: 12.5, color: a.exp <= 7 ? "#B45309" : C.text2, fontWeight: a.exp <= 7 ? 600 : 400 }}>
          până pe {valabilPanaScurt(a.exp)} · {pluralZile(a.exp)}
        </span>
      </span>
    );
  }
  return (
    <span className="flex flex-col items-start gap-1">
      <Chip ton="eroare">EXPIRAT</Chip>
      {m.ultimulExpirat && <span style={{ fontSize: 12.5, color: C.text2 }}>din {dataScurta(m.ultimulExpirat.exp - 1)}</span>}
    </span>
  );
}

export default function Clienti() {
  const { st } = useDemo();
  return <StaffShell activ="clienti">{st.profil ? <Profil id={st.profil} /> : <Lista />}</StaffShell>;
}

/* ---------------- lista ---------------- */

function Lista() {
  const { st, getM, set, mobile } = useDemo();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filtru>("");
  const [p, setP] = useState(0);

  const toti = useMemo(() => {
    const L = lume();
    const lista = L.clienti.map((c) => st.over[c.id] ?? c);
    const cheie = (m: Member) => (m.ultima === null ? -1e7 : m.ultima * 100000 + (m.ultimaOra ?? 0));
    return lista.sort((a, b) => cheie(b) - cheie(a));
  }, [st.over]);

  const numarare = useMemo(() => {
    const n: Record<Stare, number> = { activ: 0, expirat: 0, nou: 0 };
    for (const m of toti) n[stareClient(m)]++;
    return n;
  }, [toti]);

  const filtrati = useMemo(() => {
    const t = fara(q.trim()).replace(/^#/, "");
    const cifre = t.replace(/\D/g, "");
    return toti.filter((m) => {
      if (f && stareClient(m) !== f) return false;
      if (!t) return true;
      if (fara(`${m.prenume} ${m.nume}`).includes(t) || m.cod.toLowerCase().includes(t)) return true;
      return cifre.length >= 3 && m.tel.replace(/\D/g, "").includes(cifre);
    });
  }, [toti, q, f]);

  const pagini = Math.max(1, Math.ceil(filtrati.length / PE_PAGINA));
  const pag = Math.min(p, pagini - 1);
  const vizibili = filtrati.slice(pag * PE_PAGINA, pag * PE_PAGINA + PE_PAGINA);
  const deschide = (id: string) => set({ profil: id, flash: null });

  const bara = (
    <div className={`flex ${mobile ? "flex-col" : "items-center"} mb-4 gap-3`}>
      <label className="relative block flex-1">
        <span className="sr-only">Caută clienți</span>
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2" color={C.text2} aria-hidden />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setP(0);
          }}
          placeholder="Caută după nume, tag sau telefon"
          className="w-full rounded-[12px] py-2.5 pl-10 pr-3 outline-none focus:[border-color:#4A2B7A]"
          style={{ border: `1.5px solid ${C.contur}`, fontSize: 15, background: C.card, color: C.text }}
        />
      </label>
      <div role="group" aria-label="Filtrează după stare" className={`flex gap-2 ${mobile ? "-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" : ""}`}>
        {FILTRE.map((x) => {
          const on = x.v === f;
          const n = x.v ? numarare[x.v] : toti.length;
          return (
            <button
              key={x.v || "toti"}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setF(x.v);
                setP(0);
              }}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 transition-colors ${focus}`}
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                background: on ? C.fMov : C.card,
                color: on ? C.mov : C.text2,
                boxShadow: `inset 0 0 0 1.5px ${on ? C.mov : C.contur}`,
              }}
            >
              {x.eticheta} <span style={{ fontWeight: 500, opacity: 0.8 }}>{num(n)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const paginare = (
    <div className="flex items-center justify-center gap-4 py-4">
      <Btn v="secundar" mic disabled={pag === 0} onClick={() => setP(pag - 1)} label="Pagina anterioară">
        <ChevronLeft size={16} />
      </Btn>
      <span style={{ fontSize: 13.5, color: C.text2, fontVariantNumeric: "tabular-nums" }}>
        {filtrati.length === 0 ? "0" : `${num(pag * PE_PAGINA + 1)}–${num(Math.min(filtrati.length, (pag + 1) * PE_PAGINA))}`} din {num(filtrati.length)}
      </span>
      <Btn v="secundar" mic disabled={pag >= pagini - 1} onClick={() => setP(pag + 1)} label="Pagina următoare">
        <ChevronRight size={16} />
      </Btn>
    </div>
  );

  const gol = (
    <div className="flex flex-col items-center gap-2 rounded-[16px] px-6 py-10 text-center" style={{ background: C.fundal, border: `1px dashed ${C.contur}` }}>
      <Search size={26} color={C.text2} />
      <p style={{ fontWeight: 600 }}>Niciun client cu „{q}”</p>
      <p style={{ fontSize: 14, color: C.text2 }}>Caută după prenume, după tag (fără #) sau după ultimele cifre ale telefonului.</p>
    </div>
  );

  if (mobile)
    return (
      <div>
        <AntetPagina titlu="Clienți" sub={`${num(toti.length)} de clienți · ${num(numarare.activ)} cu abonament activ`} />
        {bara}
        {vizibili.length === 0 ? (
          gol
        ) : (
          <ul className="flex flex-col gap-2">
            {vizibili.map((m0) => {
              const m = getM(m0.id);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => deschide(m.id)}
                    className={`flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-left ${focus}`}
                    style={{ background: C.card, border: `1px solid ${C.contur}` }}
                  >
                    <Avatar prenume={m.prenume} nume={m.nume} tint={m.tint} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate" style={{ fontSize: 15, fontWeight: 600 }}>
                        {m.prenume} {m.nume}
                      </span>
                      <span className="block truncate" style={{ fontSize: 12.5, color: C.text2 }}>
                        <span style={{ fontFamily: MONO }}>#{m.cod}</span> · {subsActive(m)[0]?.nume ?? (m.ultimulExpirat ? `fost ${m.ultimulExpirat.nume}` : "niciun abonament")}
                      </span>
                    </span>
                    <StareMica m={m} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {paginare}
      </div>
    );

  return (
    <div className="flex h-full flex-col px-6 pt-6">
      <AntetPagina titlu="Clienți" sub={`${num(toti.length)} de clienți · ${num(numarare.activ)} cu abonament activ acum`} />
      {bara}
      {vizibili.length === 0 ? (
        gol
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden rounded-[16px]" style={{ background: C.card, border: `1px solid ${C.contur}`, boxShadow: "0 4px 12px rgba(17,24,39,0.06)" }}>
          <div className="h-full overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#D1D5DB_transparent]">
            <table className="w-full border-collapse" style={{ fontSize: 14 }}>
              <thead className="sticky top-0 z-[1]" style={{ background: C.card }}>
                <tr>
                  {["Client", "Telefon", "Stare", "Abonament", "Vizite", "Ultima vizită"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: C.text2, borderBottom: `1px solid ${C.contur}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vizibili.map((m) => (
                  <tr key={m.id} className="cursor-pointer hover:bg-[#FAFAF8]" onClick={() => deschide(m.id)} style={{ opacity: stareClient(m) === "expirat" ? 0.78 : 1 }}>
                    <td className="px-4 py-2.5" style={{ borderBottom: `1px solid ${C.contur}` }}>
                      <button type="button" onClick={() => deschide(m.id)} className={`flex items-center gap-2.5 rounded-[8px] text-left ${focus}`}>
                        <Avatar prenume={m.prenume} nume={m.nume} tint={m.tint} />
                        <span>
                          <span className="block" style={{ fontWeight: 600 }}>
                            {m.prenume} {m.nume}
                          </span>
                          <span style={{ fontFamily: MONO, fontSize: 12, color: C.text2 }}>#{m.cod}</span>
                        </span>
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5" style={{ borderBottom: `1px solid ${C.contur}`, color: C.text2, fontVariantNumeric: "tabular-nums" }}>
                      {m.tel}
                    </td>
                    <td className="px-4 py-2.5" style={{ borderBottom: `1px solid ${C.contur}` }}>
                      <StareClient m={m} />
                    </td>
                    <td className="px-4 py-2.5" style={{ borderBottom: `1px solid ${C.contur}` }}>
                      {subsActive(m)[0]?.nume ?? <span style={{ color: C.text2 }}>{m.ultimulExpirat ? m.ultimulExpirat.nume : "—"}</span>}
                    </td>
                    <td className="px-4 py-2.5" style={{ borderBottom: `1px solid ${C.contur}`, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {m.vizite}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5" style={{ borderBottom: `1px solid ${C.contur}`, color: m.ultima === 0 ? C.succes : C.text2, fontWeight: m.ultima === 0 ? 600 : 400 }}>
                      {candRelativ(m.ultima, m.ultimaOra)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {paginare}
    </div>
  );
}

function StareMica({ m }: { m: Member }) {
  const s = stareClient(m);
  if (s === "nou") return <Chip ton="auriu">NOU</Chip>;
  if (s === "expirat") return <Chip ton="eroare">EXPIRAT</Chip>;
  const a = subsActive(m)[0];
  return (
    <span className="flex flex-col items-end gap-1">
      <Chip ton="succes">ACTIV</Chip>
      <span style={{ fontSize: 11.5, color: a.exp <= 7 ? "#B45309" : C.text2 }}>{pluralZile(a.exp)}</span>
    </span>
  );
}

/* ---------------- profilul ---------------- */

function vizite(m: Member, azi?: number) {
  const r = rng(parseInt(m.id.slice(1), 10) * 13 + 5);
  const out: { o: number; sec: number; tip: string; plan: string; manual?: boolean }[] = [];
  const sub = subsActive(m)[0];
  const tipuri = sub ? sub.contoare.map((c) => c.tip) : ["fitness" as const];
  const plan = sub?.nume ?? m.ultimulExpirat?.nume ?? "—";
  if (azi !== undefined) out.push({ o: 0, sec: azi, tip: ETICHETA_TIP[tipuri[0]], plan });
  let o = m.ultima !== null && m.ultima < 0 ? m.ultima : -1;
  for (let k = 0; k < 7 && m.vizite > k; k++) {
    out.push({ o, sec: (7.5 + r() * 13.5) * 3600, tip: ETICHETA_TIP[tipuri[Math.floor(r() * tipuri.length)]], plan, manual: r() < 0.08 });
    o -= 1 + Math.floor(r() * 3);
  }
  return out;
}

const BADGEURI = [1, 10, 25, 50, 100, 250];

function Profil({ id }: { id: string }) {
  const { getM, set, st, mobile, notify, scaneaza, go, rm } = useDemo();
  const a = useAnim();
  const m = getM(id);
  const s = stareClient(m);
  const active = subsActive(m);
  const flash = st.flash?.memberId === id ? st.flash.text : null;
  const jurnal = st.jurnal[id] ?? [];
  const ist = vizite(m, st.intrati[id]);
  const radacina = useRef<HTMLDivElement>(null);

  // profilul se deschide de sus, nu de unde rămăsese lista
  useEffect(() => {
    const cutie = radacina.current?.closest(".overflow-y-auto");
    if (cutie) cutie.scrollTop = 0;
  }, [id]);

  // după o vânzare, confirmarea și abonamentul nou trebuie să fie în vedere
  useEffect(() => {
    if (!flash) return;
    const cutie = radacina.current?.closest(".overflow-y-auto");
    if (cutie) cutie.scrollTo({ top: 0, behavior: rm ? "auto" : "smooth" });
  }, [flash, rm]);

  const antet = (
    <Card className="flex flex-wrap items-start gap-5" style={{ padding: mobile ? 18 : 24 }}>
      <Avatar prenume={m.prenume} nume={m.nume} tint={m.tint} size={mobile ? 60 : 72} />
      <div className="flex min-w-[220px] flex-1 flex-col gap-2">
        <h1 className="flex flex-wrap items-baseline gap-x-2" style={{ fontSize: mobile ? 22 : 26, fontWeight: 700, lineHeight: 1.2 }}>
          {m.prenume} {m.nume}
          <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 500, color: C.text2 }}>#{m.cod}</span>
        </h1>
        <div className="flex flex-wrap gap-1.5">
          {m.nrAbonamente > 0 ? <Chip ton="mov">RECURENT</Chip> : <Chip ton="auriu">NOU</Chip>}
          {s === "activ" ? <Chip ton="succes">ACTIV</Chip> : s === "expirat" ? <Chip ton="eroare">EXPIRAT</Chip> : null}
          {st.intrati[id] !== undefined && <Chip ton="neutru">în sală de la {ora(st.intrati[id])}</Chip>}
        </div>
        <dl className={`mt-2 grid gap-x-6 gap-y-3 ${mobile ? "grid-cols-2" : "grid-cols-4"}`}>
          {[
            [Phone, "Telefon", m.tel],
            [Mail, "Email", m.email],
            [CalendarDays, "Membru din", lunaAn(m.din)],
            [Award, "Vizite totale", `${m.vizite} · ${m.nrAbonamente} abonamente`],
          ].map(([Icon, l, v]) => {
            const I = Icon as typeof Phone;
            return (
              <div key={l as string} className="min-w-0">
                <dt className="flex items-center gap-1.5">
                  <I size={13} color={C.text2} />
                  <Eticheta style={{ fontSize: 11 }}>{l as string}</Eticheta>
                </dt>
                <dd className="break-words" style={{ fontSize: 14, fontWeight: 500 }}>
                  {v as string}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
      <div className={`flex gap-2 ${mobile ? "w-full" : "flex-col"}`}>
        <Btn onClick={() => set({ dialogSub: id })} lat={mobile}>
          <Plus size={16} /> Abonament nou
        </Btn>
        <Btn
          v="secundar"
          lat={mobile}
          onClick={() => {
            const sid = scaneaza(id, "manual");
            set({ openScan: sid, profil: null });
            go("receptie");
          }}
        >
          <UserCheck size={16} /> Check-in manual
        </Btn>
      </div>
    </Card>
  );

  const abonamente = (
    <Card className="flex flex-col gap-3.5">
      <H2 right={<span style={{ fontSize: 13, color: C.text2 }}>{active.length ? `${active.length} activ${active.length > 1 ? "e" : ""}` : ""}</span>}>Abonamente active</H2>
      {active.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[14px] px-4 py-6 text-center" style={{ background: C.fundal, border: `1px dashed ${C.contur}` }}>
          <p style={{ fontWeight: 600 }}>{m.ultimulExpirat ? `„${m.ultimulExpirat.nume}” a expirat pe ${valabilPana(m.ultimulExpirat.exp)}` : "Încă n-a cumpărat niciun abonament"}</p>
          <p style={{ fontSize: 13.5, color: C.text2 }}>Un abonament nou se creează în două clicuri și apare imediat pe telefonul clientului.</p>
          <Btn onClick={() => set({ dialogSub: id })} className="mt-1">
            <Plus size={16} /> Abonament nou
          </Btn>
        </div>
      ) : (
        active.map((x) => <CardAbonament key={x.id} x={x} nou={x.id.startsWith("v")} />)
      )}
    </Card>
  );

  const istoric = (
    <Card className="flex flex-col gap-2">
      <H2>Istoric vizite</H2>
      <ul className="flex flex-col">
        {ist.map((v, i) => (
          <li key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: i < ist.length - 1 ? `1px solid ${C.contur}` : undefined, fontSize: 14 }}>
            <span className="w-[112px] shrink-0" style={{ color: v.o === 0 ? C.succes : C.text, fontWeight: v.o === 0 ? 600 : 500 }}>
              {v.o === 0 ? "azi" : v.o === -1 ? "ieri" : dataScurta(v.o)}, {ora(v.sec)}
            </span>
            <span className="min-w-0 flex-1 truncate" style={{ color: C.text2 }}>
              {v.tip} pe „{v.plan}”
            </span>
            {v.manual && <Chip ton="neutru" mic>manual</Chip>}
          </li>
        ))}
        {ist.length === 0 && <li style={{ fontSize: 14, color: C.text2 }}>Nicio vizită încă. Prima scanare apare aici.</li>}
      </ul>
    </Card>
  );

  const badgeuri = (
    <Card className="flex flex-col gap-3">
      <H2>Badge-uri</H2>
      <div className="flex flex-wrap gap-2">
        {BADGEURI.map((t) => {
          const ok = m.vizite >= t;
          return (
            <span
              key={t}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{ background: ok ? C.fAuriu : C.dezactivat, color: ok ? "#86650A" : C.text2, fontSize: 13, fontWeight: 600 }}
            >
              {ok ? <Award size={14} /> : <Lock size={13} />}
              {t === 1 ? "Prima vizită" : `${t} de vizite`}
            </span>
          );
        })}
        {m.din <= -365 && (
          <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: C.fMov, color: C.mov, fontSize: 13, fontWeight: 600 }}>
            <Award size={14} /> Membru de 1 an
          </span>
        )}
      </div>
    </Card>
  );

  const online = active.filter((x) => x.metoda === "online");
  const facturi = (
    <Card className="flex flex-col gap-2">
      <H2>Facturi SmartBill</H2>
      {online.length === 0 ? (
        <p style={{ fontSize: 13.5, color: C.text2 }}>Abonamentele vândute la recepție se încasează cu bon fiscal. Facturile din aplicație apar aici.</p>
      ) : (
        online.map((x, i) => (
          <div key={x.id} className="flex items-center gap-3 py-1" style={{ fontSize: 14 }}>
            <FileText size={16} color={C.mov} />
            <span style={{ fontFamily: MONO, fontWeight: 600 }}>APP {String(688 - i * 37).padStart(4, "0")}</span>
            <span className="flex-1" style={{ color: C.text2 }}>
              {x.pret} lei · {dataScurta(x.start)}
            </span>
            <Chip ton="succes" mic>
              emisă
            </Chip>
            <button
              type="button"
              onClick={() => notify("În demo, PDF-ul facturii nu se descarcă. În aplicația reală se deschide documentul din SmartBill Cloud.")}
              className={`rounded-[8px] px-1.5 py-0.5 ${focus}`}
              style={{ fontSize: 13, fontWeight: 600, color: C.mov }}
            >
              PDF
            </button>
          </div>
        ))
      )}
    </Card>
  );

  const jurnalCard = (
    <Card className="flex flex-col gap-2">
      <H2>Jurnal de modificări</H2>
      <ul className="flex flex-col gap-2">
        {jurnal.map((j, i) => (
          <li key={i} className={`flex gap-2 ${i === 0 ? a("fadeUp") : ""}`} style={{ fontSize: 13.5 }}>
            <span className="mt-[7px] size-1.5 shrink-0 rounded-full" style={{ background: C.mov }} />
            <span>
              <b>{j.cine}</b> {j.text} <span style={{ color: C.text2 }}>· azi, {j.ora}</span>
            </span>
          </li>
        ))}
        {active.map((x) => (
          <li key={x.id} className="flex gap-2" style={{ fontSize: 13.5 }}>
            <span className="mt-[7px] size-1.5 shrink-0 rounded-full" style={{ background: C.contur }} />
            <span style={{ color: C.text2 }}>
              {x.metoda === "online" ? (
                <>
                  <b style={{ color: C.text }}>Clientul</b> a cumpărat „{x.nume}” din aplicație · plată Netopia · {dataScurta(x.start)}
                </>
              ) : (
                <>
                  <b style={{ color: C.text }}>{STAFF_ALT}</b> a creat „{x.nume}” · {ETICHETA_METODA[x.metoda].toLowerCase()} · {dataScurta(x.start)}
                </>
              )}
            </span>
          </li>
        ))}
        {jurnal.length === 0 && active.length === 0 && <li style={{ fontSize: 13.5, color: C.text2 }}>Nicio modificare în ultimele 30 de zile.</li>}
      </ul>
    </Card>
  );

  return (
    <div ref={radacina} className={mobile ? "" : "px-6 py-6"}>
      <button
        type="button"
        onClick={() => set({ profil: null, flash: null })}
        className={`mb-4 flex items-center gap-1.5 rounded-[8px] ${focus} hover:text-[#4A2B7A]`}
        style={{ fontSize: 14.5, fontWeight: 500, color: C.text2 }}
      >
        <ArrowLeft size={16} /> Clienți
      </button>
      <div className="flex flex-col gap-5">
        {antet}
        {flash && (
          <p role="status" className={`flex items-center gap-2 rounded-[12px] px-4 py-3 ${a("fadeUp")}`} style={{ background: C.fSucces, color: C.succes, border: "1px solid #BFE3DE", fontSize: 14, fontWeight: 500 }}>
            <Check size={17} strokeWidth={3} /> {flash}
          </p>
        )}
        {mobile ? (
          <>
            {abonamente}
            {istoric}
            {badgeuri}
            {facturi}
            {jurnalCard}
          </>
        ) : (
          <div className="grid grid-cols-[1fr_380px] items-start gap-5">
            <div className="flex flex-col gap-5">
              {abonamente}
              {istoric}
            </div>
            <div className="flex flex-col gap-5">
              {badgeuri}
              {facturi}
              {jurnalCard}
            </div>
          </div>
        )}
      </div>
      {st.dialogSub === id && <DialogAbonament m={m} />}
    </div>
  );
}

function CardAbonament({ x, nou }: { x: Sub; nou: boolean }) {
  const { notify } = useDemo();
  const a = useAnim();
  return (
    <div className={`flex flex-col gap-2.5 rounded-[14px] ${nou ? a("fadeUp") : ""}`} style={{ border: `1px solid ${nou ? C.succes : C.contur}`, padding: "14px 16px", background: nou ? "#F6FBFA" : C.card }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <strong style={{ fontSize: 16 }}>{x.nume}</strong>
        <span style={{ fontSize: 13, color: x.exp <= 7 ? "#B45309" : C.text2, fontWeight: x.exp <= 7 ? 600 : 400 }}>
          până pe {valabilPana(x.exp)} · încă {pluralZile(x.exp)}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {x.contoare.map((c) => (
          <ContorStaff key={c.tip} c={c} />
        ))}
        {x.interval && <Chip ton="neutru">{x.interval}</Chip>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span style={{ fontSize: 13, color: C.text2 }}>
          {x.metoda === "online" ? "Cumpărat online" : `Vândut la recepție · ${ETICHETA_METODA[x.metoda].toLowerCase()}`} · {x.pret} lei · început pe {dataLunga(x.start)}
        </span>
        <span className="flex gap-1">
          <Btn v="secundar" mic onClick={() => notify("În demo, editarea e oprită. În aplicația reală, orice corectură intră în jurnal: cine, când, ce s-a schimbat.")}>
            <Pencil size={13} /> Editează
          </Btn>
          <Btn v="textPericulos" mic onClick={() => notify("În demo, abonamentul nu se șterge. În aplicația reală, ștergerea cere confirmare și rămâne în jurnalul de modificări.")}>
            <Trash2 size={13} /> Șterge
          </Btn>
        </span>
      </div>
    </div>
  );
}

/* ---------------- abonament nou, în două clicuri ---------------- */

function DialogAbonament({ m }: { m: Member }) {
  const { set, vindeAbonament, mobile } = useDemo();
  const [plan, setPlan] = useState<string | null>(null);
  const [metoda, setMetoda] = useState<Metoda>("card_fizic");
  const p = PLANURI.find((x) => x.id === plan);
  const inchide = () => set({ dialogSub: null });

  return (
    <Dialog
      titlu={`Abonament nou pentru ${m.prenume}`}
      subtitlu={`Începe azi, ${dataLunga(0)} · valabil 30 de zile`}
      onClose={inchide}
      lat
      footer={
        <div className={`flex ${mobile ? "flex-col items-stretch" : "items-center justify-between"} gap-3`}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 13, color: C.text2 }}>Plata:</span>
            {(["card_fizic", "cash"] as Metoda[]).map((mt) => (
              <button
                key={mt}
                type="button"
                aria-pressed={metoda === mt}
                onClick={() => setMetoda(mt)}
                className={`rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold ${focus}`}
                style={{ background: metoda === mt ? C.fMov : C.card, color: metoda === mt ? C.mov : C.text2, boxShadow: `inset 0 0 0 1.5px ${metoda === mt ? C.mov : C.contur}` }}
              >
                {ETICHETA_METODA[mt]}
              </button>
            ))}
          </div>
          <Btn
            mare
            disabled={!p}
            onClick={() => {
              if (!p) return;
              vindeAbonament(m.id, p.id, metoda);
              set({ dialogSub: null });
            }}
          >
            {p ? `Creează abonamentul · ${p.pret} lei` : "Alege un abonament"}
          </Btn>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {CATEGORII.map((c) => (
          <div key={c.id} className={`flex ${mobile ? "flex-col gap-1.5" : "items-center gap-3"}`}>
            <span className="shrink-0" style={{ width: mobile ? undefined : 138, fontSize: 13.5, fontWeight: 600, color: C.text2 }}>
              {c.nume}
            </span>
            <div className="flex flex-1 flex-wrap gap-2">
              {PLANURI.filter((x) => x.cat === c.id).map((x) => {
                const on = plan === x.id;
                return (
                  <button
                    key={x.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPlan(x.id)}
                    className={`flex flex-1 flex-col items-start rounded-[12px] px-3 py-2 text-left transition-colors ${focus}`}
                    style={{ minWidth: 150, background: on ? C.fMov : C.card, boxShadow: `inset 0 0 0 ${on ? 2 : 1.5}px ${on ? C.mov : C.contur}` }}
                  >
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: on ? C.mov : C.text }}>{x.nume}</span>
                    <span style={{ fontSize: 12.5, color: C.text2 }}>
                      <b style={{ color: C.text }}>{x.pret} lei</b> · {x.contoare.map((k) => (k.n === null ? `${ETICHETA_TIP[k.tip]} nelimitat` : `${k.n} ${ETICHETA_TIP[k.tip]}`)).join(" + ")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
