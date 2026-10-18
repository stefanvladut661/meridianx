import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Footage, Still } from "../components/Footage";
import { MeridianMark, PhoneIcon } from "../components/icons";
import { ShotName, STILL_LIST, STILLS, StillName } from "../data/footage";
import { easeIn, easeInOut, easeOut, mix, p, rnd, sp, throwOut } from "../lib/anim";
import type { Seg } from "../lib/timeline";
import { HOST, LARVEN, SATOSHI } from "../theme";
import { LarvenTitle, linesFrom, TitleLine } from "./Title";

// Cele cinci secvențe Larven ale body-ului, una pe frază. Fiecare începe pe o
// tăietură, cu conținut deja în cadru, și se termină curat, așa că oricare
// două se pot lega una după alta, în orice combinație.

type P = { seg: Seg };
const wf = (seg: Seg, i: number) => Math.round(seg.words[Math.min(i, seg.words.length - 1)].f);
const TOP = 330;

// ——— 1. „Ne ocupăm de tot ce ține de imaginea online." ——————————————————
// Un carusel de filmări verticale care se rotește în spatele titlului.

const RING: StillName[] = ["pizzaFinal", "latteArt", "affogato", "threeScoops", "flames", "capreseFly", "cappuccino", "pizzaBoard"];

export const LarvenSeq1: React.FC<P> = ({ seg }) => {
  const frame = useCurrentFrame();
  const fTot = wf(seg, 3);
  const N = 10;
  const R = 520;
  const CW = 300;
  const CH = 533;
  const theta = -150 + 150 * sp(frame, 0, "soft") + frame * 0.25 + 150 * p(frame, seg.D - 7, 7, easeIn);
  const bump = sp(frame, fTot - 2, "bouncy") - sp(frame, fTot + 6, "soft");
  const r = R * (1 + 0.09 * bump);
  const lines = linesFrom(seg.words, [{ n: 4 }, { n: 3, color: "grey" }, { n: 2, color: "blue", underline: true }]);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ perspective: 1300, perspectiveOrigin: "540px 760px" }}>
        <div style={{ position: "absolute", left: 540, top: 1130, transformStyle: "preserve-3d", transform: `translateZ(${-r - 120}px) rotateX(-14deg) rotateY(${theta}deg)` }}>
          {Array.from({ length: N }, (_, i) => {
            // Cât de spre cameră e cardul: 1 în față, -1 în spate. Cele din spate se sting.
            const facing = Math.cos((((i * 360) / N + theta) * Math.PI) / 180);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: -CW / 2,
                  top: -CH / 2,
                  transformStyle: "preserve-3d",
                  transform: `rotateY(${(i * 360) / N}deg) translateZ(${r}px)`,
                  filter: `brightness(${mix(0.28, 1, (facing + 1) / 2)})`,
                }}
              >
                {i === 0 ? <Footage shot="carbonaraFly" w={CW} h={CH} radius={24} /> : <Still still={RING[(i - 1) % RING.length]} w={CW} h={CH} radius={24} />}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 900, background: "linear-gradient(180deg, rgba(5,7,11,0.85) 0%, rgba(5,7,11,0.6) 55%, rgba(5,7,11,0) 100%)" }} />
      <LarvenTitle lines={lines} size={112} top={TOP} exitAt={seg.D - 7} />
    </AbsoluteFill>
  );
};

// ——— 2. „Venim cu ideile și scriem scenariile." ————————————————————————
// Ideile ies ca niște cadre împrăștiate în adâncime; la „scriem" patru dintre
// ele se așază în ordine, ca un storyboard, cu dâra din video-ul larven.

const IDEA: StillName[] = ["dough", "flames", "carbonaraFly", "latteArt", "sauce", "affogato", "guestSmile", "pizzaPeel"];
const KEEP = [1, 0, 7, 3];
const STRIP_Y = 1060;

