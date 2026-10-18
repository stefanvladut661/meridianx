import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { BrowserWindow, RestaurantSite, SITE, SITE_PALETTE } from "../components/Browser";
import { Chip } from "../components/Glass";
import { DEMO } from "../data/script";
import { SITE_IMAGES } from "../data/footage";
import { easeInOut, mix, p } from "../lib/anim";
import type { Layout, Rect } from "../lib/layout";

// „Ne ocupăm de tot ce ține de imaginea online." — animația de citire din
// video-ul de referință, pe site-ul unui restaurant: site-ul apare, e scanat,
// elementele găsite primesc chenare albastre, iar ce am aflat iese din site în
// carduri de date. Cardurile nu conțin cifre: doar ce se vede pe site.

type ChipDef = { label: string; from: Rect; to: { x: number; y: number }; w: number; at: number; body: React.ReactNode };

export const ReadScene: React.FC<{ L: Layout; start: number; end: number }> = ({ L, start, end }) => {
  const frame = useCurrentFrame();
  const T = L.content;
  const bx = 110;
  const by = T + 160;
  const siteY = by + SITE.chrome;

  // Ca în referință: întâi bara devine pastila de sus, abia apoi apare site-ul.
  const enter = p(frame, start + 8, 16);
  const exit = p(frame, end - 6, 14, easeInOut);
  const beam = p(frame, start + 16, 36, easeInOut);

  const boxes: { r: Rect; at: number }[] = [
    { r: SITE.logo, at: start + 18 },
    { r: SITE.headline, at: start + 23 },
    { r: SITE.button, at: start + 28 },
    { r: SITE.photo, at: start + 32 },
    { r: SITE.thumbs, at: start + 36 },
  ];

  const chips: ChipDef[] = [
    {
      label: "Brand",
      from: SITE.logo,
      to: { x: 30, y: T + 88 },
      w: 452,
      at: start + 24,
      body: `${DEMO.name} · bistro`,
    },
    {
      label: "Paletă",
      from: { x: 520, y: 4, w: 300, h: 60 },
      to: { x: 640, y: T + 120 },
      w: 410,
      at: start + 30,
      body: (
        <span style={{ display: "flex", gap: 10, alignItems: "center", height: 37 }}>
          {SITE_PALETTE.map((c) => (
            <span key={c} style={{ width: 34, height: 34, borderRadius: 8, background: c, border: "1px solid rgba(255,255,255,0.25)" }} />
          ))}
        </span>
      ),
    },
    {
      label: "Fotografii",
      from: SITE.thumbs,
      to: { x: 30, y: T + 706 },
      w: 470,
      at: start + 36,
      body: (
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {SITE_IMAGES.thumbs.map((src) => (
            <Img key={src} src={staticFile(src)} style={{ width: 34, height: 34, borderRadius: 7, objectFit: "cover" }} />
          ))}
          <span style={{ marginLeft: 8 }}>de refăcut</span>
        </span>
      ),
    },
    {
      label: "Canale",
      from: SITE.nav,
      to: { x: 520, y: T + 652 },
      w: 530,
      at: start + 42,
      body: "Instagram · TikTok · Google",
    },
  ];

  const sceneStyle: React.CSSProperties = {
    opacity: 1 - exit,
    transform: `scale(${1 - 0.1 * exit}) translateY(${-40 * exit}px)`,
    filter: exit > 0 ? `blur(${exit * 14}px)` : undefined,
  };

  return (
    <AbsoluteFill style={sceneStyle}>
      <div
        style={{
          position: "absolute",
          left: bx,
          top: by,
          opacity: enter,
          transform: `translateY(${mix(50, 0, enter)}px) scale(${mix(0.93, 1, enter)})`,
          filter: enter < 1 ? `blur(${(1 - enter) * 16}px)` : undefined,
        }}
      >
        <BrowserWindow>
          <RestaurantSite />
          {boxes.map(({ r, at }, i) => {
            const t = p(frame, at, 8);
            return t > 0 ? (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: r.x - 6,
                  top: r.y - 6,
                  width: r.w + 12,
                  height: r.h + 12,
                  borderRadius: 10,
                  border: "2.5px solid rgba(70,120,255,0.85)",
                  background: "rgba(70,120,255,0.08)",
                  opacity: t,
                  transform: `scale(${mix(1.06, 1, t)})`,
                }}
              />
            ) : null;
          })}
          {beam > 0 && beam < 1 && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: beam * SITE.h - 60,
                height: 60,
                background: "linear-gradient(180deg, rgba(60,125,255,0) 0%, rgba(60,125,255,0.22) 85%, rgba(140,180,255,0.9) 100%)",
                boxShadow: "0 10px 30px rgba(60,125,255,0.6)",
              }}
            />
          )}
        </BrowserWindow>
      </div>

      {chips.map((c, i) => {
        const t = p(frame, c.at, 15);
        if (t <= 0) return null;
        const sx = bx + c.from.x + c.from.w / 2 - c.w / 2;
        const sy = siteY + c.from.y + c.from.h / 2 - 51;
        // Dâra: copii ale cardului în pozițiile din urmă, tot mai transparente.
        const ghosts = [3, 2, 1].map((k) => p(frame - k * 2, c.at, 15));
        return (
          <React.Fragment key={i}>
            {ghosts.map((g, k) =>
              g > 0 && g < 0.98 ? (
                <div
                  key={k}
                  style={{
                    position: "absolute",
                    left: mix(sx, c.to.x, g),
                    top: mix(sy, c.to.y, g),
                    opacity: 0.16 * (k + 1) * (1 - t * 0.9),
                    transform: `scale(${mix(0.55, 1, g)})`,
                    filter: "blur(6px)",
                  }}
                >
                  <Chip label={c.label} check={0} width={c.w}>
                    {c.body}
                  </Chip>
                </div>
              ) : null,
            )}
            <div
              style={{
                position: "absolute",
                left: mix(sx, c.to.x, t),
                top: mix(sy, c.to.y, t),
                transform: `scale(${mix(0.55, 1, t)})`,
                opacity: Math.min(1, t * 3),
                filter: t < 0.85 ? `blur(${(1 - t) * 8}px)` : undefined,
              }}
            >
              <Chip label={c.label} check={p(frame, c.at + 12, 8)} width={c.w}>
                {c.body}
              </Chip>
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
