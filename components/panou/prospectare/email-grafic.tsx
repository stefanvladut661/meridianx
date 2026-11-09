"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { dayMonthRo, num, weekdayRo } from "@/components/panou/ui/format";
import type { ZiCasute } from "@/lib/prospectare/types";

/**
 * „Ultimele 14 zile”, ca `TrendArea` din prototip (trimise + răspunsuri, arii
 * cu degrade), desenat în SVG simplu, fără pachete, pe tema închisă.
 * Fără mouse: săgețile stânga/dreapta (Home/End) trec de la o zi la alta și
 * ziua aleasă se anunță; toate cifrele sunt și într-un tabel pentru cititoare.
 */

const PLOT = 160;
const TOP = 10;
const AXIS = 22;
const LEFT = 40;
const RIGHT = 8;
const GRID = "rgba(255,255,255,0.055)";
const TICK = "rgba(255,255,255,0.42)";

const SERII = [
  { key: "trimise", name: "Trimise", color: "#C6B5FF" },
  { key: "raspunsuri", name: "Răspunsuri", color: "#8FE3B0" },
] as const;
const BOUNCE = "#FF8FA8";

/** Pași „rotunzi”, întregi (sunt numărători): 1, 2, 2,5, 5 × 10ⁿ. */
function niceMax(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const rough = max / 3;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((f) => f * power).find((c) => c >= rough) ?? rough);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v));
  return { top, ticks };
}

/** Curba netezită prin puncte (Hermite monoton): nu trece peste valorile reale. */
function smoothPath(points: Array<[number, number]>): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M${points[0][0]},${points[0][1]}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(points[i + 1][0] - points[i][0]);
    slope.push((points[i + 1][1] - points[i][1]) / (dx[i] || 1));
  }
  const tangent: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i += 1) tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  tangent.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const sum = a * a + b * b;
    if (sum > 9) {
      const scale = 3 / Math.sqrt(sum);
      tangent[i] = scale * a * slope[i];
      tangent[i + 1] = scale * b * slope[i];
    }
  }
  let path = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i] / 3;
    path += ` C${points[i][0] + h},${points[i][1] + tangent[i] * h} ${points[i + 1][0] - h},${points[i + 1][1] - tangent[i + 1] * h} ${points[i + 1][0]},${points[i + 1][1]}`;
  }
  return path;
}

const ziua = (zi: string) => `${zi}T12:00:00Z`;
const ziScurta = (zi: string) => dayMonthRo(ziua(zi));
const ziLunga = (zi: string) => `${weekdayRo(ziua(zi))}, ${dayMonthRo(ziua(zi))}`;

