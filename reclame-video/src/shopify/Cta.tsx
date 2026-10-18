import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { MeridianMark } from "../components/icons";
import { PHONE, DOMAIN } from "../data/script";
import { easeInOut, mix, p, sp } from "../lib/anim";
import type { Seg } from "../lib/timeline";
import { SATOSHI, SHOP } from "../theme";
import { Hand, NumberPill, TapRing } from "./objects";
import { joined, Rebus, Row, ws } from "./Rebus";

// CTA-ul Shopify: fraza se scrie pe rânduri, apoi literele se împrăștie și
// rămâne finalul din clipul de referință — sigla crește dintr-un punct,
// numele se dezvăluie, iar butonul e numărul de telefon, apăsat de mână.
// Numărul apare pe „sună" și rămâne până la ultimul cadru.

export const shopifyCtaTimes = (seg: Seg) => {
  const suna = Math.round(seg.suna ?? seg.words[seg.words.length - 7].f);
  return { suna, tap: suna + 15 };
};

export const ShopifyCta: React.FC<{ seg: Seg; cta: "c1" | "c2" }> = ({ seg, cta }) => {
  const frame = useCurrentFrame();
  const w = seg.words;
  const { suna, tap } = shopifyCtaTimes(seg);
  const clear = suna - 5;
  let rows: Row[];
  if (cta === "c1") {
    rows = [
      { kind: "text", words: ws(w, 0, 3), size: 108, to: clear },
      { kind: "text", words: [joined(w, 4, 4, "tomato")], size: 124, to: clear },
      { kind: "text", words: ws(w, 5, 8), size: 92, to: clear },
      { kind: "text", words: ws(w, 9, 11), size: 108, to: clear },
      { kind: "text", words: ws(w, 12, 13), size: 108, to: clear },
    ];
  } else {
    const p2 = Math.round(w[5].f) - 3;
    rows = [
      { kind: "text", words: ws(w, 0, 0), size: 124, to: p2 },
      { kind: "text", words: ws(w, 1, 1), size: 124, to: p2 },
      { kind: "text", words: ws(w, 2, 4), size: 124, to: p2 },
      { kind: "text", words: ws(w, 5, 7), size: 116, from: p2, to: clear },
      { kind: "text", words: ws(w, 8, 10), size: 116, from: p2, to: clear },
    ];
  }
  const mark = sp(frame, suna - 4, "bouncy");
  const draw = p(frame, suna - 4, 16, easeInOut);
  const letters = "MERIDIAN".split("");
  const pillY = 990;
  return (
    <AbsoluteFill>
      <Rebus rows={rows} center={880} />
      {frame >= suna - 4 && (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 500, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
            <div style={{ transform: `scale(${mix(0.05, 1, mark)})` }}>
              <MeridianMark size={150} color={SHOP.ink} draw={draw} />
            </div>
            <div style={{ display: "flex", fontFamily: SATOSHI, fontWeight: 700, fontSize: 52, letterSpacing: "0.26em", color: SHOP.ink }}>
              {letters.map((ch, i) => {
                const t = p(frame, suna + 2 + i * 1.4, 6);
                return (
                  <span key={i} style={{ display: "inline-block", opacity: t, transform: `translateX(${(1 - t) * -12}px)` }}>
                    {ch}
                  </span>
                );
              })}
            </div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: pillY - 75, display: "flex", justifyContent: "center" }}>
            <NumberPill at={suna} fillAt={tap} number={PHONE} />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: pillY + 110, textAlign: "center", fontFamily: SATOSHI, fontWeight: 400, fontSize: 36, color: SHOP.ink, opacity: 0.7 * p(frame, suna + 18, 10) }}>
            {DOMAIN}
          </div>
          <TapRing x={700} y={pillY + 20} at={tap} color={SHOP.ink} />
          <Hand
            keys={[
              { f: tap - 13, x: 1000, y: 1700 },
              { f: tap - 4, x: 700, y: pillY + 20 },
              { f: tap + 12, x: 1040, y: 1880 },
            ]}
            taps={[tap]}
          />
        </>
      )}
    </AbsoluteFill>
  );
};
