import type { CSSProperties, ReactNode } from "react";

/* ============================================================
   Semne de client
   ------------------------------------------------------------
   Clienții nu ne-au dat fișiere de logo, iar un cerc gri sub o
   recenzie arată exact ca un citat inventat. Așa că fiecare firmă
   primește un semn desenat de noi: un glif care spune ce face
   firma (acoperiș, hotă, ventilator, pahar) pe o plăcuță cu două
   culori proprii.

   Nu pretinde că e logo-ul lor — e prea sobru pentru asta și n-are
   wordmark. Când primim fișierele reale, se înlocuiește `glyph`
   cu un <img> și restul rămâne cum e.

   Culorile: hue liber, dar croma și luminozitatea stau în aceeași
   bandă, altfel peretele de recenzii devine un pom de Crăciun.
   ============================================================ */

type Mark = { from: string; to: string; glyph: ReactNode };

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const MARKS: Record<string, Mark> = {
  /* montaj și amenajări — colțare de cadru */
  "Art Install Suppliers": {
    from: "#e0a34a",
    to: "#c2703a",
    glyph: (
      <>
        <path {...S} d="M7 12V7h5" />
        <path {...S} d="M25 20v5h-5" />
        <rect {...S} x="12" y="12" width="8" height="8" rx="1.5" />
      </>
    ),
  },
  /* bar — pahar */
  "E45 RestoBar": {
    from: "#e2585f",
    to: "#a83a6a",
    glyph: (
      <>
        <path {...S} d="M9 8h14l-7 8z" />
        <path {...S} d="M16 16v8" />
        <path {...S} d="M11 24h10" />
      </>
    ),
  },
  /* gastrobar — steaua de seară */
  "Vespera Gastrobar": {
    from: "#f0a03c",
    to: "#d9552f",
    glyph: (
      <>
        <path {...S} d="M16 5c0 6 2.6 8.7 8.5 9.2C18.6 15 16 17.7 16 24c0-6.3-2.6-9-8.5-9.8C13.4 13.7 16 11 16 5Z" />
      </>
    ),
  },
  /* imobiliare — acoperiș */
  "Nona Imobiliare": {
    from: "#4d8ef0",
    to: "#3f5fd6",
    glyph: (
      <>
        <path {...S} d="M5 16 16 7l11 9" />
        <path {...S} d="M9 16v9h14v-9" />
        <path {...S} d="M14 25v-5h4v5" />
      </>
    ),
  },
  /* ventilații — palete de ventilator */
  "VentoClima Pro": {
    from: "#3fb6c9",
    to: "#3577c4",
    glyph: (
      <>
        <circle {...S} cx="16" cy="16" r="2.5" />
        <path {...S} d="M16 13.5V6c4 0 6 2.4 4.6 5.4-.8 1.6-2.4 2.1-4.6 2.1Z" />
        <path {...S} d="M18.5 16H26c0 4-2.4 6-5.4 4.6-1.6-.8-2.1-2.4-2.1-4.6Z" />
        <path {...S} d="M13.5 16H6c0-4 2.4-6 5.4-4.6 1.6.8 2.1 2.4 2.1 4.6Z" />
        <path {...S} d="M16 18.5V26c-4 0-6-2.4-4.6-5.4.8-1.6 2.4-2.1 4.6-2.1Z" />
      </>
    ),
  },
  /* stomatologie — lumină */
  "Lumident Studio": {
    from: "#57c9d6",
    to: "#4d9be8",
    glyph: (
      <>
        <circle {...S} cx="16" cy="16" r="5" />
        <path {...S} d="M16 4v3M16 25v3M4 16h3M25 16h3M7.8 7.8l2.1 2.1M22.1 22.1l2.1 2.1M24.2 7.8l-2.1 2.1M9.9 22.1l-2.1 2.1" />
      </>
    ),
  },
  /* real estate — straturi */
  "Tectona Real Estate": {
    from: "#7a9c5a",
    to: "#4e7a4a",
    glyph: (
      <>
        <path {...S} d="M16 5 27 11 16 17 5 11z" />
        <path {...S} d="M5 16.5 16 22.5 27 16.5" />
        <path {...S} d="M5 21.5 16 27.5 27 21.5" />
      </>
    ),
  },
  /* instalații industriale — piuliță */
  "Termovent Systems": {
    from: "#8d93a8",
    to: "#4f5a78",
    glyph: (
      <>
        <path {...S} d="M16 4.5 26 10v12l-10 5.5L6 22V10z" />
        <circle {...S} cx="16" cy="16" r="4" />
      </>
    ),
  },
  /* eCommerce — sacoșă */
  "Kora Shop": {
    from: "#e07ab0",
    to: "#8b5ad6",
    glyph: (
      <>
        <path {...S} d="M7 11h18l-1.5 15h-15z" />
        <path {...S} d="M12 14V9a4 4 0 0 1 8 0v5" />
      </>
    ),
  },
  /* mobilier — arcadă */
  "Artis Home": {
    from: "#d69a5c",
    to: "#a35f4e",
    glyph: (
      <>
        <path {...S} d="M7 26V16a9 9 0 0 1 18 0v10" />
        <path {...S} d="M13 26v-9a3 3 0 0 1 6 0v9" />
      </>
    ),
  },
  /* imobiliare — mai sus */
  "Altius Imobiliare": {
    from: "#5b6ff0",
    to: "#7d4ae0",
    glyph: (
      <>
        <path {...S} d="M7 14 16 5l9 9" />
        <path {...S} d="M7 21l9-9 9 9" />
        <path {...S} d="M11 27h10" />
      </>
    ),
  },
  /* bucătărie — tigaie */
  "Savoria Kitchen": {
    from: "#e8b13f",
    to: "#cf6b33",
    glyph: (
      <>
        <path {...S} d="M5 15h17v3a6 6 0 0 1-6 6h-5a6 6 0 0 1-6-6z" />
        <path {...S} d="M22 17h5" />
        <path {...S} d="M11 11c0-2 2-2 2-4M17 11c0-2 2-2 2-4" />
      </>
    ),
  },
};

/** Inițialele, pentru firmele care încă n-au semn desenat. */
function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function ClientMark({
  name,
  size = 36,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const m = MARKS[name];
  const from = m?.from ?? "#7f86a6";
  const to = m?.to ?? "#4a5170";

  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: Math.round(size * 0.3),
    background: `linear-gradient(140deg, color-mix(in oklab, ${from} 34%, #0a0a14), color-mix(in oklab, ${to} 16%, #06060c))`,
    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${from} 34%, transparent), inset 0 1px 0 color-mix(in oklab, ${from} 45%, transparent)`,
    color: `color-mix(in oklab, ${from} 40%, #ffffff)`,
  };

  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={style}
    >
      {m ? (
        <svg
          viewBox="0 0 32 32"
          width={Math.round(size * 0.62)}
          height={Math.round(size * 0.62)}
          role="presentation"
        >
          {m.glyph}
        </svg>
      ) : (
        <span
          className="font-md-mono tracking-tight"
          style={{ fontSize: Math.round(size * 0.34) }}
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}
