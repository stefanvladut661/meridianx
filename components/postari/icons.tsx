import type { ReactNode, SVGProps } from "react";

/** Iconițele modulului: linie de 1,6 px, 18 px, culoarea textului. Decorative (aria-hidden). */
function Icon({ children, size = 18, ...rest }: SVGProps<SVGSVGElement> & { children: ReactNode; size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {children}
    </svg>
  );
}

type P = { size?: number };

export const IconQueue = (p: P) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="15.5" rx="2" />
    <path d="M3.5 9h17M8 3v3M16 3v3M7.5 13h3M7.5 16.5h6" />
  </Icon>
);
export const IconPlan = (p: P) => (
  <Icon {...p}>
    <path d="M6 3.5h8.5L19 8v12.5H6z" />
    <path d="M14 3.5V8h5M9 12.5l1.8 1.8L15 10.5M9 17h6" />
  </Icon>
);
export const IconFilm = (p: P) => (
  <Icon {...p}>
    <rect x="6" y="3.5" width="12" height="17" rx="2" />
    <path d="M6 7.5h12M6 16.5h12M10.5 10.5l3 1.5-3 1.5z" />
  </Icon>
);
export const IconPhone = (p: P) => (
  <Icon {...p}>
    <rect x="7" y="3" width="10" height="18" rx="2.2" />
    <path d="M10.5 6h3M11 17.5h2" />
    <path d="M12 9.5v4.5a1.6 1.6 0 1 1-1.6-1.6M12 9.5c.4 1 1.2 1.6 2.2 1.7" />
  </Icon>
);
export const IconHistory = (p: P) => (
  <Icon {...p}>
    <path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.5" />
    <path d="M4 4v4.5h4.5M12 8v4.5l3 2" />
  </Icon>
);
export const IconSettings = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" />
  </Icon>
);
export const IconAds = (p: P) => (
  <Icon {...p}>
    <path d="M4 10v4h3l6 4V6L7 10z" />
    <path d="M16.5 9a4 4 0 0 1 0 6M7 14l1 5h2.5" />
  </Icon>
);
export const IconFirma = (p: P) => (
  <Icon {...p}>
    <path d="M3.5 9.5 12 4.5l8.5 5" />
    <path d="M5.5 10v7.5M9.5 10v7.5M14.5 10v7.5M18.5 10v7.5M3.5 20h17" />
  </Icon>
);
export const IconLeads = (p: P) => (
  <Icon {...p}>
    <path d="M3.5 13.5 6 5.5h12l2.5 8v5h-17z" />
    <path d="M3.5 13.5h5l1 2h5l1-2h5" />
  </Icon>
);
export const IconLogout = (p: P) => (
  <Icon {...p}>
    <path d="M14 4.5H6.5v15H14M10.5 12h10M17 8.5l3.5 3.5-3.5 3.5" />
  </Icon>
);
export const IconMore = (p: P) => (
  <Icon {...p}>
    <circle cx="6" cy="12" r="1.2" />
    <circle cx="12" cy="12" r="1.2" />
    <circle cx="18" cy="12" r="1.2" />
  </Icon>
);
export const IconClose = (p: P) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);
export const IconExternal = (p: P) => (
  <Icon {...p}>
    <path d="M13.5 4.5h6v6M19.5 4.5 11 13M17 13.5v6h-12.5v-12.5h6" />
  </Icon>
);
export const IconFolder = (p: P) => (
  <Icon {...p}>
    <path d="M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" />
  </Icon>
);
export const IconCopy = (p: P) => (
  <Icon {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M15.5 8.5v-2A1.5 1.5 0 0 0 14 5H6a1.5 1.5 0 0 0-1.5 1.5V14A1.5 1.5 0 0 0 6 15.5h2.5" />
  </Icon>
);
export const IconCheck = (p: P) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);
export const IconPlay = (p: P) => (
  <Icon {...p}>
    <path d="M8 5.5v13l10.5-6.5z" />
  </Icon>
);
export const IconPause = (p: P) => (
  <Icon {...p}>
    <path d="M8.5 5.5v13M15.5 5.5v13" />
  </Icon>
);
export const IconRefresh = (p: P) => (
  <Icon {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3L19.5 9" />
    <path d="M19.5 4.5V9H15" />
  </Icon>
);
export const IconUpload = (p: P) => (
  <Icon {...p}>
    <path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9M4.5 15v4.5h15V15" />
  </Icon>
);
export const IconChevronLeft = (p: P) => (
  <Icon {...p}>
    <path d="m14.5 6-6 6 6 6" />
  </Icon>
);
export const IconChevronRight = (p: P) => (
  <Icon {...p}>
    <path d="m9.5 6 6 6-6 6" />
  </Icon>
);
export const IconSpark = (p: P) => (
  <Icon {...p}>
    <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.9L12 18.5l-1.8-5.8L4.5 10.8 10.2 9z" />
  </Icon>
);
