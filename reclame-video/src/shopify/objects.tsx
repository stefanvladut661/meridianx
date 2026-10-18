import React from "react";
import { useCurrentFrame } from "remotion";
import { Footage, Still } from "../components/Footage";
import { MotionBlur } from "../components/MotionBlur";
import { ForkKnifeIcon, HAND_TIP, HandCursor, MeridianMark, PhoneIcon } from "../components/icons";
import { ShotName, StillName } from "../data/footage";
import { easeIn, easeInOut, easeOut, mix, p, rnd, sp, springKeys, throwOut, vel } from "../lib/anim";
import { MONO, SATOSHI, SHOP } from "../theme";

// Obiectele care țin locul cuvintelor în stilul Shopify. Toate se desenează
// centrate în punctul (0,0) al rândului lor; mărimea o dă rândul.

const SHADOW = "0 30px 70px rgba(0,0,0,0.45), 0 6px 18px rgba(0,0,0,0.25)";

/** Intrarea din clipul de referință: obiectul urcă de jos, rotit, și se așază cu arc. */
const entry = (frame: number, at: number, dist = 520, turn = -10) => {
  const s = sp(frame, at, "bouncy");
  return { s, style: { transform: `translateY(${(1 - s) * dist}px) rotate(${(1 - s) * turn}deg)`, opacity: frame < at ? 0 : 1 } };
};

const Center: React.FC<{ w: number; h: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ w, h, children, style }) => (
  <div style={{ position: "absolute", left: -w / 2, top: -h / 2, width: w, height: h, ...style }}>{children}</div>
);

// ——— Card video vertical, cu întoarcere opțională ————————————————————————

export const VideoCard: React.FC<{
  shot?: ShotName;
  still?: StillName;
  at: number;
  w?: number;
  h?: number;
  flipAt?: number;
  back?: React.ReactNode;
  scale?: number;
  tilt?: number;
}> = ({ shot, still, at, w = 300, h = 533, flipAt, back, scale = 1, tilt = 0 }) => {
  const frame = useCurrentFrame();
  const e = entry(frame, at);
  const flip = flipAt === undefined ? 0 : p(frame, flipAt, 14, easeInOut);
  return (
    <Center w={w} h={h} style={{ ...e.style, perspective: 1400 }}>
      <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `scale(${scale}) rotateY(${180 * flip}deg) rotateZ(${tilt}deg)` }}>
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", borderRadius: 26, boxShadow: SHADOW }}>
          {shot ? <Footage shot={shot} at={at} w={w} h={h} radius={26} /> : <Still still={still ?? "pizzaFinal"} w={w} h={h} radius={26} />}
        </div>
        {back && (
          <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            {back}
          </div>
        )}
      </div>
    </Center>
  );
};

/** Spatele gol al unui card: locul în care ar trebui să fie ceva. */
export const EmptyCard: React.FC<{ w?: number; h?: number; mark?: string }> = ({ w = 300, h = 533, mark = "?" }) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: 26,
      border: `3px dashed rgba(240,233,214,0.38)`,
      background: "rgba(240,233,214,0.04)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: SATOSHI,
      fontWeight: 300,
      fontSize: 190,
      color: "rgba(240,233,214,0.45)",
    }}
  >
    {mark}
  </div>
);

// ——— Evantai de trei carduri (trei restaurante) ——————————————————————————