export function EmailGrafic({ zile }: { zile: ZiCasute[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const id = useId();
  const gid = id.replace(/:/g, "");

  const max = Math.max(0, ...zile.flatMap((z) => [z.trimise, z.raspunsuri]));
  const gol = max === 0;

  // Reluat când graficul apare (după o recitire cu date), ca să-și măsoare lățimea.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [gol]);

  if (gol) {
    return (
      <p className="rounded-xl border border-dashed border-white/[0.09] px-4 py-10 text-center text-[14px] leading-relaxed text-muted-foreground">
        Niciun email în ultimele 14 zile.
      </p>
    );
  }

  const { top, ticks } = niceMax(max);
  const plotWidth = width ? Math.max(0, width - LEFT - RIGHT) : 0;
  const stepX = zile.length > 1 ? plotWidth / (zile.length - 1) : 0;
  const xOf = (i: number) => (zile.length > 1 ? LEFT + i * stepX : LEFT + plotWidth / 2);
  const yOf = (v: number) => TOP + PLOT - (v / top) * PLOT;
  const baseline = TOP + PLOT;
  const serii = SERII.map((s) => {
    const pts = zile.map((z, i): [number, number] => [xOf(i), yOf(z[s.key])]);
    const line = smoothPath(pts);
    const area = pts.length > 1 ? `${line} L${pts[pts.length - 1][0]},${baseline} L${pts[0][0]},${baseline} Z` : "";
    return { ...s, pts, line, area };
  });

  // Etichetele zilelor: câte încap (~64 px fiecare), mereu prima și ultima.
  const cate = Math.max(2, Math.floor(plotWidth / 64));
  const pas = Math.max(1, Math.ceil((zile.length - 1) / (cate - 1)));
  const etichete = new Set<number>();
  for (let i = 0; i < zile.length; i += pas) etichete.add(i);
  const ultima = zile.length - 1;
  const penultima = Math.floor(ultima / pas) * pas;
  if (penultima !== ultima && ultima - penultima < pas * 0.6) etichete.delete(penultima);
  etichete.add(ultima);

  const pick = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || zile.length === 0) return;
    const raw = stepX > 0 ? Math.round((clientX - rect.left - LEFT) / stepX) : 0;
    setActive(Math.min(zile.length - 1, Math.max(0, raw)));
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = active ?? zile.length - 1;
    const next =
      event.key === "ArrowLeft"
        ? Math.max(0, current - 1)
        : event.key === "ArrowRight"
          ? Math.min(zile.length - 1, current + 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? zile.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  };

  const shown = active !== null ? zile[active] : null;

  return (
    <figure className="min-w-0">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
        <span id={`${gid}-t`} className="sr-only">
          Emailuri trimise și răspunsuri, pe zile, ultimele 14 zile
        </span>
        {SERII.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden="true" />
            {s.name}
          </span>
        ))}
      </figcaption>
      <div
        ref={wrapRef}
        tabIndex={0}
        role="group"
        aria-labelledby={`${gid}-t`}
        aria-describedby={`${gid}-h`}
        onPointerMove={(event) => pick(event.clientX)}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((v) => v ?? zile.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKey}
        className="relative mt-2 rounded-lg"
        style={{ height: PLOT + TOP + AXIS }}
      >
        <p id={`${gid}-h`} className="sr-only">
          Săgețile stânga și dreapta trec de la o zi la alta. Toate cifrele sunt și în tabelul de după grafic.
        </p>
        {width ? (
          <svg width={width} height={PLOT + TOP + AXIS} aria-hidden="true" className="block overflow-visible">
            <defs>
              {serii.map((s) => (
                <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={LEFT} x2={width - RIGHT} y1={yOf(tick)} y2={yOf(tick)} stroke={GRID} strokeWidth={1} />
                <text x={LEFT - 8} y={yOf(tick)} textAnchor="end" dominantBaseline="middle" fill={TICK} fontSize={10.5} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {num(tick)}
                </text>
              </g>
            ))}
            {serii.map((s) => (s.area ? <path key={`a-${s.key}`} d={s.area} fill={`url(#${gid}-${s.key})`} /> : null))}
            {serii.map((s) =>
              s.pts.length > 1 ? (
                <path key={`l-${s.key}`} d={s.line} fill="none" stroke={s.color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
              ) : s.pts.length === 1 ? (
                <circle key={`p-${s.key}`} cx={s.pts[0][0]} cy={s.pts[0][1]} r={3} fill={s.color} />
              ) : null
            )}
            {zile.map((z, i) =>
              etichete.has(i) ? (
                <text
                  key={`x-${z.zi}`}
                  x={xOf(i)}
                  y={TOP + PLOT + 16}
                  textAnchor={i === 0 ? "start" : i === ultima ? "end" : "middle"}
                  fill={TICK}
                  fontSize={10.5}
                >
                  {ziScurta(z.zi)}
                </text>
              ) : null
            )}
            {active !== null && serii[0].pts[active] ? (
              <>
                <line x1={serii[0].pts[active][0]} x2={serii[0].pts[active][0]} y1={TOP} y2={baseline} stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
                {serii.map((s) => (
                  <circle key={`d-${s.key}`} cx={s.pts[active][0]} cy={s.pts[active][1]} r={3.5} fill={s.color} />
                ))}
              </>
            ) : null}
          </svg>
        ) : null}

        {shown && width && active !== null ? (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl border border-white/[0.1] bg-[#08080B] px-3 py-2 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.9)]"
            style={{ left: Math.min(Math.max(xOf(active), 80), width - 80) }}
          >
            <p className="mb-1 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">{ziLunga(shown.zi)}</p>
            {SERII.map((s) => (
              <p key={s.key} className="pu-num flex items-center gap-2 text-[14px] text-foreground">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                <span className="text-muted-foreground">{s.name}</span>
                <span className="ml-auto pl-3 font-medium">{num(shown[s.key])}</span>
              </p>
            ))}
            <p className="pu-num flex items-center gap-2 text-[14px] text-foreground">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: BOUNCE }} aria-hidden="true" />
              <span className="text-muted-foreground">Bounce</span>
              <span className="ml-auto pl-3 font-medium">{num(shown.bounce)}</span>
            </p>
          </div>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        {shown ? `${ziLunga(shown.zi)}: ${num(shown.trimise)} trimise, ${num(shown.raspunsuri)} răspunsuri, ${num(shown.bounce)} bounce` : ""}
      </p>
      {/* `sr-only` pe un div, nu pe tabel: un tabel nu respectă lățimea de 1 px și împinge pagina pe telefon. */}
      <div className="sr-only">
      <table>
        <caption>Emailuri pe zile, ultimele 14 zile, pe toate căsuțele</caption>
        <thead>
          <tr>
            <th scope="col">Ziua</th>
            <th scope="col">Trimise</th>
            <th scope="col">Răspunsuri</th>
            <th scope="col">Bounce</th>
          </tr>
        </thead>
        <tbody>
          {zile.map((z) => (
            <tr key={z.zi}>
              <th scope="row">{ziLunga(z.zi)}</th>
              <td>{num(z.trimise)}</td>
              <td>{num(z.raspunsuri)}</td>
              <td>{num(z.bounce)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