export const LarvenSeq2: React.FC<P> = ({ seg }) => {
  const frame = useCurrentFrame();
  const fIdei = wf(seg, 2);
  const fScriem = wf(seg, 4);
  const fScen = wf(seg, 5);
  const lines = linesFrom(seg.words, [{ n: 3 }, { n: 3, color: "blue", underline: true }]);
  const exit = p(frame, seg.D - 7, 7, easeIn);

  const pose = (i: number, t: number) => {
    const born = sp(t, Math.min(fIdei - 6, 4) + i * 1.5, "snap");
    const sx = 140 + rnd(i * 3.1) * 800;
    const sy = 860 + rnd(i * 7.7) * 640;
    const sz = -900 + rnd(i * 5.3) * 950;
    const float = Math.sin(t / 14 + i) * 10;
    const scat = {
      x: mix(540, sx, born),
      y: mix(760, sy, born) + float,
      z: mix(-200, sz, born),
      rx: (rnd(i * 2.2) - 0.5) * 70 * born,
      ry: (rnd(i * 4.4) - 0.5) * 80 * born,
      rz: (rnd(i * 6.6) - 0.5) * 50 * born,
      s: mix(0.2, 1, born),
      o: Math.min(1, born * 2.5),
    };
    const slot = KEEP.indexOf(i);
    const o = sp(t, fScriem - 2 + Math.max(0, slot) * 1.5, "snap");
    if (slot >= 0) {
      const tx = 540 + (slot - 1.5) * 250 - 1260 * exit;
      return { x: mix(scat.x, tx, o), y: mix(scat.y, STRIP_Y, o), z: mix(scat.z, 0, o), rx: scat.rx * (1 - o), ry: scat.ry * (1 - o), rz: scat.rz * (1 - o), s: mix(scat.s, 1.12, o), o: scat.o };
    }
    const away = p(t, fScriem - 2, 12, throwOut);
    const dir = sx < 540 ? -1 : 1;
    return { ...scat, x: scat.x + dir * 900 * away, z: scat.z - 600 * away, o: scat.o * (1 - away) };
  };

  const card = (i: number, t: number, ghost: number) => {
    const q = pose(i, t);
    return (
      <div
        key={`${i}-${ghost}`}
        style={{
          position: "absolute",
          left: q.x - 105,
          top: q.y - 186,
          transformStyle: "preserve-3d",
          transform: `translateZ(${q.z}px) rotateX(${q.rx}deg) rotateY(${q.ry}deg) rotateZ(${q.rz}deg) scale(${q.s})`,
          opacity: q.o * (ghost ? 0.22 / ghost : 1),
        }}
      >
        <Still still={IDEA[i]} w={210} h={373} radius={18} style={{ boxShadow: ghost ? undefined : "0 30px 60px rgba(0,0,0,0.5)" }} />
      </div>
    );
  };

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ perspective: 1600, perspectiveOrigin: "540px 1000px" }}>
        {IDEA.map((_, i) => {
          const flying = frame >= fScriem - 2 && frame < fScriem + 12 && KEEP.includes(i);
          return (
            <React.Fragment key={i}>
              {flying && [3, 2, 1].map((g) => card(i, frame - g * 2, g))}
              {card(i, frame, 0)}
            </React.Fragment>
          );
        })}
      </AbsoluteFill>
      {KEEP.map((_, slot) => {
        const t = p(frame, fScen + slot * 2, 8);
        return (
          <div
            key={slot}
            style={{
              position: "absolute",
              left: 540 + (slot - 1.5) * 250 - 40 - 1260 * exit,
              top: STRIP_Y + 236,
              width: 80,
              textAlign: "center",
              fontFamily: HOST,
              fontWeight: 500,
              fontSize: 34,
              color: LARVEN.grey,
              opacity: t,
              transform: `translateY(${(1 - t) * 14}px)`,
            }}
          >
            {slot + 1}
          </div>
        );
      })}
      <LarvenTitle lines={lines} size={112} top={TOP} exitAt={seg.D - 7} />
    </AbsoluteFill>
  );
};

// ——— 3. „Facem cinematografie gastronomică, cu echipament profesional." ———
// Un card cu foc în cuptor vine din adâncime; la „gastronomică" camera intră
// în el și restul frazei e numai filmare pe tot ecranul, tăiată pe cuvinte.

