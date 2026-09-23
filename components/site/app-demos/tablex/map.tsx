import { useEffect, useId, useMemo, useRef, type CSSProperties, type KeyboardEvent } from "react";
import { RotateCcw } from "lucide-react";
import {
  MESE,
  PROGRAM,
  STRUCTURA,
  fmtOra,
  type Element,
  type Masa,
  type Rez,
  type TipStructura,
  type Zona,
} from "./data";
import { D, ETICHETA_STATUS_MASA, STATUS_HARTA, type StatusMasa } from "./theme";

/* ============================================================
   Harta 2D a sălii — Layer 1 (structura) + Layer 2 (mesele).
   Aceeași desenare ca `HartaZona` + `Masa` din aplicație: scaunele
   se generează din capacitate, în jurul mesei, în vedere de sus.
   ============================================================ */

/* ---------- scaunele (portat din src/lib/scaune.ts) ---------- */

const MAX_SCAUNE = 12;
const PAS_IN_RAZE = 2.8;

type Scaun = { x: number; y: number; a: number };

function razaScaun(w: number, h: number) {
  return Math.min(Math.max(Math.min(w, h) * 0.11, 6), 11);
}

function imparteLaturi(n: number, w: number, h: number) {
  const g = [w, h, w, h];
  const tot = g.reduce((s, x) => s + x, 0);
  const cote = g.map((x) => (n * x) / tot);
  const pe = cote.map((c) => Math.floor(c));
  let ramase = n - pe.reduce((s, c) => s + c, 0);
  const ordine = [0, 2, 1, 3].sort((a, b) => cote[b] - pe[b] - (cote[a] - pe[a]));
  for (let i = 0; ramase > 0; i++) {
    pe[ordine[i % 4]] += 1;
    ramase -= 1;
  }
  return pe;
}

function geometrie(m: Pick<Masa, "w" | "h" | "cap" | "forma">): { r: number; scaune: Scaun[] } {
  const r = razaScaun(m.w, m.h);
  const dep = r + 4;
  const per =
    m.forma === "rotunda" ? Math.PI * (m.w / 2 + dep + (m.h / 2 + dep)) : 2 * (m.w + m.h);
  const n = Math.min(m.cap, MAX_SCAUNE, Math.max(1, Math.floor(per / (PAS_IN_RAZE * r))));
  const out: Scaun[] = [];
  if (m.forma === "rotunda") {
    const rx = m.w / 2;
    const ry = m.h / 2;
    for (let i = 0; i < n; i++) {
      const t = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const nx = Math.cos(t) / rx;
      const ny = Math.sin(t) / ry;
      const l = Math.hypot(nx, ny);
      out.push({
        x: rx + rx * Math.cos(t) + (dep * nx) / l,
        y: ry + ry * Math.sin(t) + (dep * ny) / l,
        a: (Math.atan2(ny, nx) * 180) / Math.PI,
      });
    }
  } else {
    const pe = imparteLaturi(n, m.w, m.h);
    const laturi = [
      { i: 0, a: -90, p: (t: number) => ({ x: t * m.w, y: -dep }) },
      { i: 1, a: 0, p: (t: number) => ({ x: m.w + dep, y: t * m.h }) },
      { i: 2, a: 90, p: (t: number) => ({ x: t * m.w, y: m.h + dep }) },
      { i: 3, a: 180, p: (t: number) => ({ x: -dep, y: t * m.h }) },
    ];
    for (const lat of laturi) {
      const c = pe[lat.i];
      for (let j = 0; j < c; j++) {
        const { x, y } = lat.p((j + 0.5) / c);
        out.push({ x, y, a: lat.a });
      }
    }
  }
  return { r, scaune: out };
}

function caleSpatar(r: number) {
  const rs = r * 1.5;
  const capat = (g: number) => {
    const rad = (g * Math.PI) / 180;
    return `${(rs * Math.cos(rad)).toFixed(2)} ${(rs * Math.sin(rad)).toFixed(2)}`;
  };
  return `M ${capat(-100)} A ${rs} ${rs} 0 1 1 ${capat(100)}`;
}