export const Fan3: React.FC<{
  at: number;
  shots: [ShotName, ShotName, ShotName];
  growAt?: number;
  joinAt?: number;
}> = ({ at, shots, growAt, joinAt }) => {
  const frame = useCurrentFrame();
  const grow = growAt === undefined ? 0 : sp(frame, growAt, "bouncy");
  const join = joinAt === undefined ? 0 : sp(frame, joinAt, "snap");
  const W = 230;
  const H = 409;
  const pose = [
    { x: -215, y: 26, r: -11 },
    { x: 0, y: -6, r: 0 },
    { x: 215, y: 26, r: 11 },
  ];
  const meridianIn = joinAt === undefined ? 0 : sp(frame, joinAt + 4, "bouncy");
  return (
    <div style={{ position: "absolute", transform: `scale(${mix(1, 1.16, grow) * mix(1, 0.78, join)})` }}>
      {shots.map((shot, i) => {
        const e = entry(frame, at + i * 3, 560, (i - 1) * 14);
        const q = pose[i];
        const jx = (i - 1.5) * 250 - 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: mix(q.x, jx, join) - W / 2,
              top: mix(q.y, 0, join) - H / 2,
              transform: `${e.style.transform} rotate(${mix(q.r, 0, join)}deg)`,
              opacity: e.style.opacity,
              zIndex: i === 1 ? 2 : 1,
            }}
          >
            <div style={{ borderRadius: 24, boxShadow: SHADOW }}>
              <Footage shot={shot} at={at + i * 3} w={W} h={H} radius={24} />
            </div>
          </div>
        );
      })}
      {meridianIn > 0 && (
        <div style={{ position: "absolute", left: 1.5 * 250 - W / 2, top: -H / 2, transform: `translateY(${(1 - meridianIn) * 300}px) rotate(${(1 - meridianIn) * 12}deg)`, opacity: Math.min(1, meridianIn * 3) }}>
          <div style={{ width: W, height: H, borderRadius: 24, background: SHOP.ink, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: SHADOW }}>
            <MeridianMark size={120} color={SHOP.bg} />
          </div>
        </div>
      )}
    </div>
  );
};

// ——— Card care se sparge în 9 cadre și devine un feed pe telefon ————————

const NINE: StillName[] = ["pizzaFinal", "latteArt", "carbonaraFly", "flames", "affogato", "guestSmile", "capreseFly", "cutting", "threeScoops"];

