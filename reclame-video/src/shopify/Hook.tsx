import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Footage, Still } from "../components/Footage";
import { MeridianMark } from "../components/icons";
import { StillName } from "../data/footage";
import { HookId } from "../data/script";
import { easeInOut, mix, p, sp } from "../lib/anim";
import type { Seg } from "../lib/timeline";
import { SATOSHI, SHOP } from "../theme";
import { EmptyCard, Fan3, PhoneShell, VideoCard } from "./objects";
import { joined, Rebus, Row, ws } from "./Rebus";

// Hookurile în stilul Shopify: propoziția hookului, cu un obiect în locul
// unui cuvânt. Sigla Meridian stă sus de la primul cadru, ca în referință.

export const ShopifyLogo: React.FC<{ top?: number }> = ({ top = 236 }) => (
  <div style={{ position: "absolute", top, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 14 }}>
    <MeridianMark size={42} color={SHOP.ink} />
    <span style={{ fontFamily: SATOSHI, fontWeight: 700, fontSize: 26, letterSpacing: "0.26em", color: SHOP.ink }}>MERIDIAN</span>
  </div>
);

/** Cardul restaurantului care, la `splitAt`, își scoate alături dublura de pe telefon. */
const PairCard: React.FC<{ at: number; splitAt: number }> = ({ at, splitAt }) => {
  const frame = useCurrentFrame();
  const s = sp(frame, splitAt, "snap");
  const e = sp(frame, at, "bouncy");
  return (
    <div style={{ position: "absolute", transform: `translateY(${(1 - e) * 520}px) rotate(${(1 - e) * -10}deg)`, opacity: frame < at ? 0 : 1 }}>
      {s > 0 && (
        <div style={{ position: "absolute", left: mix(0, 175, s) - 150, top: -282, transform: `rotate(${4 * s}deg) scale(${mix(0.8, 1, s)})`, opacity: Math.min(1, s * 2) }}>
          <PhoneShell w={300} h={564}>
            <Footage shot="guestSmile" at={splitAt} w={272} h={536} />
          </PhoneShell>
        </div>
      )}
      <div style={{ position: "absolute", left: mix(0, -165, s) - 150, top: -267, transform: `rotate(${-4 * s}deg)`, borderRadius: 26, boxShadow: "0 30px 70px rgba(0,0,0,0.45)" }}>
        <Footage shot="guestSmile" at={at} w={300} h={533} radius={26} />
      </div>
    </div>
  );
};

const FEED: StillName[] = ["pizzaFinal", "latteArt", "carbonaraFly", "affogato", "flames", "capreseFly", "threeScoops", "cutting", "pizzaBoard"];

