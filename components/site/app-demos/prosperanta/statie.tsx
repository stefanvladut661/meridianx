"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleCheck, Fuel as FuelIcon, Search, Ticket, TriangleAlert } from "lucide-react";
import { dec, num } from "../kit";
import { C, FUELS, fuelLabel, fuelPrice, fuelWord, phoneMask, rewardById, short, type Customer, type Fuel } from "./data";
import { useDemo, type Tx } from "./store";
import { StaffShell } from "./staff";
import { Avatar, Btn, Card, CardHead, Label, MetricStrip, SW, inputCls, litri, nr } from "./ui";

/* ============================================================
   Panoul angajatului din stație: adaugă litri (puncte pentru
   client) și validează vouchere. Tot ce confirmi aici apare
   imediat în aplicația clientului și în fluxul adminului.
   Ecran tactil: ținte de minimum 44px, Enter caută și confirmă.
   ============================================================ */

type Mode = "litri" | "voucher";

const MODES = [
  { id: "litri", label: "Adaugă litri", icon: FuelIcon },
  { id: "voucher", label: "Validează voucher", icon: Ticket },
] as const;

const line = `1px solid ${C.border}`;

const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** „1 p/L”, „1,5 p/L” */
const perL = (v: number) => `${String(v).replace(".", ",")} p/L`;

export function Statie() {
  const { s, mobile, pickVoucher } = useDemo();
  const [mode, setMode] = useState<Mode>(s.pickVoucher ? "voucher" : "litri");
  const [initialCode] = useState(s.pickVoucher);

  /* codul adus din aplicația clientului se consumă o singură dată */
  useEffect(() => {
    if (s.pickVoucher) pickVoucher(null);
  }, [s.pickVoucher, pickVoucher]);

  const switcher = (
    <div role="tablist" aria-label="Operațiune" className="flex w-full gap-0.5 rounded-[8px] p-[3px]" style={{ background: C.muted }}>
      {MODES.map((t) => {
        const I = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={mode === t.id}
            onClick={() => setMode(t.id)}
            className="seg flex h-12 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[6px] text-[15px] font-semibold"
          >
            <I size={18} strokeWidth={SW} aria-hidden /> {t.label}
          </button>
        );
      })}
    </div>
  );

  const form = mode === "litri" ? <AddLitres key="l" /> : <ValidateVoucher key="v" initial={initialCode} />;

  return (
    <StaffShell face="angajat" screen="statie">
      <div className="prs-scroll absolute inset-0">
        {mobile ? (
          <main className="space-y-4 px-4 pb-10 pt-4">
            <div>
              <h1 className="text-[20px] font-semibold leading-tight">Calea Craiovei</h1>
              <p className="mt-0.5 text-[13px]" style={{ color: C.mutedFg }}>
                Tura 07–15 · Ionuț Dobre
              </p>
            </div>
            <ShiftStats compact />
            {switcher}
            {form}
            <ShiftFeed limit={5} />
          </main>
        ) : (
          <>
            <h1 className="sr-only">Panou angajat</h1>
            <main className="mx-auto grid max-w-[1216px] grid-cols-12 gap-6 px-6 pb-6 pt-6">
              <section className="col-span-7 space-y-4">
                {switcher}
                {form}
              </section>
              <aside className="col-span-5 space-y-4">
                <ShiftStats />
                <ShiftFeed limit={6} />
              </aside>
            </main>
          </>
        )}
      </div>
    </StaffShell>
  );
}

/* ---------------- tura: cifre + operațiuni ---------------- */

function ShiftStats({ compact = false }: { compact?: boolean }) {
  const { s } = useDemo();
  const b = s.shiftBase;
  return (
    <MetricStrip
      title={compact ? undefined : "Tura 07:00–15:00"}
      cols={compact ? 4 : 2}
      size={compact ? "md" : "lg"}
      items={[
        { label: "Operațiuni", value: num(b.ops) },
        { label: "Litri", value: num(b.litres) },
        { label: compact ? "Puncte" : "Puncte acordate", value: num(b.points) },
        { label: compact ? "Vouchere" : "Vouchere validate", value: num(b.vouchers) },
      ]}
    />
  );
}

function ShiftFeed({ limit }: { limit: number }) {
  const { s } = useDemo();
  return (
    <Card>
      <CardHead>Ultimele operațiuni</CardHead>
      <ul>
        {s.shift.slice(0, limit).map((t, i) => (
          <ShiftRow key={t.id} t={t} first={i === 0} />
        ))}
      </ul>
    </Card>
  );
}

