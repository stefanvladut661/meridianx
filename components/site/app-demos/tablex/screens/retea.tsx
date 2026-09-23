import { useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CircleCheck,
  Coins,
  LifeBuoy,
  MessageSquare,
  Palette,
  PencilRuler,
  Settings,
  Ticket,
  TriangleAlert,
} from "lucide-react";
import { StatusBar, num, rng, useLiveFeed, useLiveNumber } from "../../kit";
import { useDemo } from "../ctx";
import { ORASE_RETEA, RESTAURANTE_RETEA, fmtOra, type Sursa } from "../data";
import { Logo } from "../shell";
import { FONT, L } from "../theme";
import { Btn, Card, Segmented, cx } from "../ui";

/* ============================================================
   Panoul echipei TableX (Super Admin · Overview, §39) — rețeaua
   întreagă: restaurante, abonamente, rezervări din toată țara,
   cererile de planuri 2D și starea serviciilor. Live.
   ============================================================ */

type Perioada = "azi" | "saptamana" | "luna" | "an";

const REZ_PERIOADA: Record<Perioada, number> = { azi: 1482, saptamana: 10216, luna: 42787, an: 386410 };
const CREDITE: Record<Perioada, number> = { azi: 40, saptamana: 180, luna: 740, an: 6920 };
const EVENIMENTE: Record<Perioada, number> = { azi: 1140, saptamana: 4980, luna: 18460, an: 164300 };

const SURSE: { id: Sursa; text: string; culoare: string; parte: number }[] = [
  { id: "widget", text: "Widget (aplicația noastră)", culoare: L.chart1, parte: 0.58 },
  { id: "manual", text: "Manual, de echipă", culoare: L.chart2, parte: 0.07 },
  { id: "walk_in", text: "Walk-in", culoare: L.chart3, parte: 0.16 },
  { id: "telefon", text: "Telefon", culoare: L.chart4, parte: 0.19 },
];

const SECTIUNI = [
  { text: "Overview", Icon: BarChart3 },
  { text: "Floor Plan Studio", Icon: Palette },
  { text: "Restaurante", Icon: Building2 },
  { text: "Finanțe", Icon: Coins },
  { text: "Comunicări", Icon: MessageSquare },
  { text: "Suport", Icon: Ticket },
  { text: "Setări", Icon: Settings },
];

const euro = (n: number) => `${num(n)} €`;

type Eveniment = { id: number; restaurant: string; oras: string; pers: number; ora: number; sursa: Sursa };

function fa(i: number): Eveniment {
  const r = rng(i * 7919 + 17);
  const rest = RESTAURANTE_RETEA[Math.floor(r() * RESTAURANTE_RETEA.length)];
  const x = r();
  return {
    id: i,
    restaurant: rest.nume,
    oras: rest.oras,
    pers: 2 + Math.floor(r() * 5),
    ora: 19.5 + Math.floor(r() * 7) / 2,
    sursa: x < 0.58 ? "widget" : x < 0.77 ? "telefon" : x < 0.93 ? "walk_in" : "manual",
  };
}

const ETICHETA_SURSA_SCURT: Record<Sursa, string> = {
  widget: "Widget",
  telefon: "Telefon",
  walk_in: "Walk-in",
  manual: "Manual",
};

