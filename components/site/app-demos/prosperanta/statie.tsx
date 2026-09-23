"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Fuel as FuelIcon, Search, Ticket, UserRound, CircleCheck, TriangleAlert, Smartphone } from "lucide-react";
import { dec, num } from "../kit";
import { C, FUELS, fuelLabel, fuelPrice, phoneMask, rewardById, short, type Customer, type Fuel } from "./data";
import { useDemo } from "./store";
import { StaffShell } from "./staff";
import { Btn, Card, CardHead, Label, Roll, inputCls, inputStyle, litri } from "./ui";

/* ============================================================
   Panoul angajatului din stație: adaugă litri (puncte pentru
   client) și validează vouchere. Tot ce confirmi aici apare
   imediat în aplicația clientului și în fluxul adminului.
   ============================================================ */

type Mode = "litri" | "voucher";

const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function Statie() {
  const { s, mobile, pickVoucher } = useDemo();
  const [mode, setMode] = useState<Mode>(s.pickVoucher ? "voucher" : "litri");
  const [initialCode] = useState(s.pickVoucher);

  /* codul adus din aplicația clientului se consumă o singură dată */
  useEffect(() => {
    if (s.pickVoucher) pickVoucher(null);
  }, [s.pickVoucher, pickVoucher]);

  const switcher = (
    <div role="tablist" aria-label="Operațiune" className="grid grid-cols-2 gap-3">
      {(
        [
          { id: "litri", label: "Adaugă litri", icon: FuelIcon },
          { id: "voucher", label: "Validează voucher", icon: Ticket },
        ] as const
      ).map((t) => {
        const on = mode === t.id;
        const I = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => setMode(t.id)}
            className={`flex flex-col items-start rounded-[24px] text-left font-black uppercase transition-[background,color,box-shadow] duration-200 ${
              mobile ? "p-4 text-[14px]" : "p-5 text-[17px]"
            }`}
            style={
              on
                ? { background: C.red, color: "#fff", border: `2px solid ${C.red}`, boxShadow: C.shadow }
                : { background: "#fff", color: C.red, border: `2px solid ${C.red}` }
            }
          >
            <I size={mobile ? 26 : 32} strokeWidth={2.2} className="mb-2" />
            {t.label}
          </button>
        );
      })}
    </div>
  );

  const form = mode === "litri" ? <AddLitres key="l" /> : <ValidateVoucher key="v" initial={initialCode} />;

  return (
    <StaffShell face="angajat" screen="statie">
      {mobile ? (
        <div className="prs-scroll absolute inset-0">
          <main className="space-y-4 px-4 pb-10 pt-4">
            <div>
              <h1 className="text-[24px] font-black uppercase leading-none">Panou angajat</h1>
              <p className="mt-1.5 text-[13px]" style={{ color: C.mutedFg }}>
                Calea Craiovei · Tura 07–15 · Ionuț Dobre
              </p>
            </div>
            <ShiftStats compact />
            {switcher}
            {form}
            <ShiftFeed limit={5} />
          </main>
        </div>
      ) : (
        <div className="prs-scroll absolute inset-0">
          <main className="mx-auto grid max-w-[1216px] grid-cols-12 gap-6 px-6 pb-6 pt-6">
            <section className="col-span-7 space-y-4">
              <div className="flex items-end justify-between">
                <h1 className="text-[28px] font-black uppercase leading-none tracking-[-0.02em]">Panou angajat</h1>
                <p className="text-[13px]" style={{ color: C.mutedFg }}>
                  Ionuț Dobre · casa 2
                </p>
              </div>
              {switcher}
              {form}
            </section>
            <aside className="col-span-5 space-y-4">
              <ShiftStats />
              <ShiftFeed limit={8} />
            </aside>
          </main>
        </div>
      )}
    </StaffShell>
  );
}

/* ---------------- tura: cifre + operațiuni ---------------- */

