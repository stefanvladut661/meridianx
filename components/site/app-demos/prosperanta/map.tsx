"use client";

import { C, STATIONS, stationShare } from "./data";

/* ============================================================
   Harta stilizată a rețelei: Pitești și împrejurimile, desenată
   din câteva drumuri, râul Argeș și 16 pini. Nu e o hartă reală
   (aplicația folosește OpenStreetMap); aici e un desen, ca demo-ul
   să nu ceară tile-uri de pe internet.
   ============================================================ */

const ROADS: { d: string; w: number; motorway?: boolean; label?: [number, number, string] }[] = [
  { d: "M600,342 C560,318 520,296 470,276 C420,258 385,238 352,222", w: 7, motorway: true, label: [505, 280, "A1"] },
  { d: "M300,205 C262,182 236,166 206,150 C170,130 130,92 96,52 C80,34 66,18 52,0", w: 5, label: [150, 104, "DN7"] },
  { d: "M280,228 C240,260 200,290 160,314 C120,338 80,360 30,386", w: 5, label: [196, 292, "DN65"] },
  { d: "M298,196 C302,160 306,120 312,88 C316,60 320,30 324,0", w: 5, label: [322, 52, "DN73"] },
  { d: "M338,206 C370,198 390,194 404,190 C420,176 432,160 444,146 C470,120 500,96 540,70", w: 4.5 },
  { d: "M318,236 C340,254 362,268 384,282 C398,292 410,310 420,340", w: 4 },
];

export function StationsMap({
  selected,
  onSelect,
  sizeByVolume = false,
  nearest,
  you,
  fit = "width",
  label = "Harta stațiilor",
}: {
  selected?: number | null;
  onSelect?: (id: number) => void;
  sizeByVolume?: boolean;
  nearest?: number;
  /** Poziția utilizatorului pe hartă (coordonate în viewBox). */
  you?: [number, number];
  /** „width”: lățimea părintelui, înălțimea din raport; „height”: invers. */
  fit?: "width" | "height";
  label?: string;
}) {
  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{ background: "#F1F0EC", aspectRatio: "600 / 380", ...(fit === "width" ? { width: "100%" } : { height: "100%" }) }}
    >
      <svg viewBox="0 0 600 380" className="absolute inset-0 h-full w-full" aria-hidden>
        {/* păduri și câmpuri */}
        <path d="M0,0 L170,0 C150,40 120,70 70,90 C40,100 18,120 0,130 Z" fill="#E4ECDD" />
        <path d="M430,0 L600,0 L600,120 C560,110 520,86 490,60 C466,40 446,20 430,0 Z" fill="#E4ECDD" />
        <path d="M470,380 C490,350 530,340 600,352 L600,380 Z" fill="#E4ECDD" />
        <path d="M0,250 C40,240 70,260 90,290 C60,300 30,300 0,296 Z" fill="#E9EFE2" />
        {/* orașul */}
        <path
          d="M232,150 C252,122 300,112 334,126 C372,140 388,176 382,214 C376,252 344,272 304,270 C262,268 232,250 226,216 C221,190 222,168 232,150 Z"
          fill="#E7E4DD"
        />
        <path d="M430,132 C446,122 466,130 468,146 C470,162 452,170 438,164 C426,158 422,142 430,132 Z" fill="#E7E4DD" />
        {/* râul Argeș */}
        <path
          d="M150,0 C176,40 200,78 214,108 C228,138 234,168 240,200 C246,236 252,270 262,304 C270,332 280,356 292,380"
          fill="none"
          stroke="#C9DFEC"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <text x="222" y="330" fontSize="10" fill="#8FB3C9" fontStyle="italic" transform="rotate(68 222 330)">
          Argeș
        </text>
        {/* drumuri: contur + miez */}
        {ROADS.map((r, i) => (
          <path key={`o${i}`} d={r.d} fill="none" stroke="#D9D5CC" strokeWidth={r.w + 2.5} strokeLinecap="round" />
        ))}
        {ROADS.map((r, i) => (
          <path key={`i${i}`} d={r.d} fill="none" stroke={r.motorway ? "#F6D9A4" : "#FFFFFF"} strokeWidth={r.w} strokeLinecap="round" />
        ))}
        {ROADS.filter((r) => r.label).map((r) => {
          const [x, y, t] = r.label!;
          return (
            <g key={t}>
              <rect x={x - 15} y={y - 8} width="30" height="16" rx="4" fill={t === "A1" ? "#2F6FB5" : "#fff"} stroke={t === "A1" ? "none" : "#CFCAC0"} />
              <text x={x} y={y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={t === "A1" ? "#fff" : "#6B6B6B"}>
                {t}
              </text>
            </g>
          );
        })}
        <text x="300" y="192" textAnchor="middle" fontSize="12" fontWeight="800" fill="#A7A196" letterSpacing="3">
          PITEȘTI
        </text>
      </svg>

      {you && (
        <span
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${(you[0] / 600) * 100}%`, top: `${(you[1] / 380) * 100}%` }}
          aria-hidden
        >
          <span className="block size-[34px] rounded-full" style={{ background: "rgba(47,111,181,.16)" }} />
          <span className="absolute left-1/2 top-1/2 block size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "#2F6FB5", border: "2.5px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,.25)" }} />
        </span>
      )}

      {/* pinii: butoane reale, poziționate procentual */}
      {STATIONS.map((s) => {
        const on = selected === s.id;
        const near = nearest === s.id;
        const base = sizeByVolume ? 14 + stationShare(s.id) * 16 * 10 : 22;
        const size = on ? base + 6 : base;
        /* eticheta nu iese din hartă la margini */
        const align = s.x > 470 ? "right-0" : s.x < 130 ? "left-0" : "left-1/2 -translate-x-1/2";
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect?.(s.id)}
            aria-label={`${label}: ${s.town === "Pitești" ? `Pitești, ${s.name}` : s.name}`}
            aria-pressed={on}
            className="group absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-[width,height] duration-200"
            style={{
              left: `${(s.x / 600) * 100}%`,
              top: `${(s.y / 380) * 100}%`,
              width: size,
              height: size,
              background: on ? C.fg : C.red,
              border: "2.5px solid #fff",
              boxShadow: on ? "0 0 0 4px rgba(26,26,26,.18), 0 6px 14px rgba(0,0,0,.25)" : "0 3px 8px rgba(224,6,28,.35)",
              zIndex: on ? 3 : near ? 2 : 1,
            }}
          >
            <span className="block size-[6px] rounded-full bg-white" />
            {(on || near) && (
              <span
                className={`pointer-events-none absolute bottom-full mb-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${align}`}
                style={{ background: on ? C.fg : C.red, color: "#fff", boxShadow: "0 4px 10px rgba(0,0,0,.18)" }}
              >
                {near && !on ? "Cea mai apropiată" : s.name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
