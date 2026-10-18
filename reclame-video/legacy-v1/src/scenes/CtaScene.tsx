import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { MeridianMark, PhoneIcon } from "../components/icons";
import { WordLines, WordSpec } from "../components/Text";
import { CTA_CARDS } from "../data/footage";
import { DOMAIN, PHONE } from "../data/script";
import { mix, p } from "../lib/anim";
import type { Layout } from "../lib/layout";
import { BRAND_FONT, FONT } from "../theme";

// CTA: panoul albastru din referință („Stop leaving results on the table"),
// cu logo-ul Meridian sus, fraza CTA-ului ca titlu și numărul de telefon,
// care apare când vocea spune „sună" și rămâne până la ultimul cadru.

export const CtaScene: React.FC<{
  L: Layout;
  start: number;
  sunaAt: number;
  title: WordSpec[];
  titleLines: number[];
  subtitle: WordSpec[];
}> = ({ L, start, sunaAt, title, titleLines, subtitle }) => {
  const frame = useCurrentFrame();
  const top = L.top - 10;
  const height = L.bottom - L.top + 60;
  const enter = p(frame, start - 4, 18);
  const logo = p(frame, start, 14);
  const phone = p(frame, sunaAt - 3, 14);
  const ringT = frame - (sunaAt + 18);
  const ring = ringT > 0 ? (ringT % 40) / 40 : -1;
  const float = Math.sin(frame / 22);

  const cy = top + height / 2;
  const titleTop = top + height * 0.22;
  const subTop = titleTop + titleLines.length * 94 + 34;
  const phoneTop = subTop + 150;

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <div
        style={{
          position: "absolute",
          left: 40,
          top,
          width: 1000,
          height,
          borderRadius: 56,
          overflow: "hidden",
          background:
            "radial-gradient(70% 45% at 22% 0%, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0) 60%), radial-gradient(80% 60% at 100% 100%, rgba(80,145,255,0.9) 0%, rgba(80,145,255,0) 70%), linear-gradient(160deg, #152A63 0%, #2045B4 38%, #2361EA 72%, #3479F6 100%)",
          boxShadow: "0 40px 140px rgba(37,99,235,0.45), inset 0 1px 0 rgba(255,255,255,0.25)",
          opacity: enter,
          transform: `translateY(${mix(260, 0, enter)}px) scale(${mix(0.93, 1, enter)})`,
          transformOrigin: `500px ${cy - top}px`,
        }}
      >
        {CTA_CARDS.map((src, i) => {
          const left = i === 0;
          const t = p(frame, start + 6 + i * 4, 18);
          return (
            <div
              key={src}
              style={{
                position: "absolute",
                left: left ? -96 : 1000 - 214,
                top: height - (left ? 300 : 268) + float * (left ? 10 : -10),
                width: 310,
                height: 388,
                borderRadius: 30,
                overflow: "hidden",
                boxShadow: "0 30px 60px rgba(5,15,50,0.5), 0 0 0 1px rgba(255,255,255,0.18)",
                opacity: t,
                transform: `perspective(1400px) rotateY(${left ? 24 : -24}deg) rotateZ(${left ? -9 : 9}deg) translateY(${(1 - t) * 120}px)`,
              }}
            >
              <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: top + 70,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 20,
          opacity: logo * enter,
          transform: `translateY(${(1 - logo) * 20}px)`,
          filter: logo < 1 ? `blur(${(1 - logo) * 8}px)` : undefined,
        }}
      >
        <MeridianMark size={66} color="#fff" />
        <span style={{ fontFamily: BRAND_FONT, fontSize: 34, fontWeight: 700, letterSpacing: "0.24em", color: "#fff" }}>MERIDIAN</span>
      </div>

      <WordLines
        words={title}
        lines={titleLines}
        frame={frame}
        color="#FFFFFF"
        style={{ position: "absolute", left: 60, right: 60, top: titleTop, fontSize: 90, lineHeight: 1.04, fontWeight: 500, letterSpacing: "-0.03em" }}
      />
      <div
        style={{
          position: "absolute",
          left: 110,
          right: 110,
          top: subTop,
          fontSize: 40,
          lineHeight: 1.3,
          color: "rgba(235,241,255,0.86)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          columnGap: "0.26em",
        }}
      >
        {subtitle.map((w, i) => {
          const t = p(frame, w.at - 2, 9);
          return (
            <span key={i} style={{ display: "inline-block", opacity: t, transform: `translateY(${(1 - t) * 14}px)`, filter: t < 1 ? `blur(${(1 - t) * 8}px)` : undefined }}>
              {w.text}
            </span>
          );
        })}
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: phoneTop, display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative" }}>
          {ring >= 0 && (
            <div
              style={{
                position: "absolute",
                inset: -8,
                borderRadius: 80,
                border: "3px solid rgba(255,255,255,0.75)",
                transform: `scale(${1 + ring * 0.22}, ${1 + ring * 0.5})`,
                opacity: 0.8 * (1 - ring),
              }}
            />
          )}
          <div
            style={{
              height: 140,
              padding: "0 54px 0 22px",
              borderRadius: 70,
              background: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 26,
              boxShadow: "0 20px 60px rgba(5,20,80,0.45), 0 0 40px rgba(255,255,255,0.35)",
              opacity: phone,
              transform: `scale(${mix(0.72, 1, phone)})`,
              filter: phone < 1 ? `blur(${(1 - phone) * 12}px)` : undefined,
            }}
          >
            <div style={{ width: 96, height: 96, borderRadius: 48, background: "#2F6BFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <PhoneIcon size={50} />
            </div>
            <div style={{ display: "flex", fontSize: 76, fontWeight: 600, letterSpacing: "-0.01em", color: "#1A47D8", fontVariantNumeric: "tabular-nums" }}>
              {PHONE.split("").map((ch, i) => {
                const k = p(frame, sunaAt + i * 1.2, 10);
                return (
                  <span key={i} style={{ display: "inline-block", whiteSpace: "pre", opacity: k, transform: `translateY(${(1 - k) * -40}px)`, filter: k < 1 ? `blur(${(1 - k) * 6}px)` : undefined }}>
                    {ch}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: phoneTop + 170,
          textAlign: "center",
          fontSize: 30,
          letterSpacing: "0.04em",
          color: "rgba(235,241,255,0.75)",
          opacity: p(frame, sunaAt + 16, 12),
        }}
      >
        {DOMAIN}
      </div>
    </AbsoluteFill>
  );
};