function ShiftStats({ compact = false }: { compact?: boolean }) {
  const { s } = useDemo();
  const b = s.shiftBase;
  const items = [
    { l: "Operațiuni", v: <Roll value={b.ops} /> },
    { l: "Litri", v: <Roll value={b.litres} /> },
    { l: compact ? "Puncte" : "Puncte date", v: <Roll value={b.points} /> },
    { l: "Vouchere", v: <Roll value={b.vouchers} /> },
  ];
  if (compact)
    return (
      <div className="grid grid-cols-4 gap-2">
        {items.map((x) => (
          <div key={x.l} className="rounded-[14px] px-2.5 py-2" style={{ background: C.muted }}>
            <p className="truncate text-[9.5px] font-bold uppercase tracking-[0.06em]" style={{ color: C.mutedFg }}>
              {x.l}
            </p>
            <p className="text-[16px] font-black" style={{ color: C.red }}>
              {x.v}
            </p>
          </div>
        ))}
      </div>
    );
  return (
    <Card>
      <CardHead right={<span className="text-[12px] font-bold" style={{ color: C.mutedFg }}>de la 07:00</span>}>Tura mea</CardHead>
      <div className="grid grid-cols-2">
        {items.map((x, i) => (
          <div
            key={x.l}
            className="px-5 py-4"
            style={{ borderRight: i % 2 === 0 ? `2px solid ${C.border}` : undefined, borderTop: i > 1 ? `2px solid ${C.border}` : undefined }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: C.mutedFg }}>
              {x.l}
            </p>
            <p className="mt-1 text-[30px] font-black leading-none" style={{ color: C.red }}>
              {x.v}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ShiftFeed({ limit }: { limit: number }) {
  const { s } = useDemo();
  return (
    <Card>
      <CardHead right={<span className="text-[12px] font-bold" style={{ color: C.mutedFg }}>la stația ta</span>}>Ultimele operațiuni</CardHead>
      <ul>
        {s.shift.slice(0, limit).map((t, i) => (
          <li
            key={t.id}
            className={`flex items-center gap-3 px-5 py-3 ${t.mine ? "a-flash" : i === 0 ? "a-in" : ""}`}
            style={{ borderTop: i ? `1px solid ${C.border}` : undefined }}
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: t.kind === "voucher" ? "#FFF3E0" : "#FDECEE", color: t.kind === "voucher" ? "#B86E00" : C.red }}
            >
              {t.kind === "voucher" ? <Ticket size={16} strokeWidth={2.4} /> : <FuelIcon size={16} strokeWidth={2.4} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-bold">
                {t.name}
                {t.mine && (
                  <span className="ml-2 rounded-full px-1.5 py-0.5 text-[9.5px] font-black uppercase text-white" style={{ background: C.red }}>
                    tu
                  </span>
                )}
              </p>
              <p className="text-[12px]" style={{ color: C.mutedFg }}>
                {t.time} · {t.kind === "voucher" ? `voucher: ${t.reward}` : `${litri(t.litres, 2)} · ${fuelLabel(t.fuel)}`}
              </p>
            </div>
            <p className="shrink-0 text-[14px] font-black" style={{ color: t.kind === "voucher" ? "#B86E00" : C.red }}>
              {t.kind === "voucher" ? "validat" : `+${t.points}p`}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------- adaugă litri ---------------- */

function AddLitres() {
  const { s, mobile, addFuel, go } = useDemo();
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [cust, setCust] = useState<Customer | null>(null);
  const [fuel, setFuel] = useState<Fuel>("benzina");
  const [litres, setLitres] = useState("");
  const [done, setDone] = useState<{ name: string; id: number; points: number; litres: number; fuel: Fuel; time: string } | null>(null);

  const recent = useMemo(() => [s.customers[0], s.customers[7], s.customers[12]], [s.customers]);
  const live = cust ? s.customers.find((c) => c.id === cust.id) ?? cust : null;

  const matches = useMemo(() => {
    const t = norm(q.trim());
    if (t.length < 2) return [];
    const digits = t.replace(/\D/g, "");
    return s.customers
      .filter((c) => (digits.length >= 3 ? c.tail === digits.slice(-3) : norm(c.name).includes(t)))
      .slice(0, 4);
  }, [q, s.customers]);

  const search = () => {
    if (!q.trim()) {
      setErr("Scrie numărul de telefon sau numele clientului.");
      return;
    }
    if (!matches.length) {
      setErr("Client negăsit. Verifică numărul sau roagă clientul să se înscrie din aplicație.");
      return;
    }
    setCust(matches[0]);
    setErr(null);
  };

  const l = parseFloat(litres.replace(",", "."));
  const valid = !!live && l > 0 && l <= 500;
  const pts = valid ? Math.floor(l * s.ppl[fuel]) : 0;

  const submit = () => {
    if (!live) return setErr("Alege întâi clientul.");
    if (!(l > 0 && l <= 500)) return setErr("Cantitate invalidă: introdu între 1 și 500 de litri.");
    const points = addFuel(live.id, fuel, Math.round(l * 100) / 100);
    setDone({ name: live.name, id: live.id, points, litres: l, fuel, time: "acum" });
    setErr(null);
  };

  if (done)
    return (
      <div className="a-pop space-y-4">
        <div className="rounded-[24px] p-6 text-white" style={{ background: C.heroGrad, boxShadow: C.shadow }}>
          <div className="flex items-center gap-3">
            <CircleCheck size={28} strokeWidth={2.4} />
            <p className="text-[34px] font-black uppercase leading-none">+{done.points} puncte</p>
          </div>
          <p className="mt-2 text-[15px] opacity-95">Adăugate pentru {done.name}</p>
        </div>
        <p className="text-[13.5px]" style={{ color: C.mutedFg }}>
          {litri(done.litres, 2)} · {fuelLabel(done.fuel)} · Calea Craiovei · {dec(done.litres * fuelPrice(done.fuel))} lei · înregistrat acum
        </p>
        <div className={`grid gap-3 ${done.id === 0 ? "grid-cols-2" : "grid-cols-1"}`}>
          <Btn
            size="lg"
            onClick={() => {
              setDone(null);
              setCust(null);
              setQ("");
              setLitres("");
            }}
          >
            Operațiune nouă
          </Btn>
          {done.id === 0 && (
            <Btn size="lg" variant="outline" onClick={() => go("home")}>
              <Smartphone size={17} strokeWidth={2.4} /> Vezi la client
            </Btn>
          )}
        </div>
      </div>
    );

  return (
    <Card className={mobile ? "p-4" : "p-5"}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="prs-phone">Telefon client</Label>
          {live ? (
            <div className="flex items-center gap-3 rounded-[16px] p-3.5" style={{ border: `2px solid ${C.red}`, background: "#FFF8F8" }}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-white" style={{ background: C.red }}>
                <UserRound size={20} strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-black uppercase">{live.name}</p>
                <p className="text-[13px]" style={{ color: C.mutedFg }}>
                  {phoneMask(live.tail)} · <Roll value={live.points} /> puncte
                </p>
              </div>
              <button type="button" onClick={() => setCust(null)} className="rounded-full px-3 py-1.5 text-[12px] font-black uppercase" style={{ color: C.red }}>
                Schimbă
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: C.soft }} />
                  <input
                    id="prs-phone"
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setErr(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && search()}
                    placeholder="07xx xxx xxx sau nume"
                    inputMode="search"
                    autoComplete="off"
                    className={`${inputCls} pl-10`}
                    style={inputStyle}
                  />
                </div>
                <Btn onClick={search}>Caută</Btn>
              </div>
              {matches.length > 0 && (
                <ul className="mt-2 overflow-hidden rounded-[14px]" style={{ border: `2px solid ${C.border}` }}>
                  {matches.map((c, i) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setCust(c);
                          setErr(null);
                        }}
                        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left hover:bg-[#FAFAFA]"
                        style={{ borderTop: i ? `1px solid ${C.border}` : undefined }}
                      >
                        <span className="text-[14px] font-bold">{c.name}</span>
                        <span className="text-[12.5px]" style={{ color: C.mutedFg }}>
                          {phoneMask(c.tail)} · {num(c.points)} p
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[12px] font-bold" style={{ color: C.mutedFg }}>
                  La pompă acum:
                </span>
                {recent.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCust(c);
                      setErr(null);
                    }}
                    className="rounded-full px-3 py-1.5 text-[12.5px] font-bold transition-colors hover:bg-[#FDECEE]"
                    style={{ border: `1.5px solid ${C.border}` }}
                  >
                    {short(c.name)} · …{c.tail}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <Label>Tip combustibil</Label>
          <div className="grid grid-cols-3 gap-2">
            {FUELS.map((f) => {
              const on = f.id === fuel;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFuel(f.id)}
                  className="rounded-full px-3 py-2.5 text-[12.5px] font-black uppercase transition-colors"
                  style={on ? { background: C.red, color: "#fff", border: `2px solid ${C.red}` } : { background: "#fff", border: `2px solid ${C.border}` }}
                >
                  {f.label}
                  <span className="mt-0.5 block text-[10.5px] opacity-80">{String(s.ppl[f.id]).replace(".", ",")} p/L</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label htmlFor="prs-litres">Litri alimentați</Label>
          <div className="flex gap-2">
            <input
              id="prs-litres"
              value={litres}
              onChange={(e) => {
                setLitres(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6));
                setErr(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              inputMode="decimal"
              placeholder="0,00"
              className={`${inputCls} tnum text-[17px] font-bold`}
              style={inputStyle}
            />
            {(mobile ? ["20", "40"] : ["20", "35", "50"]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setLitres(v);
                  setErr(null);
                }}
                className="h-11 shrink-0 rounded-[12px] px-3 text-[13px] font-black"
                style={{ background: C.muted }}
              >
                {v} L
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-[16px] px-4 py-3" style={{ background: C.muted }}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: C.mutedFg }}>
              Valoare bon
            </p>
            <p className="tnum text-[16px] font-black">{valid ? `${dec(l * fuelPrice(fuel))} lei` : "—"}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: C.mutedFg }}>
              Puncte client
            </p>
            <p className="tnum text-[22px] font-black leading-tight" style={{ color: C.red }}>
              {valid ? `+${pts}` : "—"}
            </p>
          </div>
        </div>

        {err && (
          <p role="alert" className="flex items-start gap-2 text-[13px] font-bold" style={{ color: C.red }}>
            <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {err}
          </p>
        )}

        <Btn size="lg" className="w-full" disabled={!valid} onClick={submit}>
          Confirmă <ArrowRight size={17} strokeWidth={2.6} />
        </Btn>
      </div>
    </Card>
  );
}

/* ---------------- validează voucher ---------------- */

function ValidateVoucher({ initial }: { initial: string | null }) {
  const { s, mobile, consumeVoucher } = useDemo();
  const [code, setCode] = useState(initial ?? "");
  const [found, setFound] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ reward: string; name: string } | null>(null);

  const lookup = (c = code) => {
    const v = s.vouchers.find((x) => x.code === c.trim().toUpperCase());
    setFound(null);
    if (!v) return setErr("Voucher inexistent. Verifică codul literă cu literă.");
    if (v.status === "used") return setErr(`Voucher deja folosit${v.usedAt ? `, pe ${v.usedAt}` : ""}.`);
    if (v.status === "expired") return setErr(`Voucher expirat pe ${v.expires}. Clientul poate revendica altul din aplicație.`);
    setErr(null);
    setFound(v.code);
  };

  /* codul venit din aplicația clientului se caută singur */
  useEffect(() => {
    if (initial) lookup(initial);
    // doar la montare
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const v = found ? s.vouchers.find((x) => x.code === found) : null;
  const owner = v ? s.customers.find((c) => c.id === v.customer) : null;
  const hints = s.vouchers.filter((x) => x.status === "active").slice(0, mobile ? 3 : 4);

  if (done)
    return (
      <div className="a-pop space-y-4">
        <div className="rounded-[24px] p-6 text-white" style={{ background: C.heroGrad, boxShadow: C.shadow }}>
          <div className="flex items-center gap-3">
            <CircleCheck size={28} strokeWidth={2.4} />
            <p className="text-[28px] font-black uppercase leading-none">{done.reward}</p>
          </div>
          <p className="mt-2 text-[15px] opacity-95">Acordat lui {done.name}</p>
        </div>
        <p className="text-[13.5px]" style={{ color: C.mutedFg }}>
          Calea Craiovei · validat de Ionuț Dobre · voucherul nu mai poate fi folosit a doua oară
        </p>
        <Btn
          size="lg"
          className="w-full"
          onClick={() => {
            setDone(null);
            setFound(null);
            setCode("");
          }}
        >
          Operațiune nouă
        </Btn>
      </div>
    );

  return (
    <Card className={mobile ? "p-4" : "p-5"}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="prs-code">Cod voucher</Label>
          <div className="flex gap-2">
            <input
              id="prs-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setErr(null);
                setFound(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              placeholder="WASH-XXXXXXXX"
              autoComplete="off"
              className={`${inputCls} font-black tracking-[0.06em]`}
              style={inputStyle}
            />
            <Btn onClick={() => lookup()}>Caută</Btn>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[12px] font-bold" style={{ color: C.mutedFg }}>
              Coduri prezentate azi:
            </span>
            {hints.map((h) => (
              <button
                key={h.code}
                type="button"
                onClick={() => {
                  setCode(h.code);
                  lookup(h.code);
                }}
                className="rounded-full px-2.5 py-1.5 text-[11.5px] font-black tracking-[0.03em] transition-colors hover:bg-[#FDECEE]"
                style={{ border: `1.5px solid ${C.border}` }}
              >
                {h.code}
              </button>
            ))}
          </div>
        </div>

        {v && owner && (
          <div className="a-in rounded-[16px] p-4" style={{ border: `2px solid ${C.red}`, background: "#FFF8F8" }}>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: C.mutedFg }}>
              Recompensă
            </p>
            <p className="text-[18px] font-black uppercase">{rewardById(v.reward).title}</p>
            <p className="mt-1 text-[13.5px]">
              {owner.name} · {phoneMask(owner.tail)}
            </p>
            <p className="mt-1 text-[12.5px]" style={{ color: C.mutedFg }}>
              Cod {v.code} · valabil până pe {v.expires}
            </p>
          </div>
        )}

        {err && (
          <p role="alert" className="flex items-start gap-2 text-[13px] font-bold" style={{ color: C.red }}>
            <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {err}
          </p>
        )}

        <Btn
          size="lg"
          className="w-full"
          disabled={!v}
          onClick={() => {
            if (!v || !owner) return;
            consumeVoucher(v.code);
            setDone({ reward: rewardById(v.reward).title, name: owner.name });
          }}
        >
          Confirmă utilizare
        </Btn>
      </div>
    </Card>
  );
}