export const Grid9: React.FC<{ base: StillName; at: number; splitAt: number; phoneAt: number }> = ({ base, at, splitAt, phoneAt }) => {
  const frame = useCurrentFrame();
  const W = 330;
  const H = 587;
  const e = entry(frame, at);
  const phone = sp(frame, phoneAt, "snap");
  const cw = W / 3;
  const chh = H / 3;
  return (
    <Center w={W} h={H} style={e.style}>
      {phone > 0 && (
        <div
          style={{
            position: "absolute",
            inset: -20,
            borderRadius: 48,
            background: "linear-gradient(160deg, #2C302E 0%, #121614 55%, #1E2321 100%)",
            boxShadow: `0 0 0 1.5px rgba(255,255,255,0.12), ${SHADOW}`,
            transform: `scale(${mix(1.15, 1, phone)})`,
            opacity: Math.min(1, phone * 1.5),
          }}
        />
      )}
      <div style={{ position: "absolute", inset: 0, borderRadius: mix(26, 30, phone), overflow: "hidden", boxShadow: phone > 0 ? undefined : SHADOW, perspective: 900 }}>
        {Array.from({ length: 9 }, (_, k) => {
          const r = Math.floor(k / 3);
          const c = k % 3;
          const f = p(frame, splitAt + (r + c) * 1.6, 9, easeInOut);
          const gap = 3 * Math.min(1, f * 4);
          return (
            <div key={k} style={{ position: "absolute", left: c * cw + gap / 2, top: r * chh + gap / 2, width: cw - gap, height: chh - gap, transformStyle: "preserve-3d", transform: `rotateY(${180 * f}deg)` }}>
              <div style={{ position: "absolute", inset: 0, overflow: "hidden", backfaceVisibility: "hidden" }}>
                <Still still={base} w={W} h={H} style={{ position: "absolute", left: -c * cw - gap / 2, top: -r * chh - gap / 2 }} />
              </div>
              <div style={{ position: "absolute", inset: 0, overflow: "hidden", backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                <Still still={NINE[k]} w={cw - gap} h={chh - gap} />
              </div>
            </div>
          );
        })}
      </div>
      {phone > 0 && <div style={{ position: "absolute", top: 8, left: "50%", width: 84, height: 22, marginLeft: -42, borderRadius: 11, background: "#000", opacity: phone }} />}
    </Center>
  );
};

// ——— Notițe care devin scenariu ———————————————————————————————————————

const NOTES = [
  { text: "Focul din cuptor", color: SHOP.saffron, ink: SHOP.bg },
  { text: "Prima felie", color: SHOP.tomato, ink: SHOP.ink },
  { text: "Latte art, lent", color: SHOP.paper, ink: SHOP.paperInk },
];

export const NotesToScript: React.FC<{ noteAt: number; scriptAt: number; pluralAt: number }> = ({ noteAt, scriptAt, pluralAt }) => {
  const frame = useCurrentFrame();
  const page = sp(frame, scriptAt - 2, "snap");
  const plural = sp(frame, pluralAt, "bouncy");
  const PW = 400;
  const PH = 500;
  const slots = [
    { x: -150, y: -110, r: -8 },
    { x: 140, y: -40, r: 6 },
    { x: -40, y: 130, r: -3 },
  ];
  return (
    <div style={{ position: "absolute" }}>
      {page > 0 &&
        [2, 1].map((k) => (
          <div
            key={k}
            style={{
              position: "absolute",
              left: -PW / 2,
              top: -PH / 2,
              width: PW,
              height: PH,
              borderRadius: 18,
              background: SHOP.paper,
              boxShadow: SHADOW,
              opacity: plural * page,
              transform: `translate(${k * 26 * plural}px, ${k * -18 * plural}px) rotate(${k * 5 * plural}deg)`,
              filter: `brightness(${1 - k * 0.12})`,
            }}
          />
        ))}
      {page > 0 && (
        <div
          style={{
            position: "absolute",
            left: -PW / 2,
            top: -PH / 2,
            width: PW,
            height: PH,
            borderRadius: 18,
            background: SHOP.paper,
            boxShadow: SHADOW,
            padding: "40px 38px",
            boxSizing: "border-box",
            transform: `translateY(${(1 - page) * 600}px) rotate(${(1 - page) * 8}deg)`,
            fontFamily: SATOSHI,
            color: SHOP.paperInk,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.18em", opacity: 0.55 }}>SCENARIU</div>
          <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 26 }}>
            {NOTES.map((n, i) => {
              const t = p(frame, scriptAt + 4 + i * 3, 8);
              return (
                <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 16, opacity: t, transform: `translateX(${(1 - t) * 30}px)` }}>
                  <span style={{ fontSize: 30, fontWeight: 700, color: SHOP.tomato }}>{i + 1}.</span>
                  <span style={{ fontSize: 34, fontWeight: 500 }}>{n.text}</span>
                </div>
              );
            })}
            {[0, 1, 2].map((i) => (
              <div key={`l${i}`} style={{ height: 14, borderRadius: 7, background: "rgba(29,42,34,0.12)", width: `${[86, 70, 78][i]}%`, opacity: p(frame, scriptAt + 14 + i * 2, 8) }} />
            ))}
          </div>
        </div>
      )}
      {NOTES.map((n, i) => {
        const e = entry(frame, noteAt + i * 2.5, 420, slots[i].r * 2);
        const into = p(frame, scriptAt + 1 + i * 3, 9, easeIn);
        if (into >= 1) return null;
        const tx = -PW / 2 + 60;
        const ty = -PH / 2 + 110 + i * 62;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: mix(slots[i].x, tx, into) - 105,
              top: mix(slots[i].y, ty, into) - 105,
              width: 210,
              height: 210,
              padding: 22,
              boxSizing: "border-box",
              background: n.color,
              color: n.ink,
              borderRadius: 6,
              boxShadow: "0 18px 40px rgba(0,0,0,0.4)",
              fontFamily: SATOSHI,
              fontWeight: 600,
              fontSize: 34,
              lineHeight: 1.08,
              opacity: e.style.opacity * (1 - into),
              transform: `${e.style.transform} rotate(${slots[i].r * (1 - into)}deg) scale(${mix(1, 0.35, into)})`,
            }}
          >
            {n.text}
          </div>
        );
      })}
    </div>
  );
};

// ——— Vizor de cameră care se mărește până umple ecranul ————————————————————

const timecode = (f: number) => {
  const s = Math.floor(f / 30);
  const fr = f % 30;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `00:00:${pad(s)}:${pad(fr)}`;
};

