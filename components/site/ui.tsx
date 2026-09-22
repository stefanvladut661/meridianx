"use client";

import { useId, useState, type ReactNode } from "react";
import { Reveal } from "./motion";
import { TESTIMONIALS } from "./video-content";
import { ClientMark } from "@/components/site/client-marks";

/* ============================================================
   Piese de interfață partajate de cele două lumi și de poartă.
   ============================================================ */

/* ---------- Iconuri: linie de 1.5, colț la 90°, fără librărie ---------- */
type IconName =
  | "play"
  | "arrow"
  | "arrowRight"
  | "plus"
  | "check"
  | "target"
  | "chart"
  | "camera"
  | "megaphone"
  | "spark"
  | "phone"
  | "whatsapp"
  | "calendar"
  | "layers"
  | "search"
  | "cloud"
  | "link"
  | "clock"
  | "shield"
  | "users"
  | "sparkles"
  | "pause"
  | "sound"
  | "muted"
  | "expand";

const PATHS: Record<IconName, ReactNode> = {
  play: <path d="M8 5.5v13l11-6.5L8 5.5Z" />,
  arrow: <path d="M7 17 17 7M9 7h8v8" />,
  arrowRight: <path d="M4 12h15m-6-6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  chart: <path d="M4 19h16M7 19v-6M12 19V6M17 19v-9" />,
  camera: (
    <>
      <rect x="2.5" y="6.5" width="13" height="11" rx="2.5" />
      <path d="m15.5 11 6-3.2v8.4l-6-3.2Z" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10v4a2 2 0 0 0 2 2h1l2.5 4 2-1-2-3h1l7 4V5l-7 4H6a2 2 0 0 0-2 2Z" />
    </>
  ),
  spark: <path d="M12 3v6m0 6v6M3 12h6m6 0h6M6.4 6.4l3.2 3.2m4.8 4.8 3.2 3.2m0-11.2-3.2 3.2m-4.8 4.8-3.2 3.2" />,
  phone: (
    <path d="M6 3h3l2 5-2.2 1.4a12 12 0 0 0 5.8 5.8L16 13l5 2v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 6.2 2 2 0 0 1 6 3Z" />
  ),
  whatsapp: (
    <>
      <path d="M3.5 20.5 5 16.4A8 8 0 1 1 8 19.3l-4.5 1.2Z" />
      <path d="M9 9.2c.3 2.2 2.4 4.4 4.8 4.9.5.1 1-.2 1.2-.7l.2-.6-2-1-.7.8a5.4 5.4 0 0 1-2-2l.9-.6-.9-2h-.7c-.5.2-.9.6-.8 1.2Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  layers: <path d="m12 3 8.5 4.5L12 12 3.5 7.5 12 3Zm8.5 9L12 16.5 3.5 12m17 4.5L12 21l-8.5-4.5" />,
  cloud: (
    <path d="M7 18h10.5a3.5 3.5 0 0 0 .4-6.98A5.5 5.5 0 0 0 7.2 9.6 4.2 4.2 0 0 0 7 18Z" />
  ),
  link: (
    <>
      <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1.2 1.2" />
      <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1.2-1.2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.4 2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 5.8v5.4c0 4.2 2.9 7.6 7 9.3 4.1-1.7 7-5.1 7-9.3V5.8L12 3Z" />
      <path d="m9 12 2.2 2.2L15.4 10" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.4a3.2 3.2 0 0 1 0 5.2M17.5 14.2A5.5 5.5 0 0 1 20.5 19" />
    </>
  ),
  sparkles: (
    <path d="M11 4 12.4 8 16.4 9.4 12.4 10.8 11 14.8 9.6 10.8 5.6 9.4 9.6 8 11 4ZM18 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  /* Controalele playerului. `pause` e plin, ca `play` — perechea trebuie
     să aibă aceeași greutate optică, altfel butonul pare că își schimbă
     importanța când îl apeși. */
  pause: <path d="M8 5h3.1v14H8V5Zm4.9 0H16v14h-3.1V5Z" />,
  sound: (
    <>
      <path d="M4 9.3h3.4L12 5.4v13.2l-4.6-3.9H4V9.3Z" />
      <path d="M15.4 9.4a3.8 3.8 0 0 1 0 5.2M18 6.9a7.4 7.4 0 0 1 0 10.2" />
    </>
  ),
  muted: (
    <>
      <path d="M4 9.3h3.4L12 5.4v13.2l-4.6-3.9H4V9.3Z" />
      <path d="m16 10 4 4m0-4-4 4" />
    </>
  ),
  expand: (
    <>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </>
  ),
};

/** Iconurile pline: restul setului e desenat în contur de 1.5. */
const FILLED = new Set<IconName>(["play", "pause"]);

export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={FILLED.has(name) ? "currentColor" : "none"}
      stroke={FILLED.has(name) ? "none" : "currentColor"}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

/* ---------- Placă media ----------
   Nu există încă filmări reale. Placa desenează un „poster" abstract
   marcat vizibil ca placeholder, cu ergonomia unui player real
   (buton de redare, durată, bandă de timecode). */
export function MediaFrame({
  label,
  meta,
  duration = "0:42",
  tone = 0,
  className = "",
  ratio = "16 / 9",
  isPlaceholder = true,
}: {
  label: string;
  meta?: string;
  duration?: string;
  tone?: number;
  className?: string;
  ratio?: string;
  isPlaceholder?: boolean;
}) {
  const id = useId();
  const hues = [
    ["var(--md-a1)", "var(--md-a2)"],
    ["var(--md-a2)", "var(--md-a1)"],
    ["var(--md-a3)", "var(--md-a1)"],
    ["var(--md-a1)", "var(--md-a3)"],
  ];
  const [c1, c2] = hues[tone % hues.length];

  return (
    <figure
      className={`sweep group relative overflow-hidden rounded-panel-lg border border-hair bg-char ${className}`}
      style={{ aspectRatio: ratio }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 100% at 20% 110%, color-mix(in oklab, ${c1} 70%, transparent), transparent 62%), radial-gradient(90% 80% at 85% 0%, color-mix(in oklab, ${c2} 45%, transparent), transparent 60%), linear-gradient(180deg, #101014, #08080b)`,
        }}
      />
      <div className="grain absolute inset-0" aria-hidden />

      {/* bandă de timecode — semnătura diviziei video */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 flex h-7 items-center gap-[3px] px-3 opacity-60"
      >
        {Array.from({ length: 42 }).map((_, i) => (
          <span
            key={`${id}-${i}`}
            className="block w-px bg-white/50"
            style={{ height: i % 6 === 0 ? 12 : 5 }}
          />
        ))}
      </div>

      {/* Cât timp placa e un exemplu, butonul de redare nu e buton:
          un control focusabil care nu face nimic e o promisiune ratată
          și o capcană la navigarea cu tastatura. Rămâne semnul vizual;
          devine buton când intră materialul real. */}
      <span
        aria-hidden
        className="absolute inset-0 z-10 flex items-center justify-center"
      >
        <span className="glass-2 flex size-14 items-center justify-center rounded-full text-bone transition-transform duration-300 group-hover:scale-110">
          <Icon name="play" size={20} className="ml-0.5" />
        </span>
      </span>

      <figcaption className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-bone">
            {label}
          </span>
          {meta && (
            <span className="mt-0.5 block truncate text-xs text-dim">
              {meta}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {isPlaceholder && (
            <span className="rounded-full border border-white/20 bg-black/40 px-2 py-0.5 font-md-mono text-[10px] uppercase tracking-widest text-white/70">
              exemplu
            </span>
          )}
          <span className="rounded-full bg-black/50 px-2 py-0.5 font-md-mono text-[11px] text-white/80">
            {duration}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

/* ---------- Stack de avataruri (dovadă socială, fără fețe inventate) ---------- */
export function AvatarStack({ count = 4 }: { count?: number }) {
  const tints = [
    "linear-gradient(135deg,#3a3f4d,#171a21)",
    "linear-gradient(135deg,#4b3b33,#1c1614)",
    "linear-gradient(135deg,#33404b,#141a1f)",
    "linear-gradient(135deg,#443349,#1a141d)",
  ];
  return (
    <span className="flex -space-x-2" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="size-7 rounded-full ring-2 ring-ink"
          style={{ background: tints[i % tints.length] }}
        />
      ))}
    </span>
  );
}

/* ---------- FAQ ---------- */
export function Faq({
  items,
  className = "",
}: {
  items: readonly { q: string; a: string }[];
  className?: string;
}) {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();

  return (
    <div className={`divide-y divide-hair border-y border-hair ${className}`}>
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={it.q} className={isOpen ? "acc-open" : undefined}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${base}-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-6 py-6 text-left transition-colors hover:text-a3"
              >
                <span className="text-lg font-medium sm:text-xl">{it.q}</span>
                <span className="acc-sign flex size-9 shrink-0 items-center justify-center rounded-full border border-hair text-dim">
                  <Icon name="plus" size={16} />
                </span>
              </button>
            </h3>
            <div className="acc-body" id={`${base}-${i}`} role="region">
              <div>
                <p className="max-w-2xl pb-7 pr-12 text-[15px] leading-relaxed text-dim">
                  {it.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Testimoniale (trei carduri, statice) ----------
   Citatul e primul lucru pe care îl vezi; numele stă dedesubt, ca
   semnătură. Fără coloane care curg — trei voci se citesc, nu se
   derulează. */
function TestimonialCard({
  t,
  delay = 0,
}: {
  t: (typeof TESTIMONIALS)[number];
  delay?: number;
}) {
  return (
    <Reveal as="li" delay={delay}>
      <article className="glass flex h-full flex-col p-6 sm:p-7">
        <span className="display text-[2.6rem] leading-none text-a1" aria-hidden>
          „
        </span>
        <p className="mt-2 text-[16px] leading-relaxed text-bone sm:text-[17px]">
          {t.quote}
        </p>
        <div className="mt-auto flex items-center gap-3 pt-6">
          <ClientMark name={t.who} size={38} />
          <span>
            <span className="block text-sm font-medium text-bone">
              {t.who}
            </span>
            <span className="block text-xs text-dim">{t.where}</span>
          </span>
          {t.isPlaceholder && (
            <span className="ml-auto rounded-full border border-hair px-2 py-0.5 font-md-mono text-[10px] uppercase tracking-widest text-dim">
              exemplu
            </span>
          )}
        </div>
      </article>
    </Reveal>
  );
}

export function TestimonialWall() {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {TESTIMONIALS.map((t, i) => (
        <TestimonialCard key={t.who} t={t} delay={i * 90} />
      ))}
    </ul>
  );
}

/* ---------- Titlu de secțiune reutilizabil ---------- */
export function SectionHead({
  eyebrow,
  title,
  lead,
  align = "center",
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  const isCenter = align === "center";
  return (
    <Reveal
      className={`${isCenter ? "mx-auto text-center" : ""} max-w-2xl ${className}`}
    >
      {eyebrow && (
        <p
          className={`eyebrow mb-5 flex items-center gap-2 ${
            isCenter ? "justify-center" : ""
          }`}
        >
          <span className="rec-dot" aria-hidden />
          {eyebrow}
        </p>
      )}
      <h2 className="display text-[clamp(2rem,5.2vw,3.4rem)]">{title}</h2>
      {/* Pe telefon subtitlul e singurul text de dimensiune normală dintre
          un titlu mare și un rând de carduri; pornește de la 18.5px și se
          așază la 17.5 pe ecranele mari, unde rândul e oricum mai lung. */}
      {lead && (
        <p className="mt-5 text-[18.5px] leading-relaxed text-dim sm:text-[17.5px]">
          {lead}
        </p>
      )}
    </Reveal>
  );
}
