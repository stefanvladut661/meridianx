import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { Seg } from "../lib/timeline";
import { EditCard, Grid9, Hand, notifHeight, Notifications, NotesToScript, PhoneFan, TapRing, Viewfinder, MonthCard } from "./objects";
import { joined, Rebus, Row, rowCenter, ws } from "./Rebus";

// Cele cinci secvențe Shopify ale body-ului, una pe frază. Fiecare începe cu
// obiectul sau primul cuvânt deja în cadru și se încheie cu literele
// împrăștiate, ca oricare două să se poată lega una după alta.

type P = { seg: Seg };
const CENTER = 900;
const fw = (seg: Seg) => (i: number) => Math.round(seg.words[Math.min(i, seg.words.length - 1)].f);

// 1. „Ne ocupăm [cardul se sparge în tot ce ține de] imaginea online."
export const ShopifySeq1: React.FC<P> = ({ seg }) => {
  const f = fw(seg);
  const w = seg.words;
  const rows: Row[] = [
    { kind: "text", words: ws(w, 0, 1), size: 124 },
    { kind: "obj", h: 620, node: <Grid9 base="latteArt" at={0} splitAt={f(3) - 2} phoneAt={f(7) - 3} /> },
    { kind: "text", words: ws(w, 2, 6), size: 100 },
    { kind: "text", words: ws(w, 7, 8), size: 116 },
  ];
  return (
    <AbsoluteFill>
      <Rebus rows={rows} center={CENTER} exitAt={seg.D - 8} />
    </AbsoluteFill>
  );
};

// 2. „Venim cu ideile [notițe → pagină de scenariu] și scriem scenariile."
export const ShopifySeq2: React.FC<P> = ({ seg }) => {
  const f = fw(seg);
  const w = seg.words;
  const rows: Row[] = [
    { kind: "text", words: ws(w, 0, 2), size: 116 },
    { kind: "obj", h: 560, node: <NotesToScript noteAt={f(2) - 3} scriptAt={f(4) - 1} pluralAt={f(5) + 2} /> },
    { kind: "text", words: ws(w, 3, 4), size: 116 },
    { kind: "text", words: ws(w, 5, 5), size: 116 },
  ];
  return (
    <AbsoluteFill>
      <Rebus rows={rows} center={CENTER} exitAt={seg.D - 8} />
    </AbsoluteFill>
  );
};

// 3. „Facem [vizor] cinematografie gastronomică," apoi vizorul umple ecranul.
export const shopifySeq3Take = (seg: Seg) => fw(seg)(3) - 2;
export const ShopifySeq3: React.FC<P> = ({ seg }) => {
  const f = fw(seg);
  const w = seg.words;
  const takeAt = shopifySeq3Take(seg);
  const rows: Row[] = [
    { kind: "text", words: ws(w, 0, 0), size: 124, to: takeAt },
    {
      kind: "obj",
      h: 560,
      keepOnExit: true,
      node: (
        <Viewfinder
          at={0}
          takeAt={takeAt}
          center={CENTER}
          shots={[
            { f: 0, shot: "flames" },
            { f: Math.max(takeAt + 12, f(4) - 1), shot: "pizzaInOven" },
            { f: Math.max(takeAt + 24, f(5) - 1), shot: "latteArt" },
          ]}
        />
      ),
    },
    { kind: "text", words: ws(w, 1, 1), size: 112, to: takeAt },
    { kind: "text", words: ws(w, 2, 2), size: 112, to: takeAt },
  ];
  return (
    <AbsoluteFill>
      <Rebus rows={rows} center={CENTER} />
    </AbsoluteFill>
  );
};

// 4. „Edităm, [card tăiat] publicăm [clic] și administrăm [telefoane]
//    campaniile de promovare care aduc [rezervări] oameni noi la masă."
export const shopifySeq4Times = (seg: Seg) => {
  const f = fw(seg);
  return { tap: f(1) - 1, p2: f(3) - 3, p3: f(7) - 3, scatter: seg.D - 12 };
};
export const ShopifySeq4: React.FC<P> = ({ seg }) => {
  const frame = useCurrentFrame();
  const f = fw(seg);
  const w = seg.words;
  const { tap, p2, p3, scatter } = shopifySeq4Times(seg);
  const rows: Row[] = [
    { kind: "text", words: ws(w, 7, 8), size: 116, from: p3 },
    { kind: "text", words: ws(w, 2, 3), size: 108, from: p2, to: p3 },
    { kind: "text", words: ws(w, 0, 0), size: 124, to: p2 },
    { kind: "obj", h: 600, to: p2, node: <EditCard at={0} cutAt={Math.max(2, f(0) + 2)} flipAt={tap + 4} shot="pizzaInOven" post="carbonaraFly" /> },
    { kind: "obj", h: 520, from: p2, to: p3, node: <PhoneFan at={p2} shots={["latteArt", "pizzaFinal", "capreseFly"]} /> },
    { kind: "obj", h: notifHeight(frame, p3 + 2, 3, 6), from: p3, node: <Notifications at={p3 + 2} every={3} count={6} scatterAt={scatter} /> },
    { kind: "text", words: ws(w, 1, 1), size: 116, to: p2 },
    { kind: "text", words: ws(w, 4, 6), size: 92, from: p2, to: p3 },
    { kind: "text", words: ws(w, 9, 10), size: 116, from: p3 },
    { kind: "text", words: [joined(w, 11, 12, "saffron")], size: 116, from: p3 },
  ];
  const cardY = rowCenter(rows, 3, tap, CENTER);
  return (
    <AbsoluteFill>
      <Rebus rows={rows} center={CENTER} exitAt={seg.D - 6} />
      <TapRing x={600} y={cardY + 180} at={tap} />
      <Hand
        keys={[
          { f: tap - 14, x: 980, y: 1720 },
          { f: tap - 5, x: 600, y: cardY + 180 },
          { f: tap + 10, x: 1060, y: 1900 },
        ]}
        taps={[tap]}
      />
    </AbsoluteFill>
  );
};

// 5. „În fiecare [calendar → raport → luna 2] primești o analiză de
//    performanță și propuneri pentru luna următoare."
export const shopifySeq5Times = (seg: Seg) => {
  const f = fw(seg);
  return { cal: f(2) - 3, p2: f(5) - 3, p3: f(8) - 3, notes: f(9) - 2, next: f(11) - 3 };
};
export const ShopifySeq5: React.FC<P> = ({ seg }) => {
  const w = seg.words;
  const t = shopifySeq5Times(seg);
  const rows: Row[] = [
    { kind: "text", words: ws(w, 0, 1), size: 124, to: t.p2 },
    { kind: "text", words: ws(w, 5, 6), size: 116, from: t.p2, to: t.p3 },
    { kind: "text", words: ws(w, 8, 9), size: 116, from: t.p3 },
    { kind: "obj", h: 520, from: t.cal, node: <MonthCard at={t.cal} reportAt={t.p2 + 2} notesAt={t.notes} nextAt={t.next} /> },
    { kind: "text", words: ws(w, 3, 4), size: 116, to: t.p2 },
    { kind: "text", words: ws(w, 7, 7), size: 116, from: t.p2, to: t.p3 },
    { kind: "text", words: ws(w, 10, 12), size: 92, from: t.p3 },
  ];
  return (
    <AbsoluteFill>
      <Rebus rows={rows} center={CENTER} exitAt={seg.D - 7} />
    </AbsoluteFill>
  );
};

export const SHOPIFY_SEQS = [ShopifySeq1, ShopifySeq2, ShopifySeq3, ShopifySeq4, ShopifySeq5];
