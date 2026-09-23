import { useMemo } from "react";
import { ArrowRight, Clock, TrendingUp } from "lucide-react";
import { BarChart, Donut, Sparkline, num, pct, useCountUp } from "../../kit";
import { useDemo } from "../ctx";
import { MASA_DUPA_ID, MESE, RESTAURANT, activa, fmtOra, statusuriLa, ultimele30 } from "../data";
import { ShellPanou } from "../shell";
import { FONT, L } from "../theme";
import { BadgeStatus, Btn, Card, cx } from "../ui";

/* ============================================================
   Acasă (§24.4) — pulsul zilei pentru cine tocmai a intrat în
   tură: câte rezervări, câți oameni, cât de plină e sala ACUM și,
   mai ales, dacă a rămas ceva netratat. Dedesubt, luna.
   ============================================================ */

const SURSE = [
  { id: "widget", text: "Pagina publică", culoare: L.chart1, parte: 0.58 },
  { id: "telefon", text: "Telefonic", culoare: L.chart2, parte: 0.19 },
  { id: "walk_in", text: "Walk-in", culoare: L.chart3, parte: 0.16 },
  { id: "manual", text: "Introdusă manual", culoare: L.chart4, parte: 0.07 },
];

function Kpi({
  eticheta,
  valoare,
  detaliu,
  accent,
  serie,
  culoare = L.primary,
}: {
  eticheta: string;
  valoare: string;
  detaliu?: string;
  accent?: boolean;
  serie?: number[];
  culoare?: string;
}) {
  return (
    <Card className="flex flex-col p-4">
      <p className="text-[12.5px]" style={{ color: L.mutedFg }}>
        {eticheta}
      </p>
      <p className="mt-1 text-[28px] font-semibold leading-none tabular-nums" style={{ color: accent ? L.ocupatText : L.fg, fontFamily: FONT.display }}>
        {valoare}
      </p>
      {detaliu && (
        <p className="mt-1.5 text-[12px]" style={{ color: L.mutedFg }}>
          {detaliu}
        </p>
      )}
      {serie && (
        <div className="mt-auto pt-2">
          <Sparkline values={serie} color={culoare} height={30} />
        </div>
      )}
    </Card>
  );
}