/* ---------- Layer 1 ---------- */

const CULOARE_STRUCTURA: Record<TipStructura, string> = {
  perete: D.perete,
  usa: D.usa,
  bar: D.bar,
  dj: D.zonaSpeciala,
  vip: D.zonaSpeciala,
  intrare: D.usa,
  bucatarie: D.zonaSpeciala,
  planta: D.planta,
  piscina: D.piscina,
};
const CU_ETICHETA: TipStructura[] = ["bar", "dj", "vip", "intrare", "bucatarie", "piscina"];
const ETICHETA_SUS: TipStructura[] = ["vip", "bucatarie", "piscina"];

function ElementStructura({ e }: { e: Element }) {
  const culoare = CULOARE_STRUCTURA[e.tip];
  const cx = e.w / 2;
  const cy = e.h / 2;
  const raza = Math.min(e.w, e.h) / 2;
  return (
    <g transform={`translate(${e.x} ${e.y})`}>
      {e.tip === "planta" ? (
        <g transform={`translate(${cx} ${cy})`} fill={culoare} opacity={0.85}>
          {Array.from({ length: 5 }, (_, i) => (
            <ellipse
              key={i}
              rx={raza * 0.24}
              ry={raza * 0.4}
              transform={`rotate(${(i * 360) / 5}) translate(0 ${-raza * 0.6})`}
            />
          ))}
          <circle r={raza * 0.26} />
        </g>
      ) : (
        <rect
          width={e.w}
          height={e.h}
          rx={e.tip === "piscina" ? Math.min(e.w, e.h) / 4 : e.tip === "perete" ? 0 : 4}
          fill={culoare}
          opacity={e.tip === "perete" || e.tip === "bar" ? 1 : e.tip === "piscina" ? 0.55 : 0.85}
        />
      )}
      {e.eticheta && CU_ETICHETA.includes(e.tip) && (
        <text
          x={cx}
          y={ETICHETA_SUS.includes(e.tip) ? Math.min(20, e.h / 2) : cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill={e.tip === "bar" ? D.bg : e.tip === "piscina" ? "#0c4a6e" : D.fg}
          style={{ fontSize: 13, fontWeight: 500, letterSpacing: "0.02em" }}
          pointerEvents="none"
        >
          {e.eticheta}
        </text>
      )}
    </g>
  );
}

/* ---------- Layer 2: masa ---------- */

function MasaSvg({
  m,
  status,
  selectata,
  interactiva,
  stinsa,
  eligibila,
  reducedMotion,
  onAlege,
}: {
  m: Masa;
  status: StatusMasa;
  selectata: boolean;
  interactiva: boolean;
  stinsa: boolean;
  eligibila: boolean;
  reducedMotion: boolean;
  onAlege?: (id: string) => void;
}) {
  const { r, scaune } = useMemo(() => geometrie(m), [m]);
  const spatar = caleSpatar(r);
  const cx = m.w / 2;
  const cy = m.h / 2;
  const culori = STATUS_HARTA[status];
  const rotunda = m.forma === "rotunda";
  const selectabila = interactiva && status !== "inactiv";

  const stilForma: CSSProperties = {
    fill: culori.fill,
    stroke: selectata ? D.selectie : culori.stroke,
    strokeWidth: selectata ? 4 : 2,
    transition: reducedMotion ? undefined : "fill .45s ease, stroke .45s ease",
  };

  const laTasta = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (selectabila) onAlege?.(m.id);
  };

  return (
    <g
      transform={`translate(${m.x} ${m.y}) rotate(${m.rot} ${cx} ${cy})`}
      role={selectabila ? "button" : "img"}
      tabIndex={selectabila ? 0 : -1}
      aria-pressed={selectabila ? selectata : undefined}
      aria-label={`Masa ${m.numar}, ${m.cap} locuri, ${ETICHETA_STATUS_MASA[status]}`}
      onClick={() => selectabila && onAlege?.(m.id)}
      onKeyDown={laTasta}
      className={selectabila ? "tx-masa" : undefined}
      style={{
        cursor: selectabila ? "pointer" : "default",
        opacity: stinsa ? 0.28 : 1,
        transition: reducedMotion ? undefined : "opacity .25s ease",
        outline: "none",
      }}
    >
      <g pointerEvents="none" aria-hidden>
        {scaune.map((s, i) => (
          <g key={i} transform={`translate(${s.x} ${s.y}) rotate(${s.a})`}>
            <path d={spatar} fill="none" stroke={D.scaun} strokeWidth={r * 0.3} strokeLinecap="round" />
            <circle r={r} fill={D.scaun} />
          </g>
        ))}
      </g>

      {eligibila &&
        (rotunda ? (
          <ellipse
            cx={cx}
            cy={cy}
            rx={cx + 9}
            ry={cy + 9}
            fill="none"
            stroke={D.selectie}
            strokeWidth={3}
            strokeDasharray="6 5"
            className={reducedMotion ? undefined : "tx-halou"}
          />
        ) : (
          <rect
            x={-9}
            y={-9}
            width={m.w + 18}
            height={m.h + 18}
            rx={12}
            fill="none"
            stroke={D.selectie}
            strokeWidth={3}
            strokeDasharray="6 5"
            className={reducedMotion ? undefined : "tx-halou"}
          />
        ))}

      {rotunda ? (
        <ellipse className="tx-forma" cx={cx} cy={cy} rx={cx} ry={cy} style={stilForma} />
      ) : (
        <rect className="tx-forma" width={m.w} height={m.h} rx={6} style={stilForma} />
      )}

      {m.grup && (
        <line x1={cx - 8} y1={m.h - 6} x2={cx + 8} y2={m.h - 6} stroke={D.selectie} strokeWidth={2} />
      )}

      <g transform={`rotate(${-m.rot} ${cx} ${cy})`} pointerEvents="none">
        <text
          x={cx}
          y={cy - 5}
          textAnchor="middle"
          dominantBaseline="central"
          fill={D.fg}
          style={{ fontSize: 15, fontWeight: 600 }}
        >
          {m.numar}
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(248,250,252,0.72)"
          style={{ fontSize: 11 }}
        >
          {m.cap} loc.
        </text>
      </g>
    </g>
  );
}

