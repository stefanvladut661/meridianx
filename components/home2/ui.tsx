"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@/components/site/ui";
import { CONTACT } from "@/components/site/video-content";
import { useSeen, type Showcase } from "./hooks";
import s from "./home2.module.css";
import g from "./graphics.module.css";

/* ============================================================
   Piesele mici ale paginii /home-2.
   ============================================================ */

export { Icon };

/** Intrare în scenă la primul contact cu ecranul. */
export function Rise({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
  style,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "header" | "p";
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const seen = useSeen(ref);
  return (
    <Tag
      // @ts-expect-error — ref polimorf pe un set restrâns de taguri
      ref={ref}
      className={`${s.rise} ${className}`}
      data-in={seen ? "" : undefined}
      style={{ ["--d" as string]: `${delay}ms`, ...style }}
    >
      {children}
    </Tag>
  );
}

/** Eticheta albastră + titlul în două tonuri, ca în referință. */
export function Title({
  eyebrow,
  title,
  dim,
  id,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: ReactNode;
  dim?: ReactNode;
  id?: string;
  as?: "h2" | "h3";
}) {
  return (
    <>
      {eyebrow && <p className={s.eyebrow}>{eyebrow}</p>}
      <Tag id={id} className={`${s.h2} ${eyebrow ? "mt-5" : ""}`}>
        {title}
        {dim && (
          <>
            {" "}
            <span className={s.dim}>{dim}</span>
          </>
        )}
      </Tag>
    </>
  );
}

/** Butonul principal + WhatsApp + rândul mic de sub ele. */
export function Actions({
  note,
  className = "",
}: {
  note?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className={s.actions}>
        <a href="#contact" className={`${s.btn} ${s.btnLight}`}>
          Cere ofertă
          <Icon name="arrowRight" size={17} className={s.arw} />
        </a>
        <a href={CONTACT.whatsapp} className={`${s.btn} ${s.btnDark}`}>
          <Icon name="whatsapp" size={18} />
          WhatsApp
        </a>
      </div>
      {note && <p className={s.actionsNote}>{note}</p>}
    </div>
  );
}

/* ---------- Iconuri care lipsesc din setul site-ului ---------- */

export function SkipIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M6 5.5v13l9.5-6.5L6 5.5Z" />
      <rect x="16.5" y="5.5" width="2.4" height="13" rx="0.6" />
    </svg>
  );
}

export function ArrowUpRight({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

/**
 * Rama graficelor: cardul închis din referință, cu cele două butoane
 * mici sus, la mijloc. Butoanele sunt reale — oprirea unei animații care
 * se repetă e obligatorie pentru accesibilitate, nu un ornament.
 *
 * Desenul de dedesubt e decorativ (`aria-hidden`): tot ce spune el e
 * scris și în coloana de text de alături.
 */
export function MotionCard({
  show,
  label,
  children,
  square = true,
  className = "",
}: {
  show: Showcase;
  /** Ce animă cardul — pentru etichetele butoanelor. */
  label: string;
  children: ReactNode;
  square?: boolean;
  className?: string;
}) {
  return (
    <div className={`${s.card} ${square ? s.cardSquare : ""} ${g.host} ${className}`}>
      <div className={s.cardCtrls}>
        <button
          type="button"
          data-pause
          className={s.ctrl}
          onClick={show.toggle}
          aria-label={show.running ? `Oprește animația: ${label}` : `Pornește animația: ${label}`}
        >
          <Icon name={show.running ? "pause" : "play"} size={13} />
        </button>
        <button
          type="button"
          className={s.ctrl}
          onClick={show.next}
          aria-label={`Următorul: ${label}`}
        >
          <SkipIcon size={13} />
        </button>
      </div>
      <div
        aria-hidden
        className={g.stage}
        data-frozen={show.frozen ? "" : undefined}
      >
        {children}
      </div>
    </div>
  );
}

/** Rândul de sus al graficului: eticheta din stânga, pastila din dreapta. */
export function CardHead({ label, pill }: { label: ReactNode; pill?: ReactNode }) {
  return (
    <div className={g.head}>
      <span className={g.label}>{label}</span>
      {pill && <span className={g.pill}>{pill}</span>}
    </div>
  );
}

/**
 * Pista de progres: un segment pe pas, cel curent se umple pe durata
 * pasului. Ruda pistei „DAY 30” din referință.
 */
export function StepTrack({ show, count, ms }: { show: Showcase; count: number; ms: number }) {
  // Cât timp pasul nu avansează singur, segmentul stă plin: o pistă care
  // se umple ar promite un pas următor care nu mai vine.
  const timed = show.running && !show.reduced;
  return (
    <div
      className={g.track}
      style={{
        ["--ms" as string]: `${ms}ms`,
        animationPlayState: show.holding ? "paused" : undefined,
      }}
      data-holding={show.holding ? "" : undefined}
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={g.seg}
          data-state={i < show.step ? "done" : i === show.step ? "now" : undefined}
        >
          {i === show.step && (
            <span
              key={`${show.step}-${timed}`}
              className={g.segFill}
              data-static={timed ? undefined : ""}
            />
          )}
        </span>
      ))}
    </div>
  );
}
