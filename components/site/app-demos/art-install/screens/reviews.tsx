"use client";

import { REVIEWS } from "../data";
import { CARD, CARD_HOVER, PageHero, Reveal, Sprite, useAI } from "../ui";

/* ============================================================
   Recenzii — ReviewsPage.tsx de pe site: nota, apoi fiecare
   recenzie Google pe cardul ei, două dintre ele cu fotografie.
   ============================================================ */

export function Reviews() {
  const { mobile } = useAI();
  return (
    <>
      <PageHero title="Recenzii" crumb="Acasă / Recenzii" />
      <section className={mobile ? "px-4 py-16" : "px-16 py-24"}>
        <div className={mobile ? "" : "mx-auto max-w-[832px]"}>
          <Reveal>
            <div className="mb-12 text-center">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl text-[#F97316]" aria-hidden>
                  ⭐
                </span>
                <span className="ai-h text-3xl font-bold text-[#EBE6E0]">4.98 / 5</span>
              </div>
              <p className="mt-2 text-[#9096A2]">180+ recenzii verificate Google</p>
            </div>
          </Reveal>

          <div className="space-y-6">
            {REVIEWS.map((r, i) => (
              <Reveal key={r.name} delay={i * 0.1}>
                <article className={`${CARD} ${CARD_HOVER} ${mobile ? "p-6" : "p-8"}`}>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#F97316]/10 font-bold text-[#F97316]">
                      {r.initials}
                    </div>
                    <div>
                      <p className="font-semibold text-[#EBE6E0]">{r.name}</p>
                      <p className="text-sm text-[#F97316]" aria-label="5 stele din 5">
                        ⭐⭐⭐⭐⭐
                      </p>
                    </div>
                  </div>
                  <p className="leading-relaxed text-[#9096A2]">„{r.text}”</p>
                  {r.img && (
                    <Sprite
                      sheet={r.img.sheet}
                      i={r.img.i}
                      box={4 / 3}
                      alt={r.img.alt}
                      className={`mt-4 rounded-xl ${mobile ? "" : "max-w-sm"}`}
                    />
                  )}
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