/** Colțul dreapta-sus al mesei, după rotație (pentru insigna ⇄). */
function coltSus(m: Masa) {
  const culcata = Math.abs(m.rot % 180) === 90;
  const bw = culcata ? m.h : m.w;
  const bh = culcata ? m.w : m.h;
  const cx = m.x + m.w / 2;
  const cy = m.y + m.h / 2;
  return { x: cx + bw / 2 - 8, y: cy - bh / 2 + 8 };
}

export function HartaSala({
  zona,
  statusuri,
  peMasa,
  selectata = null,
  onMasa,
  eligibile = null,
  onMuta,
  reducedMotion,
  className,
  style,
  aratGrid = true,
}: {
  zona: Zona;
  statusuri: Record<string, StatusMasa>;
  peMasa?: Record<string, Rez>;
  selectata?: string | null;
  onMasa?: (id: string) => void;
  /** Modul „alege masa”: doar acestea rămân aprinse și se pot atinge. */
  eligibile?: Set<string> | null;
  /** Insigna ⇄ de pe mesele cu client: pornește mutarea rezervării. */
  onMuta?: (masaId: string) => void;
  reducedMotion: boolean;
  className?: string;
  style?: CSSProperties;
  aratGrid?: boolean;
}) {
  const idGrid = useId();
  const idClip = useId();
  const mese = MESE.filter((m) => m.zona === zona.id);
  const structura = [...STRUCTURA[zona.id]].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  const cuInsigna = onMuta && !eligibile ? mese.filter((m) => peMasa?.[m.id] && !m.grup) : [];

  return (
    <svg
      viewBox={`0 0 ${zona.w} ${zona.h}`}
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label={`Harta zonei ${zona.nume}`}
      className={className}
      style={{ display: "block", userSelect: "none", ...style }}
    >
      <defs>
        <pattern id={idGrid} width={zona.grid} height={zona.grid} patternUnits="userSpaceOnUse">
          <path
            d={`M ${zona.grid} 0 L 0 0 0 ${zona.grid}`}
            fill="none"
            stroke={D.grid}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </pattern>
        <clipPath id={idClip}>
          <rect width={zona.w} height={zona.h} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${idClip})`}>
        <rect width={zona.w} height={zona.h} fill={D.canvas} />
        {aratGrid && <rect width={zona.w} height={zona.h} fill={`url(#${idGrid})`} />}
        {structura.map((e, i) => (
          <ElementStructura key={`${e.tip}-${i}`} e={e} />
        ))}
        {mese.map((m) => {
          const st = m.indisponibila ? "inactiv" : (statusuri[m.id] ?? "liber");
          const eligibila = Boolean(eligibile?.has(m.id));
          return (
            <MasaSvg
              key={m.id}
              m={m}
              status={st}
              selectata={selectata === m.id || Boolean(selectata && m.grup && MESE.find((x) => x.id === selectata)?.grup === m.grup)}
              interactiva={Boolean(onMasa) && (!eligibile || eligibila)}
              stinsa={Boolean(eligibile) && !eligibila}
              eligibila={eligibila}
              reducedMotion={reducedMotion}
              onAlege={onMasa}
            />
          );
        })}
        {cuInsigna.map((m) => {
          const p = coltSus(m);
          const r = peMasa?.[m.id];
          return (
            <g
              key={`ins-${m.id}`}
              role="button"
              tabIndex={0}
              aria-label={`Mută rezervarea ${r?.nume ?? ""} de pe masa ${m.numar} pe altă masă`}
              className="tx-insigna"
              style={{ cursor: "pointer", outline: "none" }}
              onClick={(e) => {
                e.stopPropagation();
                onMuta?.(m.id);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                onMuta?.(m.id);
              }}
            >
              <circle cx={p.x} cy={p.y} r={11} fill={D.selectie} stroke={D.bg} strokeWidth={2} />
              <text
                x={p.x}
                y={p.y + 0.5}
                textAnchor="middle"
                dominantBaseline="central"
                fill={D.bg}
                style={{ fontSize: 11, fontWeight: 700 }}
                pointerEvents="none"
              >
                ⇄
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/* ---------- Legenda Traffic Light ---------- */

const ORDINE_LEGENDA: StatusMasa[] = ["liber", "ocupat", "expirare", "eveniment", "inactiv"];

export function Legenda({ culoareText, marime = 12, wrap = false }: { culoareText: string; marime?: number; wrap?: boolean }) {
  return (
    <ul
      className={wrap ? "flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1" : "flex items-center gap-x-3.5 gap-y-1"}
      style={{ fontSize: marime, color: culoareText }}
    >
      {ORDINE_LEGENDA.map((s) => (
        <li key={s} className="flex shrink-0 items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block rounded-full"
            style={{ width: 10, height: 10, background: s === "inactiv" ? "#475569" : STATUS_HARTA[s].stroke }}
          />
          {ETICHETA_STATUS_MASA[s]}
        </li>
      ))}
    </ul>
  );
}

/* ---------- Bara orară (§28.12) ---------- */

export function BaraOrara({
  acum,
  afisata,
  urmareste,
  onSchimba,
  marime = "md",
}: {
  acum: number;
  afisata: number;
  urmareste: boolean;
  onSchimba: (h: number | null) => void;
  marime?: "md" | "sm";
}) {
  const sloturi: number[] = [];
  for (let o = PROGRAM.deLa; o <= PROGRAM.panaLa; o += 0.5) sloturi.push(o);
  const ales = Math.round(afisata * 2) / 2;
  const slotAcum = Math.round(acum * 2) / 2;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // offsetLeft, nu getBoundingClientRect: pânza demo-ului e scalată cu
    // transform, iar dreptunghiurile ar veni în pixeli scalați. Poziția se
    // rotunjește la începutul celui mai apropiat slot, ca marginea din stânga
    // să nu taie o oră în două („15:00” înjumătățit se citește „5:00”).
    let viu = true;
    const aliniaza = () => {
      const bara = ref.current;
      const el = bara?.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!viu || !bara || !el) return;
      const ideal = el.offsetLeft - bara.clientWidth / 2 + el.offsetWidth / 2;
      let tinta = 0;
      let dist = Infinity;
      for (const copil of Array.from(bara.children) as HTMLElement[]) {
        const d = Math.abs(copil.offsetLeft - 2 - ideal);
        if (d < dist) {
          dist = d;
          tinta = copil.offsetLeft - 2;
        }
      }
      bara.scrollTo({ left: Math.max(0, tinta) });
    };
    aliniaza();
    // Lățimea sloturilor se schimbă când se încarcă fontul: realiniem atunci.
    document.fonts?.ready.then(aliniaza).catch(() => undefined);
    return () => {
      viu = false;
    };
  }, [ales, urmareste]);

  const mic = marime === "sm";
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg p-1.5"
      style={{ background: D.card, border: `1px solid ${D.border}`, color: D.fg, boxShadow: "0 1px 2px rgba(0,0,0,.25)" }}
    >
      <div
        ref={ref}
        role="group"
        aria-label="Ora afișată pe hartă"
        className="tx-fara-bara relative flex min-w-0 flex-1 gap-1 overflow-x-auto"
        style={{
          maskImage: "linear-gradient(to right, transparent 0, #000 14px, #000 calc(100% - 22px), transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 0, #000 14px, #000 calc(100% - 22px), transparent 100%)",
        }}
      >
        {sloturi.map((s) => {
          const esteAles = s === ales;
          const esteAcum = s === slotAcum;
          const trecut = s < slotAcum;
          const intreaga = Number.isInteger(s);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={esteAles}
              aria-label={`Arată sala la ora ${fmtOra(s)}${esteAcum ? " (ora curentă)" : ""}`}
              onClick={() => onSchimba(esteAcum ? null : s)}
              className="tx-slot shrink-0 rounded-md font-medium tabular-nums"
              style={{
                padding: intreaga || esteAles || esteAcum ? (mic ? "5px 9px" : "6px 12px") : mic ? "5px 3px" : "6px 4px",
                fontSize: mic ? 13 : 14,
                background: esteAles ? D.primary : "transparent",
                color: esteAles ? D.primaryFg : !intreaga ? D.mutedFg : trecut ? "rgba(248,250,252,.55)" : D.fg,
                fontWeight: esteAles ? 700 : 500,
                boxShadow: esteAcum && !esteAles ? `inset 0 0 0 1px ${D.primary}` : undefined,
              }}
            >
              {intreaga || esteAles || esteAcum ? fmtOra(s) : "·"}
            </button>
          );
        })}
      </div>
      {!urmareste && (
        <button
          type="button"
          onClick={() => onSchimba(null)}
          className="tx-btn-dark flex shrink-0 items-center gap-1.5 rounded-md font-medium"
          style={{
            border: `1px solid ${D.border}`,
            background: D.bg,
            color: D.fg,
            fontSize: mic ? 12 : 13,
            padding: mic ? "5px 8px" : "6px 10px",
          }}
          title={`Harta arată ora ${fmtOra(afisata)}. Revino la ${fmtOra(acum)}.`}
        >
          <RotateCcw size={mic ? 13 : 14} aria-hidden />
          {mic ? "Acum" : "Revino la ora curentă"}
        </button>
      )}
    </div>
  );
}