/** Graficul radial al surselor, desenat de mână (RadialBar în produs). */
function Radial({ total, marime = 210 }: { total: number; marime?: number }) {
  const c = marime / 2;
  const grosime = 12;
  const pas = 15;
  return (
    <div className="relative shrink-0" style={{ width: marime, height: marime }}>
      <svg width={marime} height={marime} viewBox={`0 0 ${marime} ${marime}`} aria-hidden>
        {SURSE.map((s, i) => {
          const r = c - 8 - i * pas;
          const lung = 2 * Math.PI * r;
          const umplut = lung * (s.parte / 0.62);
          return (
            <g key={s.id} transform={`rotate(-90 ${c} ${c})`}>
              <circle cx={c} cy={c} r={r} fill="none" stroke={L.muted} strokeWidth={grosime} />
              <circle
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={s.culoare}
                strokeWidth={grosime}
                strokeLinecap="round"
                strokeDasharray={`${Math.min(umplut, lung - 1)} ${lung}`}
              />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="text-[11.5px] font-medium" style={{ color: L.mutedFg }}>
          Rezervări
        </span>
        <span className="text-[18px] font-semibold tabular-nums leading-tight" style={{ fontFamily: FONT.display }}>
          {num(total)}
        </span>
      </div>
    </div>
  );
}

export function EcranRetea() {
  const c = useDemo();
  const [perioada, setPerioada] = useState<Perioada>("luna");
  const feed = useLiveFeed<Eveniment>(
    Array.from({ length: 7 }, (_, i) => fa(1000 - i)),
    (i) => fa(2000 + i),
    2600,
    { max: 7, enabled: !c.reducedMotion }
  );
  const extra = feed[0].id >= 2000 ? feed[0].id - 1999 : 0;
  const totalLansare = useLiveNumber(412906, (v) => v + 1, 2600, !c.reducedMotion);
  const rezPerioada = REZ_PERIOADA[perioada] + extra;

  const notaSectiune = (text: string) =>
    c.notify(`În demo, doar Overview e deschis. În aplicația reală, „${text}” e o secțiune completă a panoului echipei TableX.`);

  const alerte = (
    <div className={cx("grid gap-3", c.mobil ? "grid-cols-1" : "grid-cols-3")}>
      {[
        { titlu: "Floor planuri de construit", n: 4, desc: "cereri nepreluate, plus 2 în lucru", Icon: PencilRuler, btn: "Studio" },
        { titlu: "Tichete suport", n: 2, desc: "așteaptă răspuns de la echipă", Icon: LifeBuoy, btn: "Suport" },
        { titlu: "Servicii cu probleme", n: 0, desc: "toate sistemele funcționează", Icon: TriangleAlert, btn: "" },
      ].map((a) => {
        const alerta = a.n > 0;
        return (
          <Card key={a.titlu} className="flex items-center gap-3 px-4 py-3.5" style={alerta ? { boxShadow: `0 0 0 1px rgba(245,158,11,.5)` } : undefined}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style={{ background: alerta ? L.expirareSoft : L.muted }}>
              <a.Icon size={19} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[19px] font-semibold tabular-nums">{a.n}</p>
              <p className="truncate text-[12px]" style={{ color: L.mutedFg }}>
                <span className="font-medium" style={{ color: L.fg }}>
                  {a.titlu}
                </span>{" "}
                · {a.desc}
              </p>
            </div>
            {a.btn && (
              <Btn m="xs" v="outline" onClick={() => notaSectiune(a.btn === "Studio" ? "Floor Plan Studio" : "Suport")}>
                {a.btn}
              </Btn>
            )}
          </Card>
        );
      })}
    </div>
  );

  const kpi = (
    <div className={cx("grid gap-3", c.mobil ? "grid-cols-2" : "grid-cols-4")}>
      {[
        ["MRR total", euro(1615), "149 × Start + 87 × Pro Floor"],
        ["Încasări credite WhatsApp", euro(CREDITE[perioada]), "pachete de 200–1.000 de mesaje"],
        ["Volum evenimente", euro(EVENIMENTE[perioada]), `din care comision TableX: ${euro(Math.round(EVENIMENTE[perioada] * 0.04))}`],
        ["Restaurante active", "236", "149 Start · 87 Pro Floor"],
      ].map(([t, v, d]) => (
        <Card key={t} className="px-4 py-3.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: L.mutedFg }}>
            {t}
          </p>
          <p className="mt-1 text-[24px] font-semibold leading-tight tabular-nums" style={{ fontFamily: FONT.display }}>
            {v}
          </p>
          <p className="mt-0.5 text-[12px]" style={{ color: L.mutedFg }}>
            {d}
          </p>
        </Card>
      ))}
    </div>
  );

  const activitate = (
    <Card className="p-4">
      <h2 className="text-[15px] font-semibold" style={{ fontFamily: FONT.display }}>
        Activitatea rezervărilor
      </h2>
      <p className="text-[12.5px]" style={{ color: L.mutedFg }}>
        Fără comision pe niciuna — restaurantele plătesc doar abonamentul.
      </p>
      <div className={cx("mt-3 flex items-center gap-6", c.mobil && "flex-col gap-4")}>
        <Radial total={rezPerioada} marime={c.mobil ? 190 : 200} />
        <ul className="grid w-full min-w-0 flex-1 gap-2.5">
          {SURSE.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-[13.5px]">
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.culoare }} />
              <span className="min-w-0 flex-1 truncate">{s.text}</span>
              <span className="font-medium tabular-nums">{num(rezPerioada * s.parte)}</span>
              <span className="w-10 text-right text-[12px] tabular-nums" style={{ color: L.mutedFg }}>
                {Math.round(s.parte * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );

  const lateral = (
    <div className="grid content-start gap-3">
      <Card className="px-4 py-3.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: L.mutedFg }}>
          Rezervări totale, de la lansare
        </p>
        <p className="mt-1 text-[26px] font-semibold leading-tight tabular-nums" style={{ fontFamily: FONT.display }}>
          {num(totalLansare)}
        </p>
        <p className="mt-0.5 text-[12px]" style={{ color: L.mutedFg }}>
          {num(rezPerioada * 0.58)} din widget în perioada aleasă
        </p>
      </Card>
      <Card className="px-4 py-3.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: L.mutedFg }}>
          Utilizatori activi
        </p>
        <p className="mt-1 text-[26px] font-semibold leading-tight tabular-nums" style={{ fontFamily: FONT.display }}>
          611
        </p>
        <p className="mt-0.5 text-[12px]" style={{ color: L.mutedFg }}>
          manageri și ospătari, ultimele 7 zile
        </p>
      </Card>
      <Card className="px-4 py-3">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: L.mutedFg }}>
          Starea serviciilor
        </p>
        {["Supabase — bază de date & API", "Stripe — plăți (simulat în v1)", "Meta WhatsApp — mesaje (simulat în v1)"].map((s) => (
          <p key={s} className="flex items-center gap-2 py-1 text-[12.5px]">
            <CircleCheck size={14} color={L.liber} aria-hidden className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{s}</span>
            <span className="text-[11.5px]" style={{ color: L.liberText }}>
              Funcțional
            </span>
          </p>
        ))}
      </Card>
    </div>
  );

  const flux = (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: L.border }}>
        <h2 className="flex items-center gap-2 text-[15px] font-semibold" style={{ fontFamily: FONT.display }}>
          <span aria-hidden className={cx("inline-block h-2 w-2 rounded-full", !c.reducedMotion && "tx-puls")} style={{ background: L.liber }} />
          Rezervări în rețea, acum
        </h2>
        <span className="text-[12px] tabular-nums" style={{ color: L.mutedFg }}>
          {num(REZ_PERIOADA.azi + extra)} azi
        </span>
      </div>
      <ul aria-live="off">
        {feed.map((e, i) => (
          <li
            key={e.id}
            className={cx("flex items-center gap-3 border-b px-4 py-2 last:border-0", i === 0 && e.id >= 2000 && !c.reducedMotion && "tx-anim-nou")}
            style={{ borderColor: L.border }}
          >
            <span className="w-11 shrink-0 text-[13px] font-semibold tabular-nums">{fmtOra(e.ora)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium">{e.restaurant}</span>
              <span className="block truncate text-[12px]" style={{ color: L.mutedFg }}>
                {e.oras} · {e.pers} persoane
              </span>
            </span>
            <span
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium"
              style={{ background: L.muted, color: SURSE.find((s) => s.id === e.sursa)!.culoare === L.chart3 ? L.liberText : L.secondaryFg }}
            >
              {ETICHETA_SURSA_SCURT[e.sursa]}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );

  const orase = (
    <Card className="p-4">
      <h2 className="text-[15px] font-semibold" style={{ fontFamily: FONT.display }}>
        Restaurante pe orașe
      </h2>
      <p className="text-[12.5px]" style={{ color: L.mutedFg }}>
        236 active, în 29 de orașe
      </p>
      <ul className="mt-3 grid gap-2">
        {ORASE_RETEA.map((o) => (
          <li key={o.oras} className="grid items-center gap-2 text-[13px]" style={{ gridTemplateColumns: "118px 1fr 28px" }}>
            <span className="truncate">{o.oras}</span>
            <span className="h-2 overflow-hidden rounded-full" style={{ background: L.muted }}>
              <span className="block h-full rounded-full" style={{ width: `${(o.restaurante / 54) * 100}%`, background: L.primary }} />
            </span>
            <span className="text-right font-medium tabular-nums">{o.restaurante}</span>
          </li>
        ))}
      </ul>
    </Card>
  );

  const selector = (
    <Segmented
      eticheta="Perioada"
      value={perioada}
      onChange={setPerioada}
      mic={c.mobil}
      optiuni={[
        { id: "azi", text: "Azi" },
        { id: "saptamana", text: "Săptămâna" },
        { id: "luna", text: "Luna" },
        { id: "an", text: "An" },
      ]}
    />
  );

  const insigna = (
    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ background: L.sidebarAccent, color: L.sidebarFg }}>
      Super admin
    </span>
  );

  if (c.mobil) {
    return (
      <div className="flex h-full flex-col">
        <StatusBar tone="light" bg={L.sidebar} />
        <header className="flex shrink-0 items-center justify-between gap-2 px-4 pb-3 pt-1" style={{ background: L.sidebar }}>
          <span className="flex items-center gap-2">
            <Logo />
            {insigna}
          </span>
          <button
            type="button"
            onClick={() => c.go("harta")}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-medium hover:bg-[#334155]"
            style={{ color: L.sidebarFg }}
          >
            <ArrowLeft size={15} aria-hidden />
            Restaurant
          </button>
        </header>
        <div className="tx-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-3 p-4 pb-10">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-[18px] font-semibold tracking-tight" style={{ fontFamily: FONT.display }}>
                Overview
              </h1>
            </div>
            {selector}
            {kpi}
            {flux}
            {activitate}
            {alerte}
            {lateral}
            {orase}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full" style={{ gridTemplateColumns: "256px minmax(0,1fr)" }}>
      <aside className="flex min-h-0 flex-col gap-5 border-r p-3" style={{ background: L.sidebar, borderColor: L.sidebarBorder }}>
        <div className="flex items-center gap-2 px-2.5 pt-1">
          <Logo />
          {insigna}
        </div>
        <nav aria-label="Secțiunile echipei TableX" className="grid gap-1">
          {SECTIUNI.map(({ text, Icon }, i) => (
            <button
              key={text}
              type="button"
              aria-current={i === 0 ? "page" : undefined}
              onClick={() => i !== 0 && notaSectiune(text)}
              className={cx(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px]",
                i === 0 ? "bg-[#334155] font-medium text-[#f8fafc]" : "text-[#e2e8f0]/80 hover:bg-[#334155]/60 hover:text-[#f8fafc]"
              )}
            >
              <Icon size={16} aria-hidden />
              {text}
            </button>
          ))}
        </nav>
        <div className="mt-auto grid gap-2 border-t pt-3" style={{ borderColor: L.sidebarBorder }}>
          <div className="px-2.5">
            <p className="text-[14px] font-medium" style={{ color: L.sidebarFg }}>
              Echipa TableX
            </p>
            <p className="text-[12px]" style={{ color: "rgba(226,232,240,.6)" }}>
              Super admin
            </p>
          </div>
          <button
            type="button"
            onClick={() => c.go("harta")}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-[#e2e8f0]/80 hover:bg-[#334155]/60 hover:text-[#f8fafc]"
          >
            <ArrowLeft size={15} aria-hidden />
            Înapoi la Trattoria Nord
          </button>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-col">
        <header className="flex h-[57px] shrink-0 items-center justify-between border-b px-6" style={{ background: L.card, borderColor: L.border }}>
          <h1 className="text-[18px] font-semibold tracking-tight" style={{ fontFamily: FONT.display }}>
            Overview
          </h1>
          {selector}
        </header>
        <div className="tx-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-4 p-6">
            {alerte}
            {kpi}
            <div className="grid items-start gap-4" style={{ gridTemplateColumns: "minmax(0,1fr) 300px" }}>
              <div className="grid gap-4">
                {activitate}
                <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1.15fr) minmax(0,1fr)" }}>
                  {flux}
                  {orase}
                </div>
              </div>
              {lateral}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
