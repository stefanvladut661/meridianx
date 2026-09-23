"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X, ZoomIn } from "lucide-react";
import { PF_CATEGORIES, PORTFOLIO, type PfCategory, type PfItem } from "../data";
import { FOCUS, MSG, Overlay, PageHero, Reveal, Sprite, pill, useAI } from "../ui";
import { CtaBanner } from "./home";

/* ============================================================
   Portofoliul — PortfolioPage.tsx: filtre pe categorii, grilă de
   lucrări, lightbox. Clipurile de montaj au doar poster în demo.
   ============================================================ */

export function Portfolio({ initialCat = "Toate" }: { initialCat?: PfCategory }) {
  const { mobile, notify } = useAI();
  const [cat, setCat] = useState<PfCategory>(initialCat);
  const [open, setOpen] = useState<number | null>(null);

  const items = useMemo(() => (cat === "Toate" ? PORTFOLIO : PORTFOLIO.filter((p) => p.cat === cat)), [cat]);
  const photos = useMemo(() => items.filter((p) => !p.video), [items]);

  const onItem = (p: PfItem) => {
    if (p.video) notify(MSG.video);
    else setOpen(photos.findIndex((x) => x.id === p.id));
  };

  return (
    <>
      <PageHero title="Portofoliu" crumb="Acasă / Portofoliu" />
      <section className={mobile ? "px-4 py-10" : "px-16 py-16"}>
        <div className={mobile ? "" : "mx-auto max-w-[1152px]"}>
          <div
            className={mobile ? "ai-noscroll -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1" : "mb-10 flex flex-wrap justify-center gap-2"}
            role="group"
            aria-label="Categorie de lucrări"
          >
            {PF_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={cat === c}
                onClick={() => setCat(c)}
                className={`${pill(cat === c)} shrink-0`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className={`grid gap-6 ${mobile ? "grid-cols-1" : "grid-cols-3"}`}>
            {items.map((p, i) => (
              <Reveal key={`${cat}-${p.id}`} delay={Math.min(i * 0.06, 0.36)}>
                <button
                  type="button"
                  onClick={() => onItem(p)}
                  aria-label={p.video ? `${p.label} (clip video)` : `Deschide fotografia: ${p.label}`}
                  className={`group relative block w-full overflow-hidden rounded-2xl text-left ${FOCUS}`}
                >
                  <Sprite
                    sheet={p.sheet}
                    i={p.i}
                    box={4 / 3}
                    alt={p.label}
                    innerClassName="transition-transform duration-500 group-hover:scale-105"
                    className={p.video ? "[&_img]:brightness-[.55] [&_img]:blur-[2px]" : ""}
                  />
                  {p.video && (
                    <>
                      <span className="absolute right-3 top-3 rounded-full bg-[#0E1115]/80 px-2 py-1 text-xs font-semibold text-[#EBE6E0]">
                        ▶ Video
                      </span>
                      <span className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#F97316] text-white shadow-xl shadow-black/40 transition-transform duration-300 group-hover:scale-110">
                        <Play size={26} className="ml-1 fill-current" />
                      </span>
                    </>
                  )}
                  <span
                    className={`absolute inset-0 flex items-end transition-all duration-300 ${
                      mobile || p.video
                        ? "bg-gradient-to-t from-[#0A0C0F]/85 via-[#0A0C0F]/10 to-transparent"
                        : "bg-[#0A0C0F]/0 group-hover:bg-[#0A0C0F]/50 group-focus-visible:bg-[#0A0C0F]/50"
                    }`}
                  >
                    <span
                      className={`flex w-full items-center justify-between gap-3 p-4 text-sm font-semibold text-[#F6F3EE] transition-all duration-300 ${
                        mobile || p.video
                          ? ""
                          : "translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
                      }`}
                    >
                      <span>{p.label}</span>
                      {!p.video && <ZoomIn size={16} className="shrink-0 opacity-70" />}
                    </span>
                  </span>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <CtaBanner />

      <Lightbox items={photos} index={open} setIndex={setOpen} />
    </>
  );
}

function Lightbox({
  items,
  index,
  setIndex,
}: {
  items: PfItem[];
  index: number | null;
  setIndex: (i: number | null) => void;
}) {
  const { mobile } = useAI();
  const n = items.length;
  const p = index !== null ? items[index] : null;

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((index + 1) % n);
      if (e.key === "ArrowLeft") setIndex((index - 1 + n) % n);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, n, setIndex]);

  const nav = `flex size-11 shrink-0 items-center justify-center rounded-full bg-[#F6F3EE]/10 text-[#F6F3EE] transition-colors hover:bg-[#F6F3EE]/20 ${FOCUS}`;
  return (
    <Overlay
      open={p !== null}
      onClose={() => setIndex(null)}
      label="Galerie foto"
      backdrop="rgba(10,12,15,0.92)"
      className="flex flex-col items-center"
    >
      {p && index !== null && (
        <>
          <div className="flex items-center gap-4">
            {!mobile && (
              <button type="button" onClick={() => setIndex((index - 1 + n) % n)} aria-label="Fotografia anterioară" className={nav}>
                <ChevronLeft size={22} />
              </button>
            )}
            <div className="relative" style={{ width: mobile ? 358 : 820 }}>
              <Sprite sheet={p.sheet} i={p.i} box={4 / 3} alt={p.label} className="rounded-xl shadow-2xl shadow-black/60" />
              <button
                type="button"
                data-autofocus
                onClick={() => setIndex(null)}
                aria-label="Închide galeria"
                className={`absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-[#0A0C0F]/70 text-[#F6F3EE] hover:bg-[#0A0C0F] ${FOCUS}`}
              >
                <X size={18} />
              </button>
            </div>
            {!mobile && (
              <button type="button" onClick={() => setIndex((index + 1) % n)} aria-label="Fotografia următoare" className={nav}>
                <ChevronRight size={22} />
              </button>
            )}
          </div>
          <div className="mt-4 flex items-center gap-4 text-[#F6F3EE]" style={{ width: mobile ? 358 : 820 }}>
            {mobile && (
              <button type="button" onClick={() => setIndex((index - 1 + n) % n)} aria-label="Fotografia anterioară" className={nav}>
                <ChevronLeft size={20} />
              </button>
            )}
            <div className="min-w-0 flex-1 text-center">
              <p className="ai-h text-lg font-bold leading-snug">{p.label}</p>
              <p className="text-xs text-[#F6F3EE]/60">
                {p.cat} · {index + 1} / {n}
              </p>
            </div>
            {mobile && (
              <button type="button" onClick={() => setIndex((index + 1) % n)} aria-label="Fotografia următoare" className={nav}>
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        </>
      )}
    </Overlay>
  );
}
