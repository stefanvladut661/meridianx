import React from "react";

// Blur pe direcția mișcării: cât de lung e „dârul" depinde de viteza din cadrul
// curent (px/cadru). Sub prag nu se aplică nimic — filtrul costă la randare.

export const MotionBlur: React.FC<{
  id: string;
  vx: number;
  vy: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  amount?: number;
}> = ({ id, vx, vy, children, style, amount = 0.45 }) => {
  const sx = Math.min(60, Math.abs(vx) * amount);
  const sy = Math.min(60, Math.abs(vy) * amount);
  if (sx < 0.6 && sy < 0.6) return <div style={style}>{children}</div>;
  const fid = `mb-${id}`;
  return (
    <div style={{ ...style, filter: `url(#${fid})` }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id={fid} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={`${sx.toFixed(2)} ${sy.toFixed(2)}`} />
        </filter>
      </svg>
      {children}
    </div>
  );
};
