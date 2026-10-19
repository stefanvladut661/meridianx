"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2, UserCheck } from "lucide-react";
import { num, rng } from "../../kit";
import {
  C,
  CATEGORII,
  ETICHETA_TIP,
  PLANURI,
  STAFF_ALT,
  candRelativ,
  dataScurta,
  lume,
  lunaAn,
  ora,
  pluralZile,
  stareClient,
  subsActive,
  valabilPanaScurt,
  type Member,
  type Metoda,
  type Stare,
  type Sub,
} from "../data";
import { useDemo } from "../store";
import { AntetPagina, StaffShell } from "../shell";
import { Avatar, Btn, CIFRE, Card, Chip, ContorStaff, Dialog, H2, Segmentat, campCls, campStil, focus, focusInterior } from "../ui";

/* ============================================================
   Clienți: căutare după nume, tag sau telefon, filtrele de stare,
   profilul complet și abonamentul nou vândut din profil.
   ============================================================ */

const PE_PAGINA = 25;
type Filtru = "toti" | Stare;
const FILTRE: { v: Filtru; eticheta: string }[] = [
  { v: "toti", eticheta: "Toți" },
  { v: "activ", eticheta: "Activi" },
  { v: "expirat", eticheta: "Expirați" },
  { v: "nou", eticheta: "Fără abonament" },
];

const METODA: Record<Metoda, string> = { online: "online", cash: "cash", card_fizic: "card fizic" };
const mare = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const fara = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** „Valabil până”: data, cu zilele rămase în chihlimbar când expiră în 7 zile. */
function ValabilPana({ m }: { m: Member }) {
  const s = stareClient(m);
  if (s === "nou") return <span style={{ color: C.text2 }}>Fără abonament</span>;
  if (s === "expirat")
    return (
      <span style={{ color: C.eroareText, ...CIFRE }}>
        {m.ultimulExpirat ? `${valabilPanaScurt(m.ultimulExpirat.exp)} · expirat` : "Expirat"}
      </span>
    );
  const a = subsActive(m).sort((x, y) => y.exp - x.exp)[0];
  return (
    <span style={CIFRE}>
      {valabilPanaScurt(a.exp)}
      {a.exp <= 7 && <span style={{ color: C.avertCerneala, fontWeight: 600 }}> · {pluralZile(a.exp)}</span>}
    </span>
  );
}

export default function Clienti() {
  const { st } = useDemo();
  return <StaffShell activ="clienti">{st.profil ? <Profil id={st.profil} /> : <Lista />}</StaffShell>;
}

/* ---------------- lista ---------------- */

