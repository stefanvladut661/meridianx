import React from "react";

// Iconițe din Phosphor (MIT, phosphoricons.com), viewBox 256. Marca Meridian
// are aceeași geometrie ca components/site/mark.tsx de pe site.

const P = {
  hand: "M224,104v50.93c0,46.2-36.85,84.55-83,85.06A83.71,83.71,0,0,1,80.6,215.4C58.79,192.33,34.15,136,34.15,136a16,16,0,0,1,6.53-22.23c7.66-4,17.1-.84,21.4,6.62l21,36.44a6.09,6.09,0,0,0,6,3.09l.12,0A8.19,8.19,0,0,0,96,151.74V32a16,16,0,0,1,16.77-16c8.61.4,15.23,7.82,15.23,16.43V104a8,8,0,0,0,8.53,8,8.17,8.17,0,0,0,7.47-8.25V88a16,16,0,0,1,16.77-16c8.61.4,15.23,7.82,15.23,16.43V112a8,8,0,0,0,8.53,8,8.17,8.17,0,0,0,7.47-8.25v-7.28c0-8.61,6.62-16,15.23-16.43A16,16,0,0,1,224,104Z",
  phone:
    "M231.88,175.08A56.26,56.26,0,0,1,176,224C96.6,224,32,159.4,32,80A56.26,56.26,0,0,1,80.92,24.12a16,16,0,0,1,16.62,9.52l21.12,47.15,0,.12A16,16,0,0,1,117.39,96c-.18.27-.37.52-.57.77L96,121.45c7.49,15.22,23.41,31,38.83,38.51l24.34-20.71a8.12,8.12,0,0,1,.75-.56,16,16,0,0,1,15.17-1.4l.13.06,47.11,21.11A16,16,0,0,1,231.88,175.08Z",
  forkKnife:
    "M216,40V224a8,8,0,0,1-16,0V176H152a8,8,0,0,1-8-8,268.75,268.75,0,0,1,7.22-56.88c9.78-40.49,28.32-67.63,53.63-78.47A8,8,0,0,1,216,40Zm-96.11-1.31a8,8,0,1,0-15.78,2.63L111.89,88H88V40a8,8,0,0,0-16,0V88H48.11l7.78-46.68a8,8,0,1,0-15.78-2.63l-8,48A8.17,8.17,0,0,0,32,88a48.07,48.07,0,0,0,40,47.32V224a8,8,0,0,0,16,0V135.32A48.07,48.07,0,0,0,128,88a8.17,8.17,0,0,0-.11-1.31Z",
  play: "M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z",
};

type IconProps = { size?: number; color?: string; style?: React.CSSProperties };

export const PhoneIcon: React.FC<IconProps> = ({ size = 32, color = "#fff", style }) => (
  <svg width={size} height={size} viewBox="0 0 256 256" style={style}>
    <path d={P.phone} fill={color} />
  </svg>
);

export const ForkKnifeIcon: React.FC<IconProps> = ({ size = 32, color = "#fff", style }) => (
  <svg width={size} height={size} viewBox="0 0 256 256" style={style}>
    <path d={P.forkKnife} fill={color} />
  </svg>
);

export const PlayIcon: React.FC<IconProps> = ({ size = 32, color = "#fff", style }) => (
  <svg width={size} height={size} viewBox="0 0 256 256" style={style}>
    <path d={P.play} fill={color} />
  </svg>
);

/** Vârful degetului arătător, ca fracție din lățimea și înălțimea iconiței. */
export const HAND_TIP = { x: 112 / 256, y: 18 / 256 };

/** Mâna-cursor de link: albă, cu contur închis, ca în clipul de referință. */
export const HandCursor: React.FC<{ size?: number; press?: number }> = ({ size = 96, press = 0 }) => (
  <svg width={size} height={size} viewBox="0 0 256 256" style={{ overflow: "visible", transform: `scale(${1 - press * 0.12})`, transformOrigin: `${HAND_TIP.x * 100}% ${HAND_TIP.y * 100}%` }}>
    <path d={P.hand} fill="#000" opacity={0.28} transform="translate(6 10)" />
    <path d={P.hand} fill="#FFFFFF" stroke="#0B0D0C" strokeWidth={11} strokeLinejoin="round" paintOrder="stroke" />
  </svg>
);

/** Marca MERIDIAN. `draw` 0→1 desenează inelul și apoi săgeata. */
export const MeridianMark: React.FC<{ size?: number; color?: string; draw?: number }> = ({ size = 48, color = "#fff", draw = 1 }) => {
  const r = 38;
  const c = 2 * Math.PI * r;
  const gap = 12;
  const dash = c / 2 - gap;
  const offset = dash + gap / 2 - c / 4;
  const ring = Math.min(1, draw / 0.7);
  const chev = Math.max(0, (draw - 0.45) / 0.55);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="none">
      <g opacity={ring > 0 ? 1 : 0}>
        {/* Cele două jumătăți ale inelului cresc din golurile de la 12 și 6. */}
        <circle
          cx="50"
          cy="50"
          r={r}
          stroke={color}
          strokeWidth="7.5"
          strokeDasharray={`${dash * ring} ${c - dash * ring}`}
          strokeDashoffset={offset - (dash * (1 - ring)) / 2}
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          stroke={color}
          strokeWidth="7.5"
          strokeDasharray={`${dash * ring} ${c - dash * ring}`}
          strokeDashoffset={offset - c / 2 - (dash * (1 - ring)) / 2}
        />
      </g>
      <path
        d="M67 27 L33.5 50 L67 73"
        stroke={color}
        strokeWidth="8.5"
        strokeLinejoin="miter"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - chev}
      />
    </svg>
  );
};