export const Viewfinder: React.FC<{
  at: number;
  takeAt: number;
  shots: { f: number; shot: ShotName }[];
  center: number;
}> = ({ at, takeAt, shots, center }) => {
  const frame = useCurrentFrame();
  const W = 300;
  const H = 533;
  const e = entry(frame, at);
  const take = p(frame, takeAt, 14, easeInOut);
  const S = mix(1, 3.62, take);
  const cur = shots.filter((s) => frame >= s.f).at(-1) ?? shots[0];
  const overlay = 1 - p(frame, takeAt + 22, 8);
  const rec = Math.floor(frame / 15) % 2 === 0;
  return (
    <Center w={W} h={H} style={{ ...e.style, transform: `${e.style.transform} translateY(${(960 - center) * take}px) scale(${S})` }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 26 / S, overflow: "hidden", boxShadow: take < 0.9 ? SHADOW : undefined }}>
        {shots.map((s, i) =>
          s === cur ? (
            <div key={i} style={{ position: "absolute", inset: 0 }}>
              <Footage shot={s.shot} at={s.f} w={W} h={H} />
            </div>
          ) : null,
        )}
      </div>
      {overlay > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: overlay }}>
          {[
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
          ].map(([cx, cy], k) => (
            <div
              key={k}
              style={{
                position: "absolute",
                left: cx ? undefined : 16 / S,
                right: cx ? 16 / S : undefined,
                top: cy ? undefined : 16 / S,
                bottom: cy ? 16 / S : undefined,
                width: 34 / S,
                height: 34 / S,
                borderLeft: cx ? undefined : `${3 / S}px solid rgba(255,255,255,0.92)`,
                borderRight: cx ? `${3 / S}px solid rgba(255,255,255,0.92)` : undefined,
                borderTop: cy ? undefined : `${3 / S}px solid rgba(255,255,255,0.92)`,
                borderBottom: cy ? `${3 / S}px solid rgba(255,255,255,0.92)` : undefined,
              }}
            />
          ))}
          <div style={{ position: "absolute", left: 24 / S, top: 22 / S, display: "flex", alignItems: "center", gap: 8 / S, fontFamily: MONO, fontSize: 17 / S, color: "#fff", letterSpacing: "0.04em" }}>
            <span style={{ width: 11 / S, height: 11 / S, borderRadius: "50%", background: rec ? "#FF3B30" : "rgba(255,59,48,0.25)" }} />
            REC
          </div>
          <div style={{ position: "absolute", right: 24 / S, top: 22 / S, fontFamily: MONO, fontSize: 17 / S, color: "#fff", letterSpacing: "0.04em" }}>{timecode(Math.max(0, frame - at))}</div>
        </div>
      )}
    </Center>
  );
};

// ——— Card de montaj: se taie în trei și se lipește la loc ————————————————————

export const EditCard: React.FC<{ at: number; cutAt: number; flipAt: number; shot: ShotName; post: ShotName }> = ({ at, cutAt, flipAt, shot, post }) => {
  const frame = useCurrentFrame();
  const W = 300;
  const H = 533;
  const e = entry(frame, at);
  const cut = p(frame, cutAt, 7, easeOut) * (1 - p(frame, cutAt + 9, 8, easeInOut));
  const flip = p(frame, flipAt, 14, easeInOut);
  const phone = flip;
  const slices = [0, 1, 2];
  return (
    <Center w={W} h={H} style={{ ...e.style, perspective: 1400 }}>
      <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `rotateY(${180 * flip}deg)` }}>
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}>
          {slices.map((k) => (
            <div
              key={k}
              style={{
                position: "absolute",
                left: (k * W) / 3,
                top: 0,
                width: W / 3,
                height: H,
                overflow: "hidden",
                borderRadius: k === 0 ? "26px 0 0 26px" : k === 2 ? "0 26px 26px 0" : 0,
                transform: `translate(${(k - 1) * 26 * cut}px, ${[-40, 30, -18][k] * cut}px)`,
                boxShadow: SHADOW,
              }}
            >
              <div style={{ position: "absolute", left: (-k * W) / 3, top: 0 }}>
                <Footage shot={shot} at={at} w={W} h={H} />
              </div>
            </div>
          ))}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: -46, height: 22, display: "flex", gap: 4 }}>
            {[0.3, 0.45, 0.25].map((wv, k) => (
              <div key={k} style={{ flex: wv, borderRadius: 5, background: [SHOP.saffron, SHOP.tomato, SHOP.ink][k], opacity: 0.9 * (1 - phone) }} />
            ))}
          </div>
        </div>
        <div style={{ position: "absolute", inset: -14, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <PhoneShell w={W + 28} h={H + 28}>
            <Footage shot={post} at={flipAt - 2} w={W} h={H} />
          </PhoneShell>
        </div>
      </div>
    </Center>
  );
};