/** Telefon cu feed-ul restaurantului: se umple, apoi postările se sting una câte una. */
const FeedPhone: React.FC<{ fillAt: number; fadeAt: number }> = ({ fillAt, fadeAt }) => {
  const frame = useCurrentFrame();
  const e = sp(frame, 0, "bouncy");
  return (
    <div style={{ position: "absolute", left: -155, top: -280, transform: `translateY(${(1 - e) * 520}px)` }}>
      <PhoneShell w={310} h={560}>
        <div style={{ position: "absolute", inset: 0, background: "#F7F3EA", padding: "44px 10px 0", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 6px 14px" }}>
            <div style={{ width: 50, height: 50, borderRadius: 25, background: SHOP.tomato }} />
            <div>
              <div style={{ width: 120, height: 12, borderRadius: 6, background: "#1D2A22", opacity: 0.8 }} />
              <div style={{ width: 80, height: 10, borderRadius: 5, background: "#1D2A22", opacity: 0.25, marginTop: 8 }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
            {FEED.map((s, k) => {
              const t = sp(frame, fillAt + k * 1.3, "snap");
              const fade = p(frame, fadeAt + (8 - k) * 1.6, 8);
              return (
                <div key={k} style={{ height: 146, background: "#DDD6C8", overflow: "hidden" }}>
                  <div style={{ opacity: t, transform: `scale(${mix(0.6, 1, t)})` }}>
                    <Still still={s} w={93} h={146} filter={fade > 0 ? `grayscale(${fade}) brightness(${mix(1, 0.55, fade)})` : undefined} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </PhoneShell>
    </div>
  );
};

export const ShopifyHook: React.FC<{ seg: Seg; hook: HookId }> = ({ seg, hook }) => {
  const frame = useCurrentFrame();
  const w = seg.words;
  const f = (i: number) => Math.round(w[i].f);
  const exitAt = seg.D - 9;
  let rows: Row[] = [];
  if (hook === "h1" || hook === "h2") {
    const pb = f(6) - 3;
    const fan: Row = {
      kind: "obj",
      h: 480,
      from: f(1) - 3,
      node: <Fan3 at={f(1) - 3} shots={["pizzaInOven", "guestMenu", "latteArt"]} growAt={hook === "h1" ? f(10) - 2 : undefined} joinAt={hook === "h2" ? f(8) - 2 : undefined} />,
    };
    rows =
      hook === "h1"
        ? [
            { kind: "text", words: ws(w, 6, 10), size: 92, from: pb },
            { kind: "text", words: ws(w, 0, 0), size: 124, to: pb },
            fan,
            { kind: "text", words: ws(w, 2, 3), size: 116, to: pb },
            { kind: "text", words: [joined(w, 4, 5, "tomato")], size: 116, to: pb },
            { kind: "text", words: ws(w, 11, 13), size: 116, from: pb },
          ]
        : [
            { kind: "text", words: ws(w, 6, 8), size: 100, from: pb },
            { kind: "text", words: ws(w, 0, 0), size: 124, to: pb },
            fan,
            { kind: "text", words: ws(w, 2, 3), size: 116, to: pb },
            { kind: "text", words: [joined(w, 4, 5, "tomato")], size: 116, to: pb },
            { kind: "text", words: ws(w, 9, 10), size: 110, from: pb },
            { kind: "text", words: ws(w, 11, 13), size: 110, from: pb },
          ];
  }
  if (hook === "h3") {
    const pb = f(5) - 3;
    rows = [
      { kind: "text", words: ws(w, 5, 7), size: 108, from: pb },
      { kind: "text", words: ws(w, 0, 1), size: 124, to: pb },
      { kind: "text", words: ws(w, 2, 3), size: 124, to: pb },
      { kind: "obj", h: 560, from: f(4) - 3, node: <VideoCard shot="dough" at={f(4) - 3} flipAt={f(7) - 4} back={<EmptyCard />} /> },
      { kind: "text", words: ws(w, 8, 8), size: 124, from: pb },
    ];
  }
  if (hook === "h4") {
    const pb = f(5) - 3;
    rows = [
      { kind: "text", words: ws(w, 5, 7), size: 104, from: pb },
      { kind: "text", words: ws(w, 0, 2), size: 116, to: pb },
      { kind: "obj", h: 580, from: f(3) - 3, node: <PairCard at={f(3) - 3} splitAt={f(11) - 3} /> },
      { kind: "text", words: ws(w, 3, 4), size: 116, to: pb },
      { kind: "text", words: ws(w, 8, 11), size: 100, from: pb },
      { kind: "text", words: [joined(w, 12, 13, "saffron")], size: 116, from: pb },
    ];
  }
  if (hook === "h5") {
    const pb = f(5) - 3;
    rows = [
      { kind: "text", words: ws(w, 0, 1), size: 116, to: pb },
      { kind: "text", words: ws(w, 5, 6), size: 110, from: pb },
      { kind: "obj", h: 580, node: <FeedPhone fillAt={f(1) - 2} fadeAt={f(8) - 2} /> },
      { kind: "text", words: ws(w, 2, 4), size: 96, to: pb },
      { kind: "text", words: ws(w, 7, 9), size: 110, from: pb },
      { kind: "text", words: [joined(w, 10, 12, "saffron")], size: 100, from: pb },
    ];
  }
  if (hook === "h6") {
    const lone = sp(frame, f(6) - 2, "soft");
    rows = [
      { kind: "obj", h: 560, node: <VideoCard shot="pizzaFinal" at={0} scale={mix(1, 0.78, lone)} tilt={mix(0, -6, lone)} /> },
      { kind: "text", words: ws(w, 0, 1), size: 124 },
      { kind: "text", words: ws(w, 2, 4), size: 124 },
      { kind: "text", words: ws(w, 5, 5), size: 124 },
      { kind: "text", words: ws(w, 6, 6), size: 124 },
    ];
  }
  const logoOut = p(frame, exitAt, 8, easeInOut);
  return (
    <AbsoluteFill>
      <div style={{ opacity: 1 - logoOut }}>
        <ShopifyLogo />
      </div>
      <Rebus rows={rows} center={900} exitAt={exitAt} />
    </AbsoluteFill>
  );
};

/** Momentele de sunet ale hookului Shopify: apariția obiectului principal. */
export const shopifyHookCues = (seg: Seg, hook: HookId) => {
  const f = (i: number) => Math.round(seg.words[i].f);
  const at = { h1: f(1) - 3, h2: f(1) - 3, h3: f(4) - 3, h4: f(3) - 3, h5: 2, h6: 0 }[hook];
  return [{ f: at, sfx: "pop" as const }, { f: seg.D - 9, sfx: "swoosh" as const }];
};
