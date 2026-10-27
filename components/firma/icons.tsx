import type { ReactNode, SVGProps } from "react";

/** Iconițele modulului: linie de 1,6 px, 18 px, culoarea textului. Decorative (aria-hidden). */
function Icon({ children, size = 18, ...rest }: SVGProps<SVGSVGElement> & { children: ReactNode; size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {children}
    </svg>
  );
}

export const IconPanel = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="7" height="8" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
    <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
    <rect x="3.5" y="14.5" width="7" height="6" rx="1.5" />
  </Icon>
);
export const IconClients = (p: { size?: number }) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
    <path d="M15.5 5.2a3 3 0 0 1 0 5.6M17.5 14.8c1.6.6 2.7 2.2 3 4.7" />
  </Icon>
);
export const IconInvoice = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M6 3.5h8.5L19 8v12.5H6z" />
    <path d="M14 3.5V8h5M9 12h6M9 15.5h6M9 8.5h2.5" />
  </Icon>
);
export const IconExpense = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z" />
    <path d="M9 8.5h6M9 12h6M9 15.5h3.5" />
  </Icon>
);
export const IconBank = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M3.5 9.5 12 4.5l8.5 5" />
    <path d="M5.5 10v7.5M9.5 10v7.5M14.5 10v7.5M18.5 10v7.5M3.5 20h17" />
  </Icon>
);
export const IconPackage = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="3.5" y="4" width="17" height="4.5" rx="1" />
    <path d="M5 8.5v11h14v-11M10 12h4" />
  </Icon>
);
export const IconKey = (p: { size?: number }) => (
  <Icon {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2" />
  </Icon>
);
export const IconHistory = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.5" />
    <path d="M4 4v4.5h4.5M12 8v4.5l3 2" />
  </Icon>
);
export const IconSettings = (p: { size?: number }) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" />
  </Icon>
);
export const IconAds = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M4 10v4h3l6 4V6L7 10z" />
    <path d="M16.5 9a4 4 0 0 1 0 6M7 14l1 5h2.5" />
  </Icon>
);
export const IconLeads = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M3.5 13.5 6 5.5h12l2.5 8v5h-17z" />
    <path d="M3.5 13.5h5l1 2h5l1-2h5" />
  </Icon>
);
export const IconLogout = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M14 4.5H6.5v15H14M10.5 12h10M17 8.5l3.5 3.5-3.5 3.5" />
  </Icon>
);
export const IconMore = (p: { size?: number }) => (
  <Icon {...p}>
    <circle cx="6" cy="12" r="1.2" />
    <circle cx="12" cy="12" r="1.2" />
    <circle cx="18" cy="12" r="1.2" />
  </Icon>
);
export const IconClose = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);
export const IconPlus = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const IconExternal = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M13.5 4.5h6v6M19.5 4.5 11 13M17 13.5v6h-12.5v-12.5h6" />
  </Icon>
);
export const IconUpload = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9M4.5 15v4.5h15V15" />
  </Icon>
);
export const IconChevronLeft = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="m14.5 6-6 6 6 6" />
  </Icon>
);
export const IconChevronRight = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="m9.5 6 6 6-6 6" />
  </Icon>
);