export const PhoneShell: React.FC<{ w: number; h: number; children: React.ReactNode }> = ({ w, h, children }) => (
  <div style={{ width: w, height: h, borderRadius: 46, padding: 14, boxSizing: "border-box", background: "linear-gradient(160deg, #2C302E 0%, #121614 55%, #1E2321 100%)", boxShadow: `0 0 0 1.5px rgba(255,255,255,0.12), ${SHADOW}` }}>
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 34, overflow: "hidden", background: "#000" }}>
      {children}
      <div style={{ position: "absolute", top: 8, left: "50%", width: 84, height: 22, marginLeft: -42, borderRadius: 11, background: "#000" }} />
      <div style={{ position: "absolute", left: 14, right: 14, bottom: 16, fontFamily: SATOSHI, color: "#fff" }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>restaurantultau</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Sponsorizat</div>
      </div>
    </div>
  </div>
);

/** Trei telefoane în evantai: campaniile pe mai multe plasamente. */
export const PhoneFan: React.FC<{ at: number; shots: [ShotName, ShotName, ShotName] }> = ({ at, shots }) => {
  const frame = useCurrentFrame();
  const W = 250;
  const H = 444;
  return (
    <div style={{ position: "absolute" }}>
      {[0, 2, 1].map((i) => {
        const fan = sp(frame, at + (i === 1 ? 0 : 2), "bouncy");
        const x = (i - 1) * 220 * fan;
        const r = (i - 1) * 10 * fan;
        return (
          <div key={i} style={{ position: "absolute", left: x - (W + 28) / 2, top: -(H + 28) / 2 + Math.abs(i - 1) * 30 * fan, transform: `rotate(${r}deg) scale(${i === 1 ? 1 : mix(0.9, 0.88, fan)})`, zIndex: i === 1 ? 2 : 1 }}>
            <PhoneShell w={W + 28} h={H + 28}>
              <Footage shot={shots[i]} at={at} w={W} h={H} />
            </PhoneShell>
          </div>
        );
      })}
    </div>
  );
};

// ——— Notificări de rezervare care se adună, apoi se împrăștie ——————————————

const NOTIF = [
  ["Rezervare nouă", "Masă pentru 2, diseară"],
  ["Rezervare nouă", "Masă pentru 4, sâmbătă"],
  ["Mesaj nou", "Aveți loc pentru 6 vineri?"],
  ["Rezervare nouă", "Masă pentru 2, la prânz"],
  ["Rezervare nouă", "Masă pentru 3, duminică"],
  ["Rezervare nouă", "Masă pentru 5, diseară"],
  ["Mesaj nou", "Faceți și livrări?"],
  ["Rezervare nouă", "Masă pentru 2, mâine"],
];

export const NOTIF_H = 116;
export const NOTIF_GAP = 14;

export const Notifications: React.FC<{ at: number; every: number; count: number; scatterAt: number }> = ({ at, every, count, scatterAt }) => {
  const frame = useCurrentFrame();
  const W = 720;
  const total = count * (NOTIF_H + NOTIF_GAP) - NOTIF_GAP;
  return (
    <div style={{ position: "absolute" }}>
      {Array.from({ length: count }, (_, i) => {
        const a = at + i * every;
        const s = sp(frame, a, "bouncy");
        if (frame < a) return null;
        const shrink = 1 - Math.max(0, i - 4) * 0.06;
        const sc = (t: number) => p(t, scatterAt + (i % 3), 12, throwOut);
        const dx = (rnd(i * 4.3) - 0.5) * 2;
        const dy = (rnd(i * 8.1) - 0.5) * 2;
        const x = (t: number) => dx * 1300 * sc(t);
        const y = (t: number) => dy * 900 * sc(t);
        const sct = sc(frame);
        return (
          <MotionBlur
            key={i}
            id={`n${i}`}
            vx={vel(x, frame)}
            vy={vel(y, frame)}
            style={{
              position: "absolute",
              left: -W / 2,
              top: -total / 2 + i * (NOTIF_H + NOTIF_GAP),
              transform: `translate(${x(frame)}px, ${y(frame) + (1 - s) * 60}px) rotate(${(rnd(i * 2.9) - 0.5) * 70 * sct}deg) scale(${mix(0.86, shrink, s)})`,
              opacity: (frame >= a ? 1 : 0) * (1 - p(frame, scatterAt + 6, 8)),
            }}
          >
            <div
              style={{
                width: W,
                height: NOTIF_H,
                borderRadius: 30,
                background: "#24332E",
                boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
                display: "flex",
                alignItems: "center",
                gap: 22,
                padding: "0 28px",
                boxSizing: "border-box",
                fontFamily: SATOSHI,
              }}
            >
              <div style={{ width: 68, height: 68, borderRadius: 17, background: SHOP.tomato, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <ForkKnifeIcon size={38} color={SHOP.ink} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 31, fontWeight: 700, color: SHOP.ink }}>{NOTIF[i % NOTIF.length][0]}</div>
                <div style={{ fontSize: 27, fontWeight: 400, color: "#A9B8B0", marginTop: 2, whiteSpace: "nowrap" }}>{NOTIF[i % NOTIF.length][1]}</div>
              </div>
              <div style={{ fontSize: 24, color: "#A9B8B0", alignSelf: "flex-start", marginTop: 26 }}>acum</div>
            </div>
          </MotionBlur>
        );
      })}
    </div>
  );
};