function ShiftRow({ t, first }: { t: Tx; first: boolean }) {
  const v = t.kind === "voucher";
  return (
    <li className={`flex min-h-[48px] items-center gap-3 px-4 py-1.5 ${t.mine ? "a-flash" : ""}`} style={{ borderTop: first ? undefined : line }}>
      <span className="w-10 shrink-0 text-[12.5px]" style={{ color: C.mutedFg }}>
        {t.time}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium leading-snug">{t.name}</p>
        <p className="truncate text-[12.5px] leading-snug" style={{ color: C.mutedFg }}>
          {v ? "Voucher validat" : fuelLabel(t.fuel)}
        </p>
      </div>
      <div className="min-w-0 max-w-[50%] shrink-0 text-right">
        <p className="truncate text-[13.5px] font-medium leading-snug">{v ? t.reward : litri(t.litres, 2)}</p>
        {!v && (
          <p className="text-[12px] leading-snug" style={{ color: C.mutedFg }}>
            +{t.points} p
          </p>
        )}
      </div>
    </li>
  );
}

/** Confirmarea unei operațiuni: înlocuiește formularul și primește focusul. */
function Done({ title, children, actions }: { title: string; children: ReactNode; actions: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <Card className="a-fade p-5">
      <CircleCheck size={24} strokeWidth={SW} style={{ color: C.green }} aria-hidden />
      <h2 ref={ref} tabIndex={-1} className="mt-3 text-[18px] font-semibold outline-none">
        {title}
      </h2>
      {children}
      <div className="mt-5">{actions}</div>
    </Card>
  );
}

