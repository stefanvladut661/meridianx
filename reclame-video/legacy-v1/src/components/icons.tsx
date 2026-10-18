import React from "react";

type IconProps = { size?: number; color?: string; stroke?: number; style?: React.CSSProperties };

export const CheckIcon: React.FC<IconProps & { progress?: number }> = ({
  size = 24,
  color = "#9DB8FF",
  stroke = 2.6,
  progress = 1,
  style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <path
      d="M5 12.5l4.3 4.3L19 7.2"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - progress}
    />
  </svg>
);

export const Spinner: React.FC<IconProps & { frame: number }> = ({ size = 28, color = "#B4C8FF", stroke = 2.4, frame }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ transform: `rotate(${frame * 14}deg)` }}>
    <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.14)" strokeWidth={stroke} />
    <path d="M12 3a9 9 0 0 1 9 9" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
  </svg>
);

export const LinkIcon: React.FC<IconProps> = ({ size = 28, color = "#8D93A3", stroke = 2.2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round">
    <path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1 1" />
    <path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1-1" />
  </svg>
);

export const ArrowUpRight: React.FC<IconProps> = ({ size = 24, color = "#0B0D12", stroke = 2.4 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
);

export const ArrowRight: React.FC<IconProps> = ({ size = 24, color = "#fff", stroke = 2.4 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const PhoneIcon: React.FC<IconProps> = ({ size = 28, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
  </svg>
);

export const DocIcon: React.FC<IconProps> = ({ size = 24, color = "#C9CEDA", stroke = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round">
    <path d="M7 3h7l5 5v13H7z" />
    <path d="M14 3v5h5M10 13h6M10 17h6" strokeLinecap="round" />
  </svg>
);

export const HeartIcon: React.FC<IconProps & { filled?: boolean }> = ({ size = 28, color = "#fff", filled, stroke = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth={stroke} strokeLinejoin="round">
    <path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.6 4 4.5 7.3 4.5c2 0 3.4 1.1 4.7 2.8 1.3-1.7 2.7-2.8 4.7-2.8 3.3 0 5.7 3.1 4.5 6.7-1.7 4.7-9.2 9.3-9.2 9.3z" />
  </svg>
);

export const CommentIcon: React.FC<IconProps> = ({ size = 28, color = "#fff", stroke = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round">
    <path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5z" />
  </svg>
);

export const SendIcon: React.FC<IconProps> = ({ size = 28, color = "#fff", stroke = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round">
    <path d="M21 3L3 10.5l7 2.5 2.5 7z" />
    <path d="M21 3L10 13" />
  </svg>
);

export const BookmarkIcon: React.FC<IconProps> = ({ size = 28, color = "#fff", stroke = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round">
    <path d="M6 3h12v18l-6-4.5L6 21z" />
  </svg>
);

/** Marca MERIDIAN, aceeași geometrie ca în components/site/mark.tsx de pe site. */
export const MeridianMark: React.FC<{ size?: number; color?: string }> = ({ size = 48, color = "#fff" }) => {
  const r = 38;
  const c = 2 * Math.PI * r;
  const gap = 12;
  const dash = c / 2 - gap;
  const offset = dash + gap / 2 - c / 4;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="none">
      <circle cx="50" cy="50" r={r} stroke={color} strokeWidth="7.5" strokeDasharray={`${dash} ${gap}`} strokeDashoffset={offset} />
      <path d="M67 27 L33.5 50 L67 73" stroke={color} strokeWidth="8.5" strokeLinejoin="miter" strokeLinecap="butt" />
    </svg>
  );
};
