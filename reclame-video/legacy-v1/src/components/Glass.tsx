import React from "react";
import { C, FONT } from "../theme";
import { CheckIcon } from "./icons";

// Elementele de interfață din video-ul de referință: pastila de sticlă cu
// contur albastru și halou, eticheta de stare din dreapta ei și cardurile
// mici de date cu bifă, etichetă gri și valoare albă.

export const glassPill = (h: number): React.CSSProperties => ({
  height: h,
  borderRadius: h / 2,
  background: "linear-gradient(180deg, rgba(17,22,34,0.95) 0%, rgba(8,11,19,0.95) 100%)",
  border: "1.5px solid rgba(98,144,255,0.45)",
  boxShadow:
    "0 0 0 1px rgba(30,70,180,0.22), 0 0 36px rgba(46,110,255,0.34), 0 18px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)",
});

export const StatusChip: React.FC<{ label: string; tone: "blue" | "green"; frame: number; h: number }> = ({
  label,
  tone,
  frame,
  h,
}) => {
  const dot = tone === "green" ? C.green : "#5C93FF";
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(frame / 9));
  return (
    <div
      style={{
        height: h,
        padding: `0 ${h * 0.42}px`,
        borderRadius: h / 2,
        display: "flex",
        alignItems: "center",
        gap: h * 0.24,
        background: tone === "green" ? "rgba(22,64,48,0.75)" : "rgba(36,52,88,0.8)",
        border: `1px solid ${tone === "green" ? "rgba(61,220,151,0.25)" : "rgba(120,160,255,0.22)"}`,
        fontFamily: FONT,
        fontWeight: 600,
        fontSize: h * 0.36,
        letterSpacing: "0.14em",
        color: tone === "green" ? "#9FF0C9" : "#AFC3EE",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: h * 0.2, height: h * 0.2, borderRadius: "50%", background: dot, opacity: pulse, boxShadow: `0 0 ${h * 0.25}px ${dot}` }} />
      {label}
    </div>
  );
};

export const CheckBox: React.FC<{ size: number; progress: number; tone?: "blue" | "green" }> = ({ size, progress, tone = "blue" }) => (
  <div
    style={{
      width: size,
      height: size,
      flex: "none",
      borderRadius: size * 0.26,
      background: tone === "green" ? "rgba(61,220,151,0.16)" : "rgba(64,112,255,0.2)",
      border: `1px solid ${tone === "green" ? "rgba(61,220,151,0.35)" : "rgba(110,150,255,0.38)"}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <CheckIcon size={size * 0.62} progress={progress} color={tone === "green" ? "#8DF0C4" : "#A9C2FF"} />
  </div>
);

export const Chip: React.FC<{
  label: string;
  check: number;
  width?: number;
  scale?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ label, check, width, scale = 1, children, style }) => (
  <div
    style={{
      width,
      padding: `${20 * scale}px ${26 * scale}px`,
      borderRadius: 18 * scale,
      background: C.card,
      border: "1px solid rgba(255,255,255,0.075)",
      boxShadow: "0 24px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
      display: "flex",
      alignItems: "center",
      gap: 20 * scale,
      fontFamily: FONT,
      ...style,
    }}
  >
    <CheckBox size={44 * scale} progress={check} />
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 19 * scale, fontWeight: 600, letterSpacing: "0.14em", color: C.mute, textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 4 * scale, fontSize: 31 * scale, fontWeight: 500, color: C.ink, whiteSpace: "nowrap" }}>{children}</div>
    </div>
  </div>
);
