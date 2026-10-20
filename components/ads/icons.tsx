import type { SVGProps } from "react";

/**
 * Iconițele portalului: linie de 1,75 px, 20×20, în culoarea textului.
 * Decorative implicit (eticheta e mereu scrisă lângă ele).
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 18, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconCampaigns = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1Z" />
    <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
  </Base>
);

export const IconPlans = (props: IconProps) => (
  <Base {...props}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h3" />
  </Base>
);

export const IconStats = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />
  </Base>
);

export const IconSearch = (props: IconProps) => (
  <Base {...props}>
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-4.5-4.5" />
  </Base>
);

export const IconMaterials = (props: IconProps) => (
  <Base {...props}>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <path d="m10 9.5 4.5 2.5-4.5 2.5Z" />
  </Base>
);

export const IconCalls = (props: IconProps) => (
  <Base {...props}>
    <path d="M6.5 4h2.6l1.4 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4Z" />
  </Base>
);

export const IconHistory = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" />
    <path d="M4 4v4.5h4.5M12 8v4l3 2" />
  </Base>
);

export const IconClients = (props: IconProps) => (
  <Base {...props}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M3 19.5a6 6 0 0 1 12 0M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.2a6 6 0 0 1 3.5 5.3" />
  </Base>
);

export const IconLeads = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 13.5 6.5 5h11l2.5 8.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
    <path d="M4 13.5h4.5l1 2h5l1-2H20" />
  </Base>
);

export const IconLogout = (props: IconProps) => (
  <Base {...props}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />
  </Base>
);

export const IconPlus = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconRefresh = (props: IconProps) => (
  <Base {...props}>
    <path d="M19.5 12a7.5 7.5 0 0 1-13.2 4.9M4.5 12a7.5 7.5 0 0 1 13.2-4.9" />
    <path d="M18 3.5v4h-4M6 20.5v-4h4" />
  </Base>
);

export const IconClose = (props: IconProps) => (
  <Base {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Base>
);

export const IconExternal = (props: IconProps) => (
  <Base {...props}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Base>
);

export const IconPause = (props: IconProps) => (
  <Base {...props}>
    <rect x="6.5" y="5" width="3.5" height="14" rx="1" />
    <rect x="14" y="5" width="3.5" height="14" rx="1" />
  </Base>
);

export const IconMore = (props: IconProps) => (
  <Base {...props}>
    <circle cx="5.5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="18.5" cy="12" r="1" />
  </Base>
);

export const IconChevron = (props: IconProps) => (
  <Base {...props}>
    <path d="m8 10 4 4 4-4" />
  </Base>
);

export const IconSort = ({ sorted, ...props }: IconProps & { sorted: "asc" | "desc" | null }) => (
  <Base {...props}>
    <path d="m8 9 4-4 4 4" opacity={sorted === "asc" ? 1 : 0.35} />
    <path d="m8 15 4 4 4-4" opacity={sorted === "desc" ? 1 : 0.35} />
  </Base>
);