function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 text-[13px] font-medium" style={{ color: C.red }}>
      <TriangleAlert size={16} strokeWidth={SW} className="mt-0.5 shrink-0" aria-hidden /> {children}
    </p>
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
  const [done, setDone] = useState<{ name: string; id: number; points: number; litres: number; fuel: Fuel } | null>(null);

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

  const pick = (c: Customer) => {
    setCust(c);
    setErr(null);
  };

  const search = () => {
    if (!q.trim()) {
      setErr("Scrie numărul de telefon sau numele clientului.");
      return;
    }
    if (!matches.length) {
      setErr("Client negăsit. Verifică numărul sau roagă clientul să se înscrie din aplicație.");
      return;
    }
    pick(matches[0]);
  };

  const l = parseFloat(litres.replace(",", "."));
  const okL = l >= 1 && l <= 500;
  const pts = okL ? Math.floor(l * s.ppl[fuel]) : 0;

  /* butonul rămâne activ: ce lipsește se spune sub formular */
  const submit = () => {
    if (!live) return setErr("Alege întâi clientul.");
    if (!okL) return setErr("Introdu între 1 și 500 de litri.");
    const points = addFuel(live.id, fuel, Math.round(l * 100) / 100);
    setDone({ name: live.name, id: live.id, points, litres: l, fuel });
    setErr(null);
  };

  if (done)
    return (
      <Done
        title={nr(done.points, "punct adăugat", "puncte adăugate")}
        actions={
          <div className={`grid gap-3 ${done.id === 0 && !mobile ? "grid-cols-2" : "grid-cols-1"}`}>
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
              <Btn size="lg" variant="secondary" onClick={() => go("home")}>
                Vezi la client
              </Btn>
            )}
          </div>
        }
      >
        <p className="mt-0.5 text-[14px]">{done.name}</p>
        <p className="mt-1 text-[13px]" style={{ color: C.mutedFg }}>
          {litri(done.litres, 2)} {fuelWord(done.fuel)} · {dec(done.litres * fuelPrice(done.fuel))} lei
        </p>
      </Done>
    );

  return (
    <Card className={mobile ? "p-4" : "p-5"}>
      <div className="space-y-5">
        <div>
          <Label htmlFor="prs-phone">Client</Label>
          {live ? (
            <div className="flex items-center gap-3 rounded-[8px] py-2.5 pl-3 pr-2" style={{ border: line }}>
              <Avatar name={live.name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{live.name}</p>
                <p className="text-[13px]" style={{ color: C.mutedFg }}>
                  {phoneMask(live.tail)} · {nr(live.points, "punct", "puncte")}
                </p>
              </div>
              <button type="button" onClick={() => setCust(null)} className="link h-10 rounded-[6px] px-2 text-[13px]">
                Schimbă
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={17} strokeWidth={SW} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.mutedFg }} aria-hidden />
                  <input
                    id="prs-phone"
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setErr(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && search()}
                    placeholder="Telefon sau nume"
                    inputMode="search"
                    autoComplete="off"
                    className={`${inputCls} pl-9`}
                  />
                </div>
                <Btn variant="secondary" onClick={search}>
                  Caută
                </Btn>
              </div>
              {matches.length > 0 && (
                <ul className="mt-2 overflow-hidden rounded-[8px]" style={{ border: line }}>
                  {matches.map((c, i) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => pick(c)}
                        className="row flex min-h-[44px] w-full items-center justify-between gap-3 px-3 py-2 text-left"
                        style={{ borderTop: i ? line : undefined }}
                      >
                        <span className="truncate text-[14px] font-medium">{c.name}</span>
                        <span className="shrink-0 text-[12.5px]" style={{ color: C.mutedFg }}>
                          {phoneMask(c.tail)} · {num(c.points)} p
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="mr-0.5 text-[12.5px]" style={{ color: C.mutedFg }}>
                  Recenți:
                </span>
                {recent.map((c) => (
                  <button key={c.id} type="button" onClick={() => pick(c)} className="chip h-9 px-3 text-[13px] font-medium">
                    {short(c.name)} · …{c.tail}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <p id="prs-fuel" className="mb-1.5 text-[13px] font-medium">
            Combustibil
          </p>
          <div role="radiogroup" aria-labelledby="prs-fuel" className="flex w-full gap-0.5 rounded-[8px] p-[3px]" style={{ background: C.muted }}>
            {FUELS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={f.id === fuel}
                onClick={() => setFuel(f.id)}
                className="seg flex h-14 min-w-0 flex-1 flex-col items-center justify-center rounded-[6px]"
              >
                <span className="text-[15px] font-semibold" style={{ color: f.id === fuel ? C.fg : undefined }}>
                  {f.label}
                </span>
                <span className="text-[12px]" style={{ color: C.mutedFg }}>
                  {perL(s.ppl[f.id])}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="prs-litres">Litri</Label>
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
              autoComplete="off"
              className="field h-12 w-full min-w-0 rounded-[8px] bg-white px-3 text-[17px] font-semibold"
            />
            {(mobile ? ["20", "40"] : ["20", "35", "50"]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setLitres(v);
                  setErr(null);
                }}
                className="chip h-12 px-3.5 text-[14px] font-semibold"
              >
                {v} L
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-[8px] px-4 py-3" style={{ background: C.muted }}>
          <div>
            <p className="text-[12.5px]" style={{ color: C.mutedFg }}>
              Valoare bon
            </p>
            <p className="text-[16px] font-semibold">{okL ? `${dec(l * fuelPrice(fuel))} lei` : "—"}</p>
          </div>
          <div className="text-right">
            <p className="text-[12.5px]" style={{ color: C.mutedFg }}>
              Puncte
            </p>
            <p className="text-[22px] font-semibold leading-tight">{okL ? `+${num(pts)}` : "—"}</p>
          </div>
        </div>

        {err && <ErrorLine>{err}</ErrorLine>}

        <Btn size="lg" className="w-full" onClick={submit}>
          Confirmă alimentarea
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
    const t = c.trim().toUpperCase();
    const v = s.vouchers.find((x) => x.code === t);
    setFound(null);
    if (!t) return setErr("Scrie codul voucherului.");
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

  /* fără voucher găsit, butonul caută întâi codul: validarea cere un al
     doilea apăsat, cu voucherul și clientul la vedere */
  const validate = () => {
    if (!v || !owner) return lookup();
    consumeVoucher(v.code);
    setDone({ reward: rewardById(v.reward).title, name: owner.name });
  };

  if (done)
    return (
      <Done
        title="Voucher validat"
        actions={
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
        }
      >
        <p className="mt-0.5 text-[14px]">
          {done.reward} · {done.name}
        </p>
      </Done>
    );

  return (
    <Card className={mobile ? "p-4" : "p-5"}>
      <div className="space-y-5">
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
              onKeyDown={(e) => e.key === "Enter" && (v ? validate() : lookup())}
              placeholder="WASH-XXXXXXXX"
              autoComplete="off"
              spellCheck={false}
              className={`${inputCls} mono text-[15px]`}
            />
            <Btn variant="secondary" onClick={() => lookup()}>
              Caută
            </Btn>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-[12.5px]" style={{ color: C.mutedFg }}>
              Recente:
            </span>
            {hints.map((h) => (
              <button
                key={h.code}
                type="button"
                onClick={() => {
                  setCode(h.code);
                  lookup(h.code);
                }}
                className="chip mono h-9 px-2.5 text-[12.5px]"
              >
                {h.code}
              </button>
            ))}
          </div>
        </div>

        {v && owner && (
          <div className="a-in rounded-[8px] px-4 py-3" style={{ background: C.muted }}>
            <p className="text-[16px] font-semibold">{rewardById(v.reward).title}</p>
            <p className="mt-0.5 text-[13px]">
              {owner.name} · {phoneMask(owner.tail)}
            </p>
            <p className="text-[13px]" style={{ color: C.mutedFg }}>
              Valabil până pe {v.expires}
            </p>
          </div>
        )}

        {err && <ErrorLine>{err}</ErrorLine>}

        <Btn size="lg" className="w-full" onClick={validate}>
          Validează voucherul
        </Btn>
      </div>
    </Card>
  );
}
