import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { CheckBox } from "../components/Glass";
import { ArrowRight, DocIcon } from "../components/icons";
import { RollingNumber } from "../components/Text";
import { STRIP_STILLS } from "../data/footage";
import { easeInOut, mix, p } from "../lib/anim";
import type { Layout } from "../lib/layout";
import { C, FONT } from "../theme";

// „În fiecare lună primești o analiză de performanță și propuneri pentru luna
// următoare." — cardul „Day 30" din referință: zilele curg pe bara segmentată,
// rândurile se umplu cu ce am filmat și publicat, apoi apar analiza și
// propunerile. Singurele cifre sunt zilele lunii.

const DAYS = 30;

const Row: React.FC<{ title: string; sub?: string; right?: React.ReactNode; t: number; children: React.ReactNode; caption: string }> = ({
  title,
  sub,
  right,
  t,
  children,
  caption,
}) => (
  <div style={{ opacity: t, transform: `translateY(${(1 - t) * 30}px)`, filter: t < 1 ? `blur(${(1 - t) * 8}px)` : undefined }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
      <span style={{ fontSize: 34, fontWeight: 600, color: C.ink }}>{title}</span>
      {sub && <span style={{ fontSize: 27, color: "#7F8593" }}>{sub}</span>}
      <span style={{ marginLeft: "auto" }}>{right}</span>
    </div>
    <div style={{ marginTop: 12, height: 40, borderRadius: 9, background: "#17181D", overflow: "hidden", position: "relative" }}>{children}</div>
    <div style={{ marginTop: 8, fontSize: 23, color: "#6D7280" }}>{caption}</div>
  </div>
);

const Strip: React.FC<{ fill: number; from: number }> = ({ fill, from }) => {
  const n = 26;
  return (
    <div style={{ position: "absolute", inset: 3, display: "flex", gap: 2 }}>
      {Array.from({ length: n }, (_, i) => {
        const on = fill * n - i;
        return (
          <div key={i} style={{ width: 32, height: 34, borderRadius: 4, overflow: "hidden", opacity: Math.max(0, Math.min(1, on)) }}>
            <Img src={staticFile(STRIP_STILLS[(i + from) % STRIP_STILLS.length])} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        );
      })}
      {fill > 0 && fill < 1 && (
        <div style={{ position: "absolute", top: -3, bottom: -3, left: fill * n * 34 - 2, width: 3, background: "#5C93FF", boxShadow: "0 0 12px #5C93FF" }} />
      )}
    </div>
  );
};

export const MonthlyScene: React.FC<{ L: Layout; start: number; end: number; analysisAt: number; proposalsAt: number }> = ({
  L,
  start,
  end,
  analysisAt,
  proposalsAt,
}) => {
  const frame = useCurrentFrame();
  const T = L.content;
  const enter = p(frame, start - 4, 18);
  const exit = p(frame, end - 9, 9, easeInOut);

  const dayT = p(frame, start + 2, Math.max(30, analysisAt - start + 24), easeInOut);
  const day = 1 + (DAYS - 1) * dayT;
  const prevDay = 1 + (DAYS - 1) * p(frame - 1, start + 2, Math.max(30, analysisAt - start + 24), easeInOut);
  const current = Math.min(DAYS, Math.floor(day));

  const shoot = p(frame, start + 6, 34, easeInOut);
  const ads = p(frame, start + 14, Math.max(30, analysisAt - start + 14), easeInOut);
  const analysis = p(frame, analysisAt - 4, 12);
  const report = p(frame, analysisAt + 6, 30, easeInOut);
  const proposals = p(frame, proposalsAt - 4, 12);
  const badge = p(frame, proposalsAt + 4, 12);

  return (
    <AbsoluteFill
      style={{
        fontFamily: FONT,
        opacity: 1 - exit,
        transform: `translateY(${-40 * exit}px) scale(${1 - 0.06 * exit})`,
        filter: exit > 0 ? `blur(${exit * 14}px)` : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 50,
          top: T + 10,
          width: 980,
          height: 880,
          padding: "40px 44px",
          borderRadius: 34,
          background: "linear-gradient(180deg, rgba(18,19,24,0.97) 0%, rgba(12,13,16,0.97) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.6), 0 0 60px rgba(46,110,255,0.12)",
          opacity: enter,
          transform: `perspective(1800px) translateY(${mix(120, 0, enter)}px) rotateX(${mix(20, 0, enter)}deg) scale(${mix(0.92, 1, enter)})`,
          filter: enter < 1 ? `blur(${(1 - enter) * 14}px)` : undefined,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "0.14em", color: "#9298A6" }}>ZIUA</span>
          <span style={{ marginLeft: 18, fontWeight: 500 }}>
            <RollingNumber value={day} digits={2} size={86} color={C.ink} speed={Math.abs(day - prevDay)} />
          </span>
          <div
            style={{
              marginLeft: "auto",
              height: 56,
              padding: "0 24px",
              borderRadius: 28,
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 26,
              fontWeight: 500,
              color: badge > 0.5 ? "#fff" : "#C9CEDA",
              background: `rgba(${mix(255, 47, badge)},${mix(255, 107, badge)},${mix(255, 255, badge)},${mix(0.07, 1, badge)})`,
              boxShadow: badge > 0 ? `0 0 ${30 * badge}px rgba(47,107,255,0.6)` : undefined,
            }}
          >
            <DocIcon size={26} color={badge > 0.5 ? "#fff" : "#C9CEDA"} />
            Raport lunar
          </div>
        </div>

        <div style={{ marginTop: 26, display: "flex", gap: 6 }}>
          {Array.from({ length: DAYS }, (_, i) => {
            const d = i + 1;
            const bg = d === current ? "#3C84FB" : d < current ? "#4A4D56" : "#1B1C21";
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 30,
                  borderRadius: 7,
                  background: bg,
                  boxShadow: d === current ? "0 0 16px rgba(60,132,251,0.8)" : undefined,
                }}
              />
            );
          })}
        </div>

        <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 22 }}>
          <Row title="Filmări" sub="în restaurant" t={p(frame, start + 2, 12)} caption="Cadre noi pentru reclamele lunii">
            <Strip fill={shoot * 0.45} from={0} />
          </Row>
          <Row title="Reclame" sub="Meta + TikTok" t={p(frame, start + 8, 12)} caption="Publicate și urmărite zi de zi">
            <Strip fill={ads} from={7} />
          </Row>
          <Row
            title="Analiză de performanță"
            t={analysis}
            caption="Ce a mers, ce nu și de ce"
            right={
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 25, color: report >= 1 ? C.ink : "#7F8593" }}>
                {report >= 1 ? "gata" : "în lucru"}
                <CheckBox size={34} progress={p(frame, analysisAt + 34, 8)} />
              </span>
            }
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${report * 100}%`,
                background: "linear-gradient(90deg, rgba(60,125,255,0.25), rgba(60,125,255,0.85))",
                boxShadow: "0 0 18px rgba(60,125,255,0.6)",
              }}
            />
          </Row>
          <Row
            title="Propuneri"
            sub="pentru luna următoare"
            t={proposals}
            caption="Idei noi, gata de filmat"
            right={
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  height: 46,
                  padding: "0 18px",
                  borderRadius: 23,
                  background: "#2F6BFF",
                  color: "#fff",
                  fontSize: 25,
                  fontWeight: 600,
                  opacity: badge,
                  transform: `scale(${mix(0.6, 1, badge)})`,
                  boxShadow: "0 0 26px rgba(47,107,255,0.7)",
                }}
              >
                Luna 2
                <ArrowRight size={24} />
              </span>
            }
          >
            <div style={{ position: "absolute", inset: 3, display: "flex", gap: 6 }}>
              {["Reel nou", "Ofertă de weekend", "Meniu de toamnă"].map((t, i) => {
                const k = p(frame, proposalsAt + 6 + i * 5, 10);
                return (
                  <div
                    key={t}
                    style={{
                      height: 34,
                      padding: "0 16px",
                      borderRadius: 7,
                      background: "rgba(60,125,255,0.16)",
                      border: "1px solid rgba(100,150,255,0.35)",
                      color: "#BFD0FF",
                      fontSize: 21,
                      display: "flex",
                      alignItems: "center",
                      opacity: k,
                      transform: `translateX(${(1 - k) * -20}px)`,
                    }}
                  >
                    {t}
                  </div>
                );
              })}
            </div>
          </Row>
        </div>
      </div>
    </AbsoluteFill>
  );
};
