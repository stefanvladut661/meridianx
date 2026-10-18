import React from "react";
import { OffthreadVideo, staticFile } from "remotion";
import { DEMO } from "../data/script";
import { FONT } from "../theme";
import { BookmarkIcon, CommentIcon, HeartIcon, SendIcon } from "./icons";

// Telefoane generice, ca în faza „Publishing" din referință. Fără logo-uri de
// platformă și fără numere de like-uri sau vizualizări: nu sunt reale.

export const PHONE_W = 404;
export const PHONE_H = 830;

export const PhoneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      width: PHONE_W,
      height: PHONE_H,
      borderRadius: 60,
      padding: 10,
      background: "linear-gradient(160deg, #2A2C33 0%, #121317 45%, #1C1E23 100%)",
      boxShadow: "0 0 0 1.5px rgba(255,255,255,0.12), 0 50px 100px rgba(0,0,0,0.65), 0 0 60px rgba(46,110,255,0.18)",
    }}
  >
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 50, overflow: "hidden", background: "#000" }}>
      {children}
      <div style={{ position: "absolute", top: 14, left: "50%", width: 112, height: 32, marginLeft: -56, borderRadius: 16, background: "#000" }} />
    </div>
  </div>
);

const Clip: React.FC<{ src: string; from: number; fps: number; style?: React.CSSProperties }> = ({ src, from, fps, style }) => (
  <OffthreadVideo
    src={staticFile(src)}
    trimBefore={Math.round(from * fps)}
    muted
    style={{ width: "100%", height: "100%", objectFit: "cover", ...style }}
  />
);

const Avatar: React.FC<{ size: number }> = ({ size }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: "#2F4A3A",
      color: "#F4EEE4",
      fontSize: size * 0.38,
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "none",
    }}
  >
    RT
  </div>
);

export const MetaFeedScreen: React.FC<{ src: string; from: number; fps: number }> = ({ src, from, fps }) => (
  <div style={{ position: "absolute", inset: 0, background: "#fff", color: "#111", fontFamily: FONT }}>
    <div style={{ height: 56, display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 30px 6px", fontSize: 17, fontWeight: 600 }}>
      <span>9:41</span>
      <span style={{ letterSpacing: 2 }}>●●●</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
      <Avatar size={40} />
      <div style={{ lineHeight: 1.2 }}>
        <div style={{ fontSize: 17, fontWeight: 600 }}>{DEMO.name}</div>
        <div style={{ fontSize: 14, color: "#737373" }}>Sponsorizat</div>
      </div>
    </div>
    <div style={{ width: "100%", height: 480, overflow: "hidden", background: "#ddd" }}>
      <Clip src={src} from={from} fps={fps} />
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#F2F3F5", fontSize: 16, fontWeight: 600 }}>
      <span>Rezervă o masă</span>
      <span style={{ fontSize: 20 }}>›</span>
    </div>
    <div style={{ display: "flex", gap: 16, padding: "12px 16px 6px" }}>
      <HeartIcon color="#111" size={26} />
      <CommentIcon color="#111" size={26} />
      <SendIcon color="#111" size={26} />
      <span style={{ marginLeft: "auto" }}>
        <BookmarkIcon color="#111" size={26} />
      </span>
    </div>
    <div style={{ padding: "4px 16px", fontSize: 15, lineHeight: 1.35 }}>
      <b>{DEMO.name}</b> Masa ta e pregătită. Rezervă pentru weekend.
    </div>
  </div>
);

export const TikTokScreen: React.FC<{ src: string; from: number; fps: number }> = ({ src, from, fps }) => (
  <div style={{ position: "absolute", inset: 0, background: "#000", color: "#fff", fontFamily: FONT }}>
    <Clip src={src} from={from} fps={fps} />
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.6) 100%)" }} />
    <div style={{ position: "absolute", top: 62, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 22, fontSize: 18, fontWeight: 600 }}>
      <span style={{ opacity: 0.6 }}>Urmărite</span>
      <span style={{ borderBottom: "2px solid #fff", paddingBottom: 4 }}>Pentru tine</span>
    </div>
    <div style={{ position: "absolute", right: 14, bottom: 190, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
      <Avatar size={46} />
      <HeartIcon filled size={34} />
      <CommentIcon size={34} />
      <BookmarkIcon size={32} />
      <SendIcon size={32} />
    </div>
    <div style={{ position: "absolute", left: 16, right: 80, bottom: 84, lineHeight: 1.35 }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>@restaurantultau</div>
      <div style={{ fontSize: 15, opacity: 0.9 }}>Gust de acasă, în fiecare zi.</div>
      <div style={{ marginTop: 6, display: "inline-block", fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.22)" }}>Sponsorizat</div>
    </div>
    <div style={{ position: "absolute", left: 14, right: 14, bottom: 22, height: 48, borderRadius: 8, background: "#fff", color: "#111", fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
      Rezervă acum
    </div>
  </div>
);