/** Înălțimea stivei de notificări la un cadru dat (pentru rândul care o ține). */
export const notifHeight = (frame: number, at: number, every: number, count: number) => {
  let n = 0;
  for (let i = 0; i < count; i++) n += sp(frame, at + i * every, "snap");
  return Math.max(NOTIF_H, n * (NOTIF_H + NOTIF_GAP));
};

// ——— Calendar → raport → calendarul lunii următoare ——————————————————————

export const MonthCard: React.FC<{ at: number; reportAt: number; notesAt: number; nextAt: number }> = ({ at, reportAt, notesAt, nextAt }) => {
  const frame = useCurrentFrame();
  const W = 400;
  const H = 470;
  const e = entry(frame, at);
  const f1 = p(frame, reportAt, 12, easeInOut);
  const f2 = p(frame, nextAt, 12, easeInOut);
  const face = frame < reportAt + 6 ? "cal1" : frame < nextAt + 6 ? "report" : "cal2";
  const angle = face === "cal1" ? 90 * f1 : face === "report" ? (frame < nextAt ? -90 * (1 - f1) : 90 * f2) : -90 * (1 - f2);
  const notes = [0, 1, 2].map((i) => sp(frame, notesAt + i * 2.5, "bouncy"));
  const Cal: React.FC<{ label: string }> = ({ label }) => (
    <div style={{ width: W, height: H, borderRadius: 22, overflow: "hidden", background: SHOP.paper, boxShadow: SHADOW, fontFamily: SATOSHI }}>
      <div style={{ height: 120, background: SHOP.tomato, color: SHOP.ink, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 54, fontWeight: 700, letterSpacing: "0.12em" }}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, padding: "26px 26px" }}>
        {Array.from({ length: 35 }, (_, k) => (
          <div key={k} style={{ height: 40, borderRadius: 8, background: k < 31 ? "rgba(29,42,34,0.1)" : "transparent" }} />
        ))}
      </div>
    </div>
  );
  return (
    <Center w={W} h={H} style={{ ...e.style, perspective: 1300 }}>
      <div style={{ position: "absolute", inset: 0, transformOrigin: "50% 0%", transform: `rotateX(${-angle}deg)` }}>
        {face === "cal1" && <Cal label="LUNA 1" />}
        {face === "cal2" && <Cal label="LUNA 2" />}
        {face === "report" && (
          <div style={{ width: W, height: H, borderRadius: 22, background: SHOP.paper, boxShadow: SHADOW, padding: 34, boxSizing: "border-box", fontFamily: SATOSHI, color: SHOP.paperInk }}>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.16em", opacity: 0.55 }}>RAPORT LUNAR</div>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              {(["pizzaFinal", "latteArt", "carbonaraFly", "affogato"] as StillName[]).map((s, k) => (
                <Still key={k} still={s} w={74} h={132} radius={10} />
              ))}
            </div>
            <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 18 }}>
              {[0.82, 0.58, 0.7].map((v, k) => (
                <div key={k} style={{ height: 22, borderRadius: 11, background: "rgba(29,42,34,0.1)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${100 * v * p(frame, reportAt + 8 + k * 3, 16, easeOut)}%`, borderRadius: 11, background: [SHOP.tomato, SHOP.saffron, SHOP.paperInk][k] }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {notes.map((n, i) =>
        n > 0 ? (
          <div
            key={i}
            style={{
              position: "absolute",
              left: [W - 110, -50, W - 160][i],
              top: [150, H - 150, H - 70][i],
              width: 150,
              height: 150,
              padding: 16,
              boxSizing: "border-box",
              background: [SHOP.saffron, SHOP.tomato, SHOP.ink][i],
              color: i === 1 ? SHOP.ink : SHOP.bg,
              borderRadius: 6,
              boxShadow: "0 16px 34px rgba(0,0,0,0.35)",
              fontFamily: SATOSHI,
              fontWeight: 600,
              fontSize: 26,
              lineHeight: 1.08,
              transform: `translateY(${(1 - n) * 220}px) rotate(${[8, -7, 4][i] + (1 - n) * 20}deg) scale(${n})`,
            }}
          >
            {["Reel nou", "Meniu de toamnă", "Ofertă de prânz"][i]}
          </div>
        ) : null,
      )}
    </Center>
  );
};

// ——— Mâna-cursor ————————————————————————————————————————————————————

/** keys: unde e vârful degetului (x, y în cadrul segmentului) din cadrul f; taps: cadrele de apăsare. */
export const Hand: React.FC<{ keys: { f: number; x: number; y: number }[]; taps: number[]; size?: number }> = ({ keys, taps, size = 110 }) => {
  const frame = useCurrentFrame();
  if (frame < keys[0].f - 1 || frame > keys[keys.length - 1].f + 14) return null;
  const xs = keys.map((k) => ({ f: k.f, v: k.x }));
  const ys = keys.map((k) => ({ f: k.f, v: k.y }));
  const x = springKeys(frame, xs, "soft");
  const y = springKeys(frame, ys, "soft");
  const press = taps.reduce((m, t) => Math.max(m, p(frame, t - 2, 2) * (1 - p(frame, t + 1, 4))), 0);
  return (
    <div style={{ position: "absolute", left: x - HAND_TIP.x * size, top: y - HAND_TIP.y * size, filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.35))" }}>
      <HandCursor size={size} press={press} />
    </div>
  );
};

/** Inelul care pleacă din punctul apăsat. */
export const TapRing: React.FC<{ x: number; y: number; at: number; color?: string }> = ({ x, y, at, color = SHOP.ink }) => {
  const frame = useCurrentFrame();
  const t = p(frame, at, 16, easeOut);
  if (frame < at || t >= 1) return null;
  return <div style={{ position: "absolute", left: x - 60, top: y - 60, width: 120, height: 120, borderRadius: 60, border: `3px solid ${color}`, opacity: 1 - t, transform: `scale(${mix(0.3, 1.6, t)})` }} />;
};

// ——— Pastila cu numărul de telefon ———————————————————————————————————

export const NumberPill: React.FC<{ at: number; fillAt: number; number: string }> = ({ at, fillAt, number }) => {
  const frame = useCurrentFrame();
  const s = sp(frame, at, "bouncy");
  const fill = p(frame, fillAt, 6, easeOut);
  const fg = fill > 0.5 ? SHOP.bg : SHOP.ink;
  return (
    <div
      style={{
        position: "relative",
        height: 150,
        padding: "0 52px 0 28px",
        borderRadius: 75,
        border: `3px solid ${SHOP.ink}`,
        background: `rgba(240,233,214,${fill})`,
        display: "flex",
        alignItems: "center",
        gap: 26,
        transform: `scale(${mix(0.6, 1, s)})`,
        opacity: frame < at ? 0 : Math.min(1, (frame - at + 1) / 3),
        fontFamily: SATOSHI,
      }}
    >
      <div style={{ width: 96, height: 96, borderRadius: 48, background: SHOP.tomato, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <PhoneIcon size={50} color={SHOP.ink} />
      </div>
      <span style={{ fontSize: 82, fontWeight: 500, letterSpacing: "-0.01em", color: fg, fontVariantNumeric: "tabular-nums" }}>{number}</span>
    </div>
  );
};