export function EcranAcasa() {
  const c = useDemo();
  const zile = useMemo(() => ultimele30(), []);
  const totalPers = zile.reduce((s, z) => s + z.persoane, 0);
  const totalRez = zile.reduce((s, z) => s + z.rezervari, 0);
  const animPers = useCountUp(totalPers, 1100, !c.reducedMotion);
  const animRez = useCountUp(totalRez, 1100, !c.reducedMotion);

  const azi = c.rez.filter((r) => r.status !== "respinsa");
  const persoaneAzi = c.rez
    .filter((r) => activa(r) || r.status === "sosita")
    .reduce((s, r) => s + r.pers, 0);
  const pending = c.rez.filter((r) => r.status === "pending").length;
  const { status } = statusuriLa(c.acum, c.rez);
  const meseActive = MESE.filter((m) => !m.indisponibila);
  const ocupate = meseActive.filter((m) => status[m.id] && status[m.id] !== "liber").length;
  const ocupare = Math.round((ocupate / meseActive.length) * 100);
  const walkIns = azi.filter((r) => r.sursa === "walk_in").length;

  const sosiri = c.rez
    .filter((r) => activa(r) && r.status !== "sosita" && r.start >= c.acum - 0.5)
    .sort((a, b) => a.start - b.start)
    .slice(0, 5);

  const peOre = useMemo(() => {
    const ore: number[] = [];
    for (let h = 12; h <= 23; h++) {
      const s = statusuriLa(h + 0.5, c.rez).status;
      ore.push(Math.round((meseActive.filter((m) => s[m.id] && s[m.id] !== "liber").length / meseActive.length) * 100));
    }
    return ore;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.rez]);

  const indexOraCurenta = Math.min(11, Math.max(0, Math.floor(c.acum) - 12));

  const alerta = pending > 0 && (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-2.5"
      style={{ border: `1px solid ${L.expirare}`, background: L.expirareSoft }}
    >
      <p className="text-[14px]">
        <span className="font-semibold tabular-nums">{pending}</span> {pending === 1 ? "cerere așteaptă" : "cereri așteaptă"} un răspuns.
      </p>
      <Btn m="sm" v="outline" onClick={() => c.go("rezervari")}>
        Vezi cererile
        <ArrowRight size={15} aria-hidden />
      </Btn>
    </div>
  );

  const kpiuri = (
    <div className={cx("grid gap-3", c.mobil ? "grid-cols-2" : "grid-cols-4")}>
      <Kpi eticheta="Rezervări azi" valoare={num(azi.length)} detaliu={`${walkIns} walk-in · ${pending} în așteptare`} serie={zile.slice(-14).map((z) => z.rezervari)} />
      <Kpi eticheta="Persoane așteptate" valoare={num(persoaneAzi)} detaliu="prânz și cină" serie={zile.slice(-14).map((z) => z.persoane)} culoare={L.chart3} />
      <Kpi eticheta="Ocupare acum" valoare={`${ocupare}%`} detaliu={`${ocupate} din ${meseActive.length} mese · ${fmtOra(c.acum)}`} />
      <Kpi eticheta="Neprezentări (7 zile)" valoare="3" accent detaliu="1 număr cu semnal roșu" />
    </div>
  );

  const luna = (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold" style={{ fontFamily: FONT.display }}>
            Ultimele 30 de zile
          </h2>
          <p className="text-[12.5px]" style={{ color: L.mutedFg }}>
            Persoane servite pe zi · vinerea și sâmbăta ies în față
          </p>
        </div>
        <div className="flex gap-5">
          <div>
            <p className="text-[22px] font-semibold leading-tight tabular-nums" style={{ fontFamily: FONT.display }}>
              {num(animPers)}
            </p>
            <p className="text-[12px]" style={{ color: L.mutedFg }}>
              persoane
            </p>
          </div>
          <div>
            <p className="text-[22px] font-semibold leading-tight tabular-nums" style={{ fontFamily: FONT.display }}>
              {num(animRez)}
            </p>
            <p className="text-[12px]" style={{ color: L.mutedFg }}>
              rezervări
            </p>
          </div>
          {!c.mobil && (
            <div>
              <p className="text-[22px] font-semibold leading-tight tabular-nums" style={{ fontFamily: FONT.display }}>
                {pct(2.1)}
              </p>
              <p className="text-[12px]" style={{ color: L.mutedFg }}>
                neprezentări
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3">
        <BarChart
          values={zile.map((z) => z.persoane)}
          labels={zile.map((z, i) => (i % 6 === 3 ? z.eticheta : ""))}
          color={L.primary}
          muted="#bfdbfe"
          highlight={29}
          height={c.mobil ? 130 : 150}
          labelColor={L.mutedFg}
          radius={3}
        />
      </div>
    </Card>
  );

  const surse = (
    <Card className="p-4">
      <h2 className="text-[15px] font-semibold" style={{ fontFamily: FONT.display }}>
        De unde vin rezervările
      </h2>
      <p className="text-[12.5px]" style={{ color: L.mutedFg }}>
        Ultimele 30 de zile
      </p>
      <div className="mt-3 flex items-center gap-4">
        <Donut parts={SURSE.map((s) => ({ value: s.parte, color: s.culoare }))} size={116} thickness={16} track={L.muted}>
          <span className="text-[19px] font-semibold tabular-nums leading-none" style={{ fontFamily: FONT.display }}>
            {num(totalRez)}
          </span>
          <span className="text-[11px]" style={{ color: L.mutedFg }}>
            rezervări
          </span>
        </Donut>
        <ul className="grid min-w-0 flex-1 gap-2">
          {SURSE.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-[13px]">
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.culoare }} />
              <span className="min-w-0 flex-1 truncate">{s.text}</span>
              <span className="font-medium tabular-nums">{num(totalRez * s.parte)}</span>
              <span className="w-9 text-right text-[12px] tabular-nums" style={{ color: L.mutedFg }}>
                {Math.round(s.parte * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px]" style={{ background: L.accent, color: L.accentFg }}>
        <TrendingUp size={14} aria-hidden />
        Fără comision pe niciuna: abonament fix.
      </p>
    </Card>
  );

  const listaSosiri = (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold" style={{ fontFamily: FONT.display }}>
        <Clock size={16} color={L.primary} aria-hidden />
        Următoarele sosiri
      </h2>
      {sosiri.length === 0 ? (
        <p className="mt-3 text-[13.5px]" style={{ color: L.mutedFg }}>
          Nicio rezervare care urmează. Un oaspete venit acum se înregistrează cu Walk-in, din Harta sălii.
        </p>
      ) : (
        <ul className="mt-3 grid gap-1.5">
          {sosiri.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  c.evidentiaza(r.id);
                  c.go("rezervari");
                }}
                className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-[13.5px] hover:bg-[#f8fafc]"
                style={{ borderColor: L.border }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="font-semibold tabular-nums">{fmtOra(r.start)}</span>
                  <span className="truncate font-medium">{r.nume}</span>
                  <BadgeStatus s={r.status} />
                </span>
                <span className="text-[12px]" style={{ color: L.mutedFg }}>
                  {r.pers} pers.{r.masa ? ` · masa ${MASA_DUPA_ID[r.masa].grup ? "V1+V2" : MASA_DUPA_ID[r.masa].numar}` : " · fără masă"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  const ocuparePeOre = (
    <Card className="p-4">
      <h2 className="text-[15px] font-semibold" style={{ fontFamily: FONT.display }}>
        Ocupare pe ore, azi
      </h2>
      <p className="text-[12.5px]" style={{ color: L.mutedFg }}>
        Vârful serii: {Math.max(...peOre)}% din mese, la {12 + peOre.indexOf(Math.max(...peOre))}:30
      </p>
      <div className="mt-3">
        <BarChart
          values={peOre.map((v) => Math.max(v, 2))}
          labels={peOre.map((_, i) => String(12 + i))}
          color={L.liber}
          muted="#a7f3d0"
          highlight={indexOraCurenta}
          height={c.mobil ? 120 : 136}
          labelColor={L.mutedFg}
          radius={3}
        />
      </div>
    </Card>
  );

  const titlu = (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight" style={{ fontFamily: FONT.display }}>
          {RESTAURANT.nume}
        </h1>
        <p className="text-[13.5px]" style={{ color: L.mutedFg }}>
          Cum arată ziua de azi.
        </p>
      </div>
    </div>
  );

  if (c.mobil) {
    return (
      <ShellPanou ecran="acasa">
        <div className="tx-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-3 p-4 pb-10">
            {titlu}
            {alerta}
            {kpiuri}
            {listaSosiri}
            {luna}
            {surse}
            {ocuparePeOre}
          </div>
        </div>
      </ShellPanou>
    );
  }

  return (
    <ShellPanou ecran="acasa">
      <div className="tx-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-4 p-6">
          <div className="grid items-end gap-4" style={{ gridTemplateColumns: "1fr auto" }}>
            {titlu}
            {alerta}
          </div>
          {kpiuri}
          <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1.65fr) minmax(0,1fr)" }}>
            {luna}
            {surse}
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1.65fr) minmax(0,1fr)" }}>
            {listaSosiri}
            {ocuparePeOre}
          </div>
        </div>
      </div>
    </ShellPanou>
  );
}