function Lista() {
  const { st, set, mobile } = useDemo();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filtru>("toti");
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
      if (f !== "toti" && stareClient(m) !== f) return false;
      if (!t) return true;
      if (fara(`${m.prenume} ${m.nume}`).includes(t) || m.cod.toLowerCase().includes(t)) return true;
      return cifre.length >= 3 && m.tel.replace(/\D/g, "").includes(cifre);
    });
  }, [toti, q, f]);

  const pagini = Math.max(1, Math.ceil(filtrati.length / PE_PAGINA));
  const pag = Math.min(p, pagini - 1);
  const vizibili = filtrati.slice(pag * PE_PAGINA, pag * PE_PAGINA + PE_PAGINA);
  const deschide = (id: string) => set({ profil: id, flash: null });

  const filtre = (
    <Segmentat<Filtru>
      eticheta="Filtrează după stare"
      valoare={f}
      onChange={(v) => {
        setF(v);
        setP(0);
      }}
      optiuni={FILTRE.map((x) => ({
        v: x.v,
        eticheta: (
          <span className="flex items-baseline gap-1.5">
            {x.eticheta}
            <span style={{ fontWeight: 400, color: C.text2, ...CIFRE }}>{num(x.v === "toti" ? toti.length : numarare[x.v])}</span>
          </span>
        ),
      }))}
    />
  );

  const bara = (
    <div className={`flex ${mobile ? "flex-col gap-3" : "items-center gap-3"}`}>
      <label className="relative block min-w-0 flex-1">
        <span className="sr-only">Caută clienți</span>
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" color={C.text2} aria-hidden />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setP(0);
          }}
          placeholder="Caută după nume, tag sau telefon"
          className={`${campCls} py-2 pl-9 pr-3`}
          style={{ ...campStil, lineHeight: "22px" }}
        />
      </label>
      {mobile ? <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">{filtre}</div> : filtre}
    </div>
  );

  const paginare = (
    <div className="flex items-center justify-center gap-4 py-3">
      <Btn v="secundar" mic disabled={pag === 0} onClick={() => setP(pag - 1)} label="Pagina anterioară">
        <ChevronLeft size={16} aria-hidden />
      </Btn>
      <span style={{ fontSize: 13.5, color: C.text2, ...CIFRE }}>
        {filtrati.length === 0 ? "0" : `${num(pag * PE_PAGINA + 1)}–${num(Math.min(filtrati.length, (pag + 1) * PE_PAGINA))}`} din {num(filtrati.length)}
      </span>
      <Btn v="secundar" mic disabled={pag >= pagini - 1} onClick={() => setP(pag + 1)} label="Pagina următoare">
        <ChevronRight size={16} aria-hidden />
      </Btn>
    </div>
  );

  const gol = (
    <Card className="flex flex-col items-center gap-3 py-10 text-center">
      <p style={{ fontSize: 15, fontWeight: 600 }}>Niciun client cu „{q.trim()}”</p>
      <Btn
        v="secundar"
        onClick={() => {
          setQ("");
          setP(0);
        }}
      >
        Șterge căutarea
      </Btn>
    </Card>
  );

  if (mobile)
    return (
      <div className="flex flex-col gap-4">
        <AntetPagina titlu="Clienți" />
        {bara}
        {vizibili.length === 0 ? (
          gol
        ) : (
          <Card pad={false} className="overflow-hidden">
            <ul>
              {vizibili.map((m, i) => {
                const s = stareClient(m);
                const a = subsActive(m)[0];
                return (
                  <li key={m.id} style={{ borderTop: i ? `1px solid ${C.contur}` : undefined }}>
                    <button
                      type="button"
                      onClick={() => deschide(m.id)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-[#FAFAF8] ${focusInterior}`}
                    >
                      <Avatar prenume={m.prenume} nume={m.nume} tint={m.tint} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate" style={{ fontSize: 14.5, fontWeight: 600, lineHeight: "20px" }}>
                          {m.prenume} {m.nume}
                        </span>
                        <span className="block truncate" style={{ fontSize: 12.5, color: C.text2, lineHeight: "18px", ...CIFRE }}>
                          #{m.cod} · {a?.nume ?? m.ultimulExpirat?.nume ?? "fără abonament"}
                        </span>
                      </span>
                      {s === "activ" && a && (
                        <span
                          className="shrink-0"
                          style={{ fontSize: 13, color: a.exp <= 7 ? C.avertCerneala : C.text2, fontWeight: a.exp <= 7 ? 600 : 400, ...CIFRE }}
                        >
                          {pluralZile(a.exp)}
                        </span>
                      )}
                      {s === "expirat" && (
                        <span className="shrink-0" style={{ fontSize: 13, color: C.eroareText, fontWeight: 600 }}>
                          Expirat
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
        {vizibili.length > 0 && paginare}
      </div>
    );

  const th = { fontSize: 12.5, fontWeight: 500, color: C.text2, borderBottom: `1px solid ${C.contur}`, background: C.card } as const;
  return (
    <div className="flex h-full flex-col gap-4 px-6 pt-6">
      <AntetPagina titlu="Clienți" />
      {bara}
      {vizibili.length === 0 ? (
        gol
      ) : (
        <Card pad={false} className="min-h-0 flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#D1D5DB_transparent]">
            <table className="w-full border-collapse" style={{ fontSize: 14 }}>
              <thead className="sticky top-0 z-[1]">
                <tr>
                  <th className="whitespace-nowrap py-2.5 pl-4 pr-3 text-left" style={th}>
                    Client
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-left" style={th}>
                    Telefon
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-left" style={th}>
                    Valabil până
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-left" style={th}>
                    Abonament
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right" style={th}>
                    Vizite
                  </th>
                  <th className="whitespace-nowrap py-2.5 pl-3 pr-4 text-left" style={th}>
                    Ultima vizită
                  </th>
                </tr>
              </thead>
              <tbody>
                {vizibili.map((m, i) => {
                  const b = i === vizibili.length - 1 ? undefined : `1px solid ${C.contur}`;
                  const a = subsActive(m)[0];
                  return (
                    <tr key={m.id} className="cursor-pointer transition-colors duration-150 hover:bg-[#FAFAF8]" onClick={() => deschide(m.id)}>
                      <td className="py-2 pl-4 pr-3" style={{ borderBottom: b }}>
                        <button type="button" onClick={() => deschide(m.id)} className={`flex items-center gap-2.5 rounded-[6px] text-left ${focus}`}>
                          <Avatar prenume={m.prenume} nume={m.nume} tint={m.tint} size={32} />
                          <span>
                            <span className="block" style={{ fontWeight: 600, lineHeight: "20px" }}>
                              {m.prenume} {m.nume}
                            </span>
                            <span className="block" style={{ fontSize: 12.5, color: C.text2, lineHeight: "18px", ...CIFRE }}>
                              #{m.cod}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2" style={{ borderBottom: b, color: C.text2, ...CIFRE }}>
                        {m.tel}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2" style={{ borderBottom: b }}>
                        <ValabilPana m={m} />
                      </td>
                      <td className="px-3 py-2" style={{ borderBottom: b, color: a ? C.text : C.text2 }}>
                        {a?.nume ?? m.ultimulExpirat?.nume ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right" style={{ borderBottom: b, ...CIFRE }}>
                        {num(m.vizite)}
                      </td>
                      <td className="whitespace-nowrap py-2 pl-3 pr-4" style={{ borderBottom: b, ...CIFRE }}>
                        {candRelativ(m.ultima, m.ultimaOra)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {vizibili.length > 0 ? paginare : <div className="flex-1" />}
    </div>
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

const PRAGURI = [1, 10, 25, 50, 100, 250];

/** „Prima vizită, 10 și 25 de vizite”, cu „de” după ultimul număr, ca în română. */
function insigne(vizite: number) {
  const luate = PRAGURI.filter((t) => vizite >= t);
  const numere = luate.filter((t) => t > 1);
  const parti: string[] = [];
  if (luate.includes(1)) parti.push("Prima vizită");
  if (numere.length) {
    const ultim = numere[numere.length - 1];
    const lista = numere.length === 1 ? `${ultim}` : `${numere.slice(0, -1).join(", ")} și ${ultim}`;
    parti.push(`${lista} ${ultim >= 20 ? "de " : ""}vizite`);
  }
  const text = parti.length === 2 && numere.length > 1 ? `${parti[0]}, ${parti[1]}` : parti.join(" și ");
  const urm = PRAGURI.find((t) => vizite < t);
  return { text, urm };
}

function Profil({ id }: { id: string }) {
  const { getM, set, st, mobile, notify, scaneaza, go, rm } = useDemo();
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

  const info: [string, string][] = [
    ["Telefon", m.tel],
    ["Email", m.email],
    ["Membru din", lunaAn(m.din)],
    ["Istoric", `${num(m.vizite)} ${m.vizite === 1 ? "vizită" : "vizite"}, ${m.nrAbonamente} ${m.nrAbonamente === 1 ? "abonament" : "abonamente"}`],
  ];

  const antet = (
    <Card className="flex flex-wrap items-start gap-x-5 gap-y-4" style={{ padding: mobile ? 16 : 20 }}>
      <Avatar prenume={m.prenume} nume={m.nume} tint={m.tint} size={mobile ? 52 : 64} />
      <div className="flex min-w-[220px] flex-1 flex-col">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h1 style={{ fontSize: mobile ? 22 : 24, fontWeight: 600, lineHeight: 1.25, letterSpacing: "-0.01em" }}>
            {m.prenume} {m.nume}
          </h1>
          <span style={{ fontSize: 13, color: C.text2, ...CIFRE }}>#{m.cod}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {s === "activ" ? <Chip ton="succes">Activ</Chip> : s === "expirat" ? <Chip ton="eroare">Expirat</Chip> : <Chip ton="auriu">Client nou</Chip>}
          {st.intrati[id] !== undefined && <span style={{ fontSize: 13, color: C.text2, ...CIFRE }}>În sală de la {ora(st.intrati[id])}</span>}
        </div>
        <dl className={`mt-4 grid gap-x-6 gap-y-3 ${mobile ? "grid-cols-2" : "grid-cols-4"}`}>
          {info.map(([l, v]) => (
            <div key={l} className="min-w-0">
              <dt style={{ fontSize: 12.5, color: C.text2 }}>{l}</dt>
              <dd className="break-words" style={{ fontSize: 14, ...CIFRE }}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className={`flex gap-2 ${mobile ? "w-full" : "flex-col"}`}>
        <Btn onClick={() => set({ dialogSub: id })} className={mobile ? "flex-1" : undefined}>
          <Plus size={16} aria-hidden /> Abonament nou
        </Btn>
        <Btn
          v="secundar"
          className={mobile ? "flex-1" : undefined}
          onClick={() => {
            const sid = scaneaza(id, "manual");
            set({ openScan: sid, profil: null });
            go("receptie");
          }}
        >
          <UserCheck size={16} aria-hidden /> Check-in manual
        </Btn>
      </div>
    </Card>
  );

  const abonamente = (
    <Card className="flex flex-col">
      <H2 right={active.length > 1 ? `${active.length} active` : undefined}>Abonamente active</H2>
      {active.length === 0 ? (
        <div className="flex flex-col items-start gap-3 pt-3">
          <p style={{ fontSize: 14, color: C.text2 }}>
            {m.ultimulExpirat ? `„${m.ultimulExpirat.nume}”, valabil până pe ${valabilPanaScurt(m.ultimulExpirat.exp)}` : "Niciun abonament"}
          </p>
          <Btn onClick={() => set({ dialogSub: id })}>
            <Plus size={16} aria-hidden /> Abonament nou
          </Btn>
        </div>
      ) : (
        active.map((x, i) => <BlocAbonament key={x.id} x={x} primul={i === 0} />)
      )}
    </Card>
  );

  const istoric = (
    <Card className="flex flex-col">
      <H2>Istoric vizite</H2>
      {ist.length === 0 ? (
        <p className="pt-2" style={{ fontSize: 14, color: C.text2 }}>
          Nicio vizită
        </p>
      ) : (
        <ul className="mt-1.5">
          {ist.map((v, i) => (
            <li key={i} className="flex items-center gap-3 py-2" style={{ borderTop: i ? `1px solid ${C.contur}` : undefined, fontSize: 14 }}>
              <span className="w-[108px] shrink-0" style={CIFRE}>
                {v.o === 0 ? "azi" : v.o === -1 ? "ieri" : dataScurta(v.o)}, {ora(v.sec)}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {mare(v.tip)} <span style={{ color: C.text2 }}>· {v.plan}</span>
              </span>
              {v.manual && <span style={{ fontSize: 12.5, color: C.text2 }}>manual</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  const ins = insigne(m.vizite);
  const insigneCard = (
    <Card className="flex flex-col gap-1">
      <H2>Insigne</H2>
      <p style={{ fontSize: 14, marginTop: 4 }}>
        {ins.text || "Nicio insignă"}
        {m.din <= -365 && ins.text ? ", 1 an ca membru" : ""}
      </p>
      {ins.urm && (
        <p style={{ fontSize: 13, color: C.text2, ...CIFRE }}>
          Următoarea: {ins.urm === 1 ? "prima vizită" : `${ins.urm} ${ins.urm >= 20 ? "de " : ""}vizite`}
        </p>
      )}
    </Card>
  );

  const online = active.filter((x) => x.metoda === "online");
  const facturi = (
    <Card className="flex flex-col">
      <H2>Facturi</H2>
      {online.length === 0 ? (
        <p className="pt-2" style={{ fontSize: 14, color: C.text2 }}>
          Nicio factură online
        </p>
      ) : (
        <ul className="mt-1.5">
          {online.map((x, i) => {
            const nr = `APP ${String(688 - i * 37).padStart(4, "0")}`;
            return (
              <li key={x.id} className="flex items-center gap-3 py-1.5" style={{ fontSize: 14, borderTop: i ? `1px solid ${C.contur}` : undefined, ...CIFRE }}>
                <span className="flex-1">
                  <span style={{ fontWeight: 600 }}>{nr}</span>
                  <span style={{ color: C.text2 }}>
                    {" "}
                    · {x.pret} lei · {dataScurta(x.start)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => notify("PDF-ul nu se descarcă în demo.")}
                  aria-label={`PDF-ul facturii ${nr}`}
                  className={`rounded-[6px] px-1.5 py-0.5 hover:bg-[#EFEAF7] ${focus}`}
                  style={{ fontSize: 13, fontWeight: 600, color: C.mov }}
                >
                  PDF
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );

  const jurnalCard = (
    <Card className="flex flex-col gap-2">
      <H2>Jurnal de modificări</H2>
      <ul className="flex flex-col gap-2" style={{ fontSize: 13.5, lineHeight: 1.45 }}>
        {jurnal.map((j, i) => (
          <li key={i}>
            <span style={{ fontWeight: 600 }}>{j.cine}</span> {j.text} <span style={{ color: C.text2, ...CIFRE }}>· azi, {j.ora}</span>
          </li>
        ))}
        {/* abonamentele vândute în demo („v…”) sunt deja în jurnal, mai sus */}
        {active
          .filter((x) => !x.id.startsWith("v"))
          .map((x) => (
          <li key={x.id} style={{ color: C.text2 }}>
            {x.metoda === "online" ? (
              <>
                <span style={{ color: C.text, fontWeight: 600 }}>Clientul</span> a cumpărat „{x.nume}” din aplicație · plată Netopia · {dataScurta(x.start)}
              </>
            ) : (
              <>
                <span style={{ color: C.text, fontWeight: 600 }}>{STAFF_ALT}</span> a creat „{x.nume}” · {METODA[x.metoda]} · {dataScurta(x.start)}
              </>
            )}
          </li>
        ))}
        {jurnal.length === 0 && active.length === 0 && <li style={{ color: C.text2 }}>Nicio modificare în ultimele 30 de zile</li>}
      </ul>
    </Card>
  );

  return (
    <div ref={radacina} className={mobile ? "" : "px-6 py-6"}>
      <button
        type="button"
        onClick={() => set({ profil: null, flash: null })}
        className={`mb-4 flex items-center gap-1.5 rounded-[6px] transition-colors duration-150 hover:text-[#4A2B7A] ${focus}`}
        style={{ fontSize: 14, fontWeight: 500, color: C.text2Tare }}
      >
        <ArrowLeft size={16} aria-hidden /> Clienți
      </button>
      <div className={`flex flex-col ${mobile ? "gap-4" : "gap-5"}`}>
        {antet}
        {flash && (
          <p role="status" className="flex items-center gap-2 rounded-[8px] px-3.5 py-2.5" style={{ background: C.fSucces, color: C.succes, fontSize: 14, fontWeight: 500 }}>
            <Check size={16} strokeWidth={2.5} aria-hidden /> {flash}
          </p>
        )}
        {mobile ? (
          <>
            {abonamente}
            {istoric}
            {insigneCard}
            {facturi}
            {jurnalCard}
          </>
        ) : (
          <div className="grid grid-cols-[1fr_360px] items-start gap-5">
            <div className="flex flex-col gap-5">
              {abonamente}
              {istoric}
            </div>
            <div className="flex flex-col gap-5">
              {insigneCard}
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

function BlocAbonament({ x, primul }: { x: Sub; primul: boolean }) {
  const { notify } = useDemo();
  const curand = x.exp <= 7;
  return (
    <div className="flex flex-col gap-2.5" style={{ borderTop: primul ? undefined : `1px solid ${C.contur}`, padding: primul ? "12px 0 2px" : "14px 0 2px", marginTop: primul ? 0 : 12 }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span style={{ fontSize: 15, fontWeight: 600 }}>{x.nume}</span>
        <span style={{ fontSize: 13, color: curand ? C.avertCerneala : C.text2, fontWeight: curand ? 600 : 400, ...CIFRE }}>
          până pe {valabilPanaScurt(x.exp)} · {pluralZile(x.exp)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {x.contoare.map((c) => (
          <ContorStaff key={c.tip} c={c} />
        ))}
        {x.interval && <span style={{ fontSize: 13, color: C.text2 }}>{x.interval}</span>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span style={{ fontSize: 13, color: C.text2, ...CIFRE }}>
          {x.pret} lei · {METODA[x.metoda]} · din {dataScurta(x.start)}
        </span>
        <span className="flex gap-1">
          <Btn v="fantoma" mic onClick={() => notify("Editarea e oprită în demo.")}>
            <Pencil size={13} aria-hidden /> Editează
          </Btn>
          <Btn v="textPericulos" mic onClick={() => notify("Ștergerea e oprită în demo.")}>
            <Trash2 size={13} aria-hidden /> Șterge
          </Btn>
        </span>
      </div>
    </div>
  );
}

/* ---------------- abonament nou ---------------- */

function DialogAbonament({ m }: { m: Member }) {
  const { set, vindeAbonament, mobile } = useDemo();
  const [plan, setPlan] = useState<string | null>(null);
  const [metoda, setMetoda] = useState<Metoda>("card_fizic");
  const p = PLANURI.find((x) => x.id === plan);
  const inchide = () => set({ dialogSub: null });

  return (
    <Dialog
      titlu={`Abonament nou pentru ${m.prenume}`}
      subtitlu={`${dataScurta(0)} – ${dataScurta(29)}`}
      onClose={inchide}
      lat
      footer={
        <div className={`flex ${mobile ? "flex-col items-stretch" : "items-center justify-between"} gap-3`}>
          <div className="flex items-center gap-2.5">
            <span style={{ fontSize: 13.5, color: C.text2 }}>Plată</span>
            <Segmentat<Metoda>
              eticheta="Plată"
              valoare={metoda}
              onChange={setMetoda}
              optiuni={[
                { v: "card_fizic", eticheta: "Card fizic" },
                { v: "cash", eticheta: "Cash" },
              ]}
            />
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
          <div key={c.id} className={`flex ${mobile ? "flex-col gap-1.5" : "items-center gap-3"}`} role="group" aria-label={c.nume}>
            <span className="shrink-0" style={{ width: mobile ? undefined : 132, fontSize: 13.5, fontWeight: 500, color: C.text2Tare }}>
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
                    className={`flex flex-1 flex-col items-start rounded-[8px] px-3 py-2 text-left transition-colors duration-150 ${on ? "" : "hover:bg-[#FAFAF8]"} ${focus}`}
                    style={{ minWidth: 150, background: on ? C.fMov : C.card, boxShadow: `inset 0 0 0 ${on ? 1.5 : 1}px ${on ? C.mov : C.conturCamp}` }}
                  >
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: on ? C.mov : C.text }}>{x.nume}</span>
                    <span style={{ fontSize: 12.5, color: C.text2, ...CIFRE }}>
                      <span style={{ color: C.text, fontWeight: 500 }}>{x.pret} lei</span> ·{" "}
                      {x.contoare.map((k) => (k.n === null ? `${ETICHETA_TIP[k.tip]} nelimitat` : `${k.n} ${ETICHETA_TIP[k.tip]}`)).join(" + ")}
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
