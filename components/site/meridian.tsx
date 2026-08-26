/* ============================================================
   ARCUL DE MERIDIAN — firul comun dintre cele două lumi.

   Geometria e identică în ambele variante (aceleași două curbe și
   același cerc), doar tratamentul diferă: la video e lumină care
   circulă pe traseu, la software e o geodezică desenată peste grilă,
   cu gradații de latitudine. Asta e ideea, nu decorul: același
   obiect, două temperamente.

   pathLength={100} normalizează lungimea traseului, ca animațiile
   de dash să se închidă perfect indiferent de curbura reală.
   ============================================================ */

const ARC_LEFT = "M160 10 C 62 72, 62 248, 160 310";
const ARC_RIGHT = "M160 10 C 258 72, 258 248, 160 310";

export function MeridianVideo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 320"
      className={className}
      fill="none"
      aria-hidden
      role="presentation"
    >
      <defs>
        <linearGradient id="mv-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--md-a3)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--md-a2)" />
          <stop offset="100%" stopColor="var(--md-a1)" stopOpacity="0" />
        </linearGradient>
        <filter id="mv-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* traseul de bază, abia vizibil */}
      <circle
        cx="160"
        cy="160"
        r="150"
        stroke="currentColor"
        strokeOpacity="0.13"
        strokeWidth="1"
      />
      <path
        d={ARC_LEFT}
        stroke="currentColor"
        strokeOpacity="0.13"
        strokeWidth="1"
      />
      <path
        d={ARC_RIGHT}
        stroke="currentColor"
        strokeOpacity="0.13"
        strokeWidth="1"
      />

      {/* lumina care circulă pe meridian */}
      <g filter="url(#mv-glow)">
        <path
          d={ARC_LEFT}
          pathLength={100}
          className="arc-travel"
          stroke="url(#mv-g)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d={ARC_RIGHT}
          pathLength={100}
          className="arc-travel arc-travel-2"
          stroke="url(#mv-g)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export function MeridianSoftware({ className = "" }: { className?: string }) {
  // Gradații de latitudine: linii orizontale care se scurtează spre poli.
  const lats = [-60, -40, -20, 0, 20, 40, 60];

  return (
    <svg
      viewBox="0 0 320 320"
      className={className}
      fill="none"
      aria-hidden
      role="presentation"
    >
      <circle
        cx="160"
        cy="160"
        r="150"
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="1"
      />

      {/* paralele — structura pe care stă geodezica */}
      {lats.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const y = 160 - Math.sin(rad) * 150;
        const half = Math.cos(rad) * 150;
        return (
          <g key={deg}>
            <line
              x1={160 - half}
              y1={y}
              x2={160 + half}
              y2={y}
              stroke="currentColor"
              strokeOpacity={deg === 0 ? 0.22 : 0.1}
              strokeWidth="1"
              strokeDasharray={deg === 0 ? undefined : "2 6"}
            />
            {deg !== 0 && (
              <text
                x={160 + half + 8}
                y={y + 3}
                fill="currentColor"
                fillOpacity="0.3"
                fontSize="8"
                fontFamily="var(--md-font-mono)"
              >
                {deg > 0 ? `${deg}°N` : `${-deg}°S`}
              </text>
            )}
          </g>
        );
      })}

      {/* geodezica — se desenează la intrarea în viewport */}
      <path
        d={ARC_LEFT}
        pathLength={100}
        className="draw-line"
        style={{ ["--len" as string]: "100" }}
        stroke="var(--md-a1)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d={ARC_RIGHT}
        pathLength={100}
        className="draw-line"
        style={{ ["--len" as string]: "100", transitionDelay: "180ms" }}
        stroke="var(--md-a1)"
        strokeOpacity="0.45"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* nodurile de capăt — poli */}
      <rect x="156" y="6" width="8" height="8" fill="var(--md-a1)" rx="1" />
      <rect x="156" y="306" width="8" height="8" fill="var(--md-a1)" rx="1" />
    </svg>
  );
}
