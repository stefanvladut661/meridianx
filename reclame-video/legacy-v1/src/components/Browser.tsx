import React from "react";
import { Img, staticFile } from "remotion";
import { DEMO } from "../data/script";
import { SITE_IMAGES } from "../data/footage";
import { FONT, SERIF } from "../theme";

// Site-ul fictiv „Restaurantul tău", desenat în cod. Dreptunghiurile de mai
// jos sunt folosite și de animația de scanare (chenarele albastre) și de
// cardurile care „ies" din site.

export const SITE = {
  w: 860,
  chrome: 46,
  h: 520,
  logo: { x: 30, y: 20, w: 262, h: 30 },
  nav: { x: 470, y: 22, w: 360, h: 26 },
  headline: { x: 26, y: 90, w: 410, h: 132 },
  para: { x: 30, y: 234, w: 380, h: 58 },
  button: { x: 30, y: 308, w: 206, h: 54 },
  photo: { x: 458, y: 80, w: 372, h: 304 },
  thumbs: { x: 26, y: 400, w: 448, h: 100 },
} as const;

export type Rect = { x: number; y: number; w: number; h: number };

const PALETTE = { cream: "#F4EEE4", ink: "#1E1C19", green: "#2F4A3A", warm: "#B9853F" };
export const SITE_PALETTE = [PALETTE.cream, PALETTE.green, PALETTE.ink, PALETTE.warm];

export const BrowserWindow: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      width: SITE.w,
      height: SITE.chrome + SITE.h,
      borderRadius: 18,
      overflow: "hidden",
      background: "#0E0F13",
      border: "1px solid rgba(255,255,255,0.12)",
      boxShadow: "0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.4)",
      position: "relative",
    }}
  >
    <div style={{ height: SITE.chrome, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", background: "#16181D", fontFamily: FONT }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: "#3A3D45" }} />
      ))}
      <div style={{ marginLeft: 14, height: 28, padding: "0 16px", borderRadius: 8, background: "#23262D", color: "#A4A9B5", fontSize: 17, display: "flex", alignItems: "center" }}>
        {DEMO.domain}
      </div>
    </div>
    <div style={{ position: "relative", width: SITE.w, height: SITE.h }}>{children}</div>
  </div>
);

const abs = (r: Rect): React.CSSProperties => ({ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h });

export const RestaurantSite: React.FC = () => (
  <div style={{ position: "absolute", inset: 0, background: PALETTE.cream, color: PALETTE.ink, fontFamily: FONT }}>
    <div style={{ ...abs(SITE.logo), fontFamily: SERIF, fontSize: 22, fontWeight: 600, letterSpacing: "0.16em", display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
      RESTAURANTUL TĂU
    </div>
    <div style={{ ...abs(SITE.nav), display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 17, color: "#4A4640" }}>
      {["Meniu", "Rezervări", "Despre", "Contact"].map((t) => (
        <span key={t}>{t}</span>
      ))}
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, top: 66, height: 1, background: "rgba(30,28,25,0.1)" }} />
    <div style={{ ...abs(SITE.headline), fontFamily: SERIF, fontSize: 50, lineHeight: 1.06, fontWeight: 500, padding: "4px 4px" }}>
      Gust de acasă,
      <br />
      în fiecare zi.
    </div>
    <div style={{ ...abs(SITE.para), fontSize: 18, lineHeight: 1.45, color: "#6A645B" }}>
      Rețete de familie și ingrediente proaspete, la o masă mereu pregătită pentru tine.
    </div>
    <div
      style={{
        ...abs(SITE.button),
        borderRadius: 27,
        background: PALETTE.green,
        color: "#F4EEE4",
        fontSize: 19,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      Rezervă o masă
    </div>
    <div style={{ ...abs(SITE.photo), borderRadius: 12, overflow: "hidden", background: "#d9d2c6" }}>
      <Img src={staticFile(SITE_IMAGES.hero)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 60%" }} />
    </div>
    <div style={{ ...abs(SITE.thumbs), display: "flex", gap: 12, padding: 4 }}>
      {SITE_IMAGES.thumbs.map((src) => (
        <div key={src} style={{ width: 100, height: 92, borderRadius: 10, overflow: "hidden", background: "#d9d2c6" }}>
          <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ))}
    </div>
  </div>
);