export const LarvenSeq3: React.FC<P> = ({ seg }) => {
  const frame = useCurrentFrame();
  const fDive = wf(seg, 2) + 3;
  const dive = p(frame, fDive, 13, easeInOut);
  const approach = p(frame, 0, fDive, easeOut);
  const lines = linesFrom(seg.words.slice(0, 3), [{ n: 1 }, { n: 1 }, { n: 1, color: "blue" }]);

  // Tăieturi pe cuvintele de după scufundare (cel puțin 9 cadre între ele).
  const montage: { f: number; shot: ShotName }[] = [{ f: 0, shot: "flames" }];
  const next: ShotName[] = ["pizzaInOven", "latteArt", "carbonaraFly", "milkPour"];
  let last = fDive + 13;
  for (const i of [3, 4, 5]) {
    const f = wf(seg, i) - 1;
    if (f - last >= 9 && montage.length - 1 < next.length) {
      montage.push({ f, shot: next[montage.length - 1] });
      last = f;
    }
  }
  const cur = montage.filter((m) => frame >= m.f).at(-1)!;
  const w = mix(400, 1080, dive);
  const h = mix(711, 1920, dive);
  const y = mix(1130, 960, dive);
  const z = mix(-380 + 220 * approach, 0, dive);
  const zoom = cur.f === 0 ? 1 : 1 + 0.05 * p(frame, cur.f, 40, easeOut);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ perspective: 1600, perspectiveOrigin: "540px 1000px" }}>
        <div
          style={{
            position: "absolute",
            left: 540 - w / 2,
            top: y - h / 2,
            width: w,
            height: h,
            transform: `translateZ(${z}px) rotateX(${mix(12, 0, dive)}deg) rotateY(${mix(-14, 0, dive)}deg)`,
          }}
        >
          {montage.map((m, i) =>
            m === cur ? (
              <Sequence key={i} from={m.f} layout="none">
                <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})` }}>
                  <Footage shot={m.shot} w={w} h={h} radius={mix(26, 0, dive)} />
                </div>
              </Sequence>
            ) : null,
          )}
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, opacity: 1 - dive, transform: `scale(${1 + 0.6 * dive})`, transformOrigin: "540px 520px" }}>
        <LarvenTitle lines={lines} size={124} top={TOP} />
      </div>
    </AbsoluteFill>
  );
};

/** Momentele tăieturilor din montajul secvenței 3, pentru sunet. */
export const larvenSeq3Cuts = (seg: Seg) => {
  const fDive = wf(seg, 2) + 3;
  const out = [fDive];
  let last = fDive + 13;
  for (const i of [3, 4, 5]) {
    const f = wf(seg, i) - 1;
    if (f - last >= 9 && out.length < 5) {
      out.push(f);
      last = f;
    }
  }
  return out;
};

// ——— 4. „Edităm, publicăm și administrăm campaniile… oameni noi la masă." ——
// Grila de reclame se umple, apar telefoanele, grila se înclină cu reclamele
// care rulează scoase în față, apoi „Oameni noi la masă."

const COLS = 6;
const ROWS = 6;
const TW = 200;
const TH = 356;
const GAP = 22;
const PW = COLS * TW + (COLS - 1) * GAP;
const PH = ROWS * TH + (ROWS - 1) * GAP;
// Celulele scoase în față la „administrăm" și ce cadru stă în fiecare.
const HIGHLIGHT_AT: Record<number, StillName> = {
  8: "pizzaFinal",
  14: "latteArt",
  15: "carbonaraFly",
  20: "threeScoops",
  21: "affogato",
  27: "capreseFly",
};
const HIGHLIGHT = new Set(Object.keys(HIGHLIGHT_AT).map(Number));
const GRID_ORDER = Array.from({ length: COLS * ROWS }, (_, i) => {
  const c = i % COLS;
  const r = Math.floor(i / COLS);
  return { i, c, r, d: Math.hypot(c - (COLS - 1) / 2, (r - (ROWS - 1) / 2) * 1.1) };
});
const RANK = new Map([...GRID_ORDER].sort((a, b) => a.d - b.d).map((t, k) => [t.i, k]));
const GRID_STILLS: string[] = (() => {
  const used = new Set(Object.values(HIGHLIGHT_AT).map((n) => STILLS[n]));
  const rest = STILL_LIST.filter((s) => !used.has(s));
  let k = 0;
  return Array.from({ length: COLS * ROWS }, (_, i) => (HIGHLIGHT.has(i) ? STILLS[HIGHLIGHT_AT[i]] : rest[k++ % rest.length]));
})();

const PhoneScreen: React.FC<{ shot: ShotName; at: number; handle: string; label: string }> = ({ shot, at, handle, label }) => (
  <div style={{ width: 404, height: 830, borderRadius: 60, padding: 10, background: "linear-gradient(160deg, #2A2C33 0%, #121317 45%, #1C1E23 100%)", boxShadow: "0 0 0 1.5px rgba(255,255,255,0.12), 0 50px 100px rgba(0,0,0,0.65)" }}>
    <div style={{ position: "relative", width: 384, height: 810, borderRadius: 50, overflow: "hidden", background: "#000" }}>
      <Footage shot={shot} at={at} w={384} h={810} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.62) 100%)" }} />
      <div style={{ position: "absolute", top: 14, left: "50%", width: 104, height: 30, marginLeft: -52, borderRadius: 15, background: "#000" }} />
      <div style={{ position: "absolute", left: 18, right: 18, bottom: 26, fontFamily: HOST, color: "#fff" }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>{handle}</div>
        <div style={{ fontSize: 15, opacity: 0.85, marginTop: 2 }}>Sponsorizat</div>
        <div style={{ marginTop: 12, height: 46, borderRadius: 9, background: "rgba(255,255,255,0.94)", color: "#111", fontSize: 17, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>{label}</div>
      </div>
    </div>
  </div>
);

export const LarvenSeq4: React.FC<P> = ({ seg }) => {
  const frame = useCurrentFrame();
  const fPub = wf(seg, 1);
  const fAdm = wf(seg, 3);
  const fMasa = wf(seg, 9);
  const phonesOut = Math.min(fMasa - 26, Math.max(fAdm + 20, fPub + 40));
  const pull = p(frame, -4, 28, easeInOut);
  const tilt = p(frame, phonesOut - 6, 22, easeInOut);
  const phonesIn = p(frame, fPub - 4, 16);
  const phonesExit = p(frame, phonesOut - 6, 12, easeInOut);
  const phones = phonesIn * (1 - phonesExit);
  const live = p(frame, phonesOut + 2, 14);
  const masa = p(frame, fMasa - 4, 12, easeInOut);
  const exit = p(frame, seg.D - 6, 6, easeIn);
  const cy = 1000;
  const scale = mix(2.3, 1.02, pull) * mix(1, 0.92, tilt) * mix(1, 1.06, masa);
  const blur = 9 * phones + 6 * masa;
  const bright = 1 - 0.5 * phones - 0.58 * masa;
  const dim = live > 0 ? `brightness(${1 - 0.55 * live}) saturate(${1 - 0.75 * live})` : "";

  const top: TitleLine[] = [
    { words: [seg.words[0], seg.words[1]].map((w) => ({ text: w.text, at: w.f })), color: "ink" },
    { words: seg.words.slice(2, 4).map((w) => ({ text: w.text, at: w.f })), color: "grey" },
    { words: seg.words.slice(4, 5).map((w) => ({ text: w.text, at: w.f })), color: "grey" },
  ];
  const masaLines: TitleLine[] = [
    { words: seg.words.slice(9, 11).map((w, i) => ({ text: i === 0 ? "Oameni" : w.text, at: w.f })), color: "ink" },
    { words: seg.words.slice(11, 13).map((w) => ({ text: w.text, at: w.f })), color: "blue", underlineAt: wf(seg, 12) + 4 },
  ];

  return (
    <AbsoluteFill style={{ opacity: 1 - exit }}>
      <AbsoluteFill style={{ perspective: 1900, perspectiveOrigin: `540px ${cy}px`, filter: blur > 0.2 || bright < 0.99 ? `blur(${blur}px) brightness(${bright})` : undefined }}>
        <div
          style={{
            position: "absolute",
            left: 540 - PW / 2,
            top: cy - PH / 2,
            width: PW,
            height: PH,
            transformStyle: "preserve-3d",
            transform: `rotateX(${34 * tilt}deg) rotateZ(${-22 * tilt}deg) scale(${scale})`,
          }}
        >
          {GRID_ORDER.map((t) => {
            const at = -2 + (RANK.get(t.i) ?? 0) * 0.5;
            const f = p(frame, at, 8);
            const hi = HIGHLIGHT.has(t.i) ? live : 0;
            return (
              <div
                key={t.i}
                style={{
                  position: "absolute",
                  left: t.c * (TW + GAP),
                  top: t.r * (TH + GAP),
                  width: TW,
                  height: TH,
                  borderRadius: 16,
                  overflow: "hidden",
                  background: "#121318",
                  transform: `translateZ(${hi * 70}px) scale(${1 + hi * 0.08})`,
                  boxShadow: hi > 0 ? `0 0 0 ${3 * hi}px ${LARVEN.blueDeep}, 0 24px 50px rgba(0,0,0,0.6)` : undefined,
                }}
              >
                <Still
                  still={GRID_STILLS[t.i]}
                  w={TW}
                  h={TH}
                  style={{ opacity: f, transform: `scale(${mix(1.25, 1, f)})` }}
                  filter={HIGHLIGHT.has(t.i) ? undefined : dim || undefined}
                />
                {hi > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 12,
                      bottom: 12,
                      height: 34,
                      padding: "0 13px",
                      borderRadius: 17,
                      background: LARVEN.blueDeep,
                      color: "#fff",
                      fontFamily: HOST,
                      fontSize: 18,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      opacity: hi,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: "#fff" }} />
                    LIVE
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {phones > 0 &&
        [
          { x: 84, label: "Instagram & Facebook", shot: "pizzaInOven" as ShotName, handle: "restaurantultau", btn: "Rezervă o masă", d: 0 },
          { x: 592, label: "TikTok", shot: "latteArt" as ShotName, handle: "@restaurantultau", btn: "Rezervă acum", d: 4 },
        ].map((ph) => {
          const t = p(frame, fPub - 4 + ph.d, 16) * (1 - phonesExit);
          return (
            <div
              key={ph.label}
              style={{
                position: "absolute",
                left: ph.x,
                top: 690,
                opacity: Math.min(1, t * 2),
                transform: `perspective(1600px) translateY(${mix(280, 0, t) + 120 * phonesExit}px) rotateX(${mix(28, 0, t)}deg)`,
              }}
            >
              <div style={{ textAlign: "center", fontFamily: HOST, fontSize: 25, fontWeight: 500, color: "#C9CFDB", marginBottom: 16 }}>{ph.label}</div>
              <PhoneScreen shot={ph.shot} at={fPub - 4 + ph.d} handle={ph.handle} label={ph.btn} />
            </div>
          );
        })}

      {masa < 1 && (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - masa }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 820, background: "linear-gradient(180deg, rgba(5,7,11,0.9) 0%, rgba(5,7,11,0.62) 62%, rgba(5,7,11,0) 100%)" }} />
          <LarvenTitle lines={top} size={92} top={TOP - 20} />
        </div>
      )}
      {masa > 0 && <LarvenTitle lines={masaLines} size={146} top={cy - 170} />}
    </AbsoluteFill>
  );
};

// ——— 5. „În fiecare lună primești o analiză de performanță și propuneri…" ——
// Un perete-calendar, înclinat în perspectivă, cu câte o filmare pe fiecare zi
// a lunii, care se umple zi cu zi. La „analiză" o linie albastră îl citește
// rând cu rând și marchează ce a mers; la „propuneri" peretele se întoarce pe
// spate: luna următoare, cu zilele încă goale, care se aprind pe rând.

const CAL_COLS = 7;
const CAL_ROWS = 5;
const CW5 = 116;
const CH5 = 206;
const CG5 = 12;
const CAL_W = CAL_COLS * CW5 + (CAL_COLS - 1) * CG5;
const CAL_H = CAL_ROWS * CH5 + (CAL_ROWS - 1) * CG5;
const CAL_CY = 1190;
const BEST = new Set([8, 12, 17, 23, 30]);

export const LarvenSeq5: React.FC<P> = ({ seg }) => {
  const frame = useCurrentFrame();
  const fAn = wf(seg, 5);
  const fProp = wf(seg, 9);
  const fLuna = wf(seg, 11);
  const w = seg.words;
  const at = (i: number) => ({ text: w[i].text, at: w[i].f });
  const lines: TitleLine[] = [
    { words: [at(0), at(1), at(2)], color: "ink" },
    { words: [at(5), at(6), at(7)], color: "blue" },
    { words: [at(8), at(9), at(10)], color: "grey" },
    { words: [at(11), at(12)], color: "grey", underlineAt: wf(seg, 12) + 4 },
  ];
  const n = CAL_COLS * CAL_ROWS;
  const fillEnd = Math.min(fAn - 4, 34);
  const flip = p(frame, fProp - 4, 16, easeInOut);
  const scanRow = (frame - fAn) / 4.5;
  const dimAll = frame >= fAn ? p(frame, fAn - 2, 4) : 0;
  const settle = sp(frame, 0, "soft");
  const exit = p(frame, seg.D - 6, 6, easeIn);
  const cell = (k: number) => ({ left: (k % CAL_COLS) * (CW5 + CG5), top: Math.floor(k / CAL_COLS) * (CH5 + CG5) });

  return (
    <AbsoluteFill style={{ opacity: 1 - exit }}>
      <AbsoluteFill style={{ perspective: 1500, perspectiveOrigin: `540px ${CAL_CY - 200}px` }}>
        <div
          style={{
            position: "absolute",
            left: 540 - CAL_W / 2,
            top: CAL_CY - CAL_H / 2,
            width: CAL_W,
            height: CAL_H,
            transformStyle: "preserve-3d",
            transform: `rotateX(${mix(50, 34, settle)}deg) rotateZ(${mix(-14, -6, settle)}deg) rotateY(${180 * flip}deg)`,
          }}
        >
          {/* Fața: luna care a trecut, cu filmările ei. */}
          <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}>
            {Array.from({ length: n }, (_, k) => {
              const t = p(frame, (k * fillEnd) / n, 6, easeOut);
              const row = Math.floor(k / CAL_COLS);
              const scanned = frame >= fAn && scanRow >= row;
              const best = BEST.has(k) && scanned ? p(frame, fAn + row * 4.5 + 2, 6) : 0;
              const bright = frame < fAn ? 1 : scanned ? (BEST.has(k) ? 1 : 0.78) : mix(1, 0.4, dimAll);
              return (
                <div key={k} style={{ position: "absolute", ...cell(k), width: CW5, height: CH5, opacity: t, transform: `scale(${mix(0.6, 1, t) * (1 + best * 0.1)})`, zIndex: best > 0 ? 2 : 1 }}>
                  <Still still={STILL_LIST[(k * 7) % STILL_LIST.length]} w={CW5} h={CH5} radius={12} filter={bright < 0.999 ? `brightness(${bright}) saturate(${mix(0.4, 1, bright)})` : undefined} />
                  {best > 0 && <div style={{ position: "absolute", inset: -5, borderRadius: 16, border: `4px solid ${LARVEN.blue}`, opacity: best }} />}
                </div>
              );
            })}
            {frame >= fAn && scanRow < CAL_ROWS + 0.5 && (
              <div
                style={{
                  position: "absolute",
                  left: -20,
                  right: -20,
                  top: Math.min(CAL_H, scanRow * (CH5 + CG5)) - 3,
                  height: 6,
                  borderRadius: 3,
                  background: LARVEN.blue,
                  boxShadow: `0 0 24px ${LARVEN.blueDeep}`,
                }}
              />
            )}
          </div>
          {/* Spatele: luna următoare, zilele încă goale. */}
          <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            {Array.from({ length: n }, (_, k) => {
              const lit = p(frame, fLuna - 2 + k * 0.7, 6);
              return (
                <div
                  key={k}
                  style={{
                    position: "absolute",
                    ...cell(k),
                    width: CW5,
                    height: CH5,
                    borderRadius: 12,
                    border: `2.5px ${lit > 0.5 ? "solid" : "dashed"} rgba(77,139,255,${mix(0.5, 1, lit)})`,
                    background: `rgba(47,107,255,${0.22 * lit})`,
                    boxSizing: "border-box",
                  }}
                />
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 760, background: "linear-gradient(180deg, rgba(5,7,11,0.8) 0%, rgba(5,7,11,0.5) 65%, rgba(5,7,11,0) 100%)" }} />
      <LarvenTitle lines={lines} size={88} top={TOP} />
    </AbsoluteFill>
  );
};

export const LARVEN_SEQS = [LarvenSeq1, LarvenSeq2, LarvenSeq3, LarvenSeq4, LarvenSeq5];

// ——— CTA ————————————————————————————————————————————————————————————
// Finalul din video-ul larven: trei-patru rânduri alb / albastru / gri cu o
// linie sub ultimul. La „sună" titlul urcă și numărul devine eroul cadrului,
// apoi marca Meridian se desenează sub el. Numărul rămâne până la capăt.

export const LarvenCta: React.FC<{ seg: Seg; cta: "c1" | "c2" }> = ({ seg, cta }) => {
  const frame = useCurrentFrame();
  const w = seg.words;
  const at = (i: number) => ({ text: w[i].text, at: w[i].f });
  const suna = Math.round(seg.suna ?? w[w.length - 7].f);
  const lines: TitleLine[] =
    cta === "c1"
      ? [
          { words: [at(0), at(1)], color: "ink" },
          { words: [at(2), at(3), at(4)], color: "blue" },
          { words: [at(9), at(10), at(11)], color: "grey" },
          { words: [at(12), at(13)], color: "grey", underlineAt: w[13].f + 4 },
        ]
      : [
          { words: [at(0), at(1)], color: "ink" },
          { words: [at(2), at(3), at(4)], color: "blue", underlineAt: w[4].f + 4 },
          { words: [at(5), at(6), at(7)], color: "grey" },
          { words: [at(8), at(9), at(10)], color: "grey" },
        ];
  const up = p(frame, suna - 4, 16, easeInOut);
  const digits = "0771 738 607";
  const markT = p(frame, suna + 12, 22, easeInOut);
  const iconIn = sp(frame, suna - 3, "bouncy");
  const under = p(frame, suna + digits.length * 1.2 + 4, 14, easeInOut);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${-210 * up}px) scale(${mix(1, 0.74, up)})`, transformOrigin: "540px 330px", opacity: mix(1, 0.75, up) }}>
        <LarvenTitle lines={lines} size={104} top={360} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 860, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            width: 92,
            height: 92,
            borderRadius: 46,
            background: LARVEN.blueDeep,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${iconIn})`,
            marginBottom: 26,
          }}
        >
          <PhoneIcon size={46} color="#fff" />
        </div>
        <div style={{ position: "relative", display: "flex", fontFamily: HOST, fontWeight: 500, fontSize: 136, letterSpacing: "-0.02em", color: LARVEN.ink, fontVariantNumeric: "tabular-nums" }}>
          {digits.split("").map((ch, i) => {
            const t = p(frame, suna + i * 1.2, 8, easeOut);
            return (
              <span key={i} style={{ display: "inline-block", whiteSpace: "pre", opacity: t, transform: `translateY(${(1 - t) * 0.32}em)` }}>
                {ch}
              </span>
            );
          })}
          <span style={{ position: "absolute", left: 4, right: 4, bottom: -6, height: 8, borderRadius: 4, background: LARVEN.blue, transform: `scaleX(${under})`, transformOrigin: "left center" }} />
        </div>
      </div>
      <CtaMark t={markT} top={1190} />
    </AbsoluteFill>
  );
};

const CtaMark: React.FC<{ t: number; top: number }> = ({ t, top }) => {
  // `t` merge 0→1: întâi se desenează marca, apoi intră numele și adresa.
  const word = Math.min(1, Math.max(0, (t - 0.35) / 0.5));
  const site = Math.min(1, Math.max(0, (t - 0.6) / 0.4));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <MeridianMark size={64} color={LARVEN.ink} draw={t} />
        <span style={{ fontFamily: SATOSHI, fontWeight: 700, fontSize: 40, letterSpacing: "0.26em", color: LARVEN.ink, opacity: word, transform: `translateX(${(1 - word) * -16}px)` }}>MERIDIAN</span>
      </div>
      <span style={{ fontFamily: HOST, fontSize: 32, color: LARVEN.grey, opacity: site }}>meridianx.ro</span>
    </div>
  );
};
