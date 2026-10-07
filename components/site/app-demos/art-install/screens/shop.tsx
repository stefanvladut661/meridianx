"use client";

import { useState } from "react";
import { Award, MessageCircle, Phone, ShieldCheck, X } from "lucide-react";
import { PHONE, PRODUCTS, type Product } from "../data";
import { BTN_PRIMARY, CARD_HOVER, FOCUS, MSG, Overlay, Reveal, Sprite, useAI } from "../ui";

/* ============================================================
   Magazinul — ShopPage.tsx de pe site: antetul bleumarin cu
   autorizația Daikin, grila celor zece produse, fereastra de
   detalii cu variantele de putere și „Cerere ofertă”, banda
   „Nu găsești ce cauți?”. Pe site nu există filtre sau căutare.
   ============================================================ */

export function Shop() {
  const { mobile, notify, nav } = useAI();
  const [open, setOpen] = useState<Product | null>(null);

  /* Pe site, „Cerere ofertă” deschide WhatsApp cu mesajul gata scris;
     în demo, același mesaj ajunge în formularul de contact. */
  const quote = (p: Product, code: string, label?: string) =>
    nav.contact({
      service: p.category === "pompe-caldura" ? "Pompe de căldură" : "Aer condiționat",
      message: `Bună ziua! Sunt interesat de produsul ${p.name}${label && label !== "Standard" ? ` ${label}` : ""} (cod ${code}). Aș dori o ofertă personalizată.`,
    });

  return (
    <>
      <section className="bg-[#0A0C0F]" style={{ paddingTop: mobile ? 100 : 128, paddingBottom: 48 }}>
        <div className={mobile ? "px-4" : "mx-auto max-w-[1216px] px-8"}>
          <div className="mb-3 flex items-center gap-2 text-sm text-[#F6F3EE]/60">
            <ShieldCheck size={14} className="text-[#F97316]" />
            <span>Partener autorizat Daikin</span>
          </div>
          <h1 className={`ai-h font-black text-[#F6F3EE] ${mobile ? "text-[30px] leading-tight" : "text-[48px] leading-[1.1]"}`}>
            Magazin echipamente
          </h1>
          <p className="mt-3 max-w-2xl text-[#F6F3EE]/70">
            O selecție de pompe de căldură Daikin, Hyundai și TCL. Contactează-ne pentru ofertă personalizată și consultanță tehnică gratuită.
          </p>
          <button
            type="button"
            onClick={() => notify(MSG.pdf)}
            className={`mt-6 inline-flex items-center gap-2 rounded-lg border border-[#F6F3EE]/20 bg-[#F6F3EE]/10 px-4 py-2 text-sm font-medium text-[#F6F3EE] transition-colors hover:bg-[#F6F3EE]/15 ${FOCUS}`}
          >
            <Award size={16} className="text-[#F97316]" />
            Autorizație Dealer Daikin 2026 (PDF)
          </button>
        </div>
      </section>

      <section className={mobile ? "px-4 pb-20 pt-10" : "pb-20 pt-10"}>
        <div className={mobile ? "" : "mx-auto max-w-[1216px] px-8"}>
          <p className="mb-6 text-xs text-[#9096A2]">{PRODUCTS.length} produse disponibile</p>
          <div className={`grid gap-6 ${mobile ? "grid-cols-1" : "grid-cols-4"}`}>
            {PRODUCTS.map((p, i) => (
              <Reveal key={p.id} delay={Math.min(i * 0.05, 0.3)}>
                <ProductCard
                  p={p}
                  onOpen={() => setOpen(p)}
                  onQuote={() => quote(p, p.variants[0].code, p.variants.length > 1 ? undefined : p.variants[0].label)}
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className={`border-t border-[#272C35] bg-[#15181E]/40 text-center ${mobile ? "px-4 py-12" : "px-16 py-12"}`}>
        <div className="mx-auto max-w-2xl">
          <h2 className={`ai-h font-bold text-[#EBE6E0] ${mobile ? "text-2xl" : "text-3xl"}`}>Nu găsești ce cauți?</h2>
          <p className="mt-2 text-[#9096A2]">
            Comercializăm întreaga gamă Daikin și alte branduri partenere. Contactează-ne pentru ofertă personalizată.
          </p>
          <div className={`mt-6 flex justify-center gap-3 ${mobile ? "flex-col" : "flex-wrap"}`}>
            <button type="button" onClick={() => notify(MSG.call)} className={`${BTN_PRIMARY} px-8 py-3.5`}>
              <Phone size={16} /> Sună: {PHONE}
            </button>
            <button
              type="button"
              onClick={() => notify(MSG.whatsapp)}
              className={`inline-flex items-center justify-center gap-2 rounded-lg border-2 border-[#272C35] px-8 py-3.5 font-semibold text-[#EBE6E0] transition-all duration-200 hover:scale-[1.03] hover:border-[#F97316] hover:text-[#F97316] ${FOCUS}`}
            >
              <MessageCircle size={16} /> WhatsApp
            </button>
          </div>
        </div>
      </section>

      <ProductDialog p={open} onClose={() => setOpen(null)} onQuote={quote} />
    </>
  );
}

function ProductCard({ p, onOpen, onQuote }: { p: Product; onOpen: () => void; onQuote: () => void }) {
  const first = p.variants[0];
  const many = p.variants.length > 1;
  const capacity = many ? p.variants.map((v) => v.capacity).join(" / ") : first.capacity;
  return (
    <div className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-[#272C35] bg-[#15181E] ${CARD_HOVER}`}>
      <button type="button" onClick={onOpen} className={`block overflow-hidden bg-[#1E2229] p-4 ${FOCUS}`} aria-label={`Detalii ${p.name}`} tabIndex={-1}>
        <Sprite sheet="prod" i={p.img} box={4 / 3} alt={p.name} innerClassName="transition-transform duration-500 ease-out group-hover:scale-105" />
      </button>
      <div className="flex flex-1 flex-col p-5">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#F97316]">{p.categoryLabel}</span>
        <h3 className="ai-h mt-1.5 text-lg font-bold leading-snug text-[#EBE6E0]">{p.name}</h3>
        <p className="mt-1 text-xs text-[#9096A2]">
          Brand: {p.brand}
          {many && ` · ${p.variants.length} variante disponibile`}
        </p>
        <ul className="mt-3 flex-1 space-y-1 text-sm text-[#9096A2]">
          <li>
            <span className="font-medium text-[#EBE6E0]/70">Capacitate:</span> {capacity}
          </li>
          <li>
            <span className="font-medium text-[#EBE6E0]/70">Agent frigorific:</span> {first.refrigerant}
          </li>
        </ul>
        <p className="mt-4 border-t border-[#272C35] pt-4 text-sm text-[#9096A2]">{first.shortAdvantages}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onOpen}
            className={`flex-1 whitespace-nowrap rounded-lg border border-[#272C35] px-2.5 py-2.5 text-[13px] font-semibold text-[#EBE6E0] transition-colors hover:border-[#F97316] hover:text-[#F97316] ${FOCUS}`}
          >
            Detalii
          </button>
          <button
            type="button"
            onClick={onQuote}
            className={`flex-1 whitespace-nowrap rounded-lg bg-[#F97316] px-2.5 py-2.5 text-center text-[13px] font-semibold text-white transition-colors hover:bg-[#E55F06] ${FOCUS}`}
          >
            Cerere ofertă
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductDialog({
  p,
  onClose,
  onQuote,
}: {
  p: Product | null;
  onClose: () => void;
  onQuote: (p: Product, code: string, label?: string) => void;
}) {
  const { mobile, notify } = useAI();
  const [variant, setVariant] = useState<{ pid: string; id: string } | null>(null);
  const v = p ? (p.variants.find((x) => variant?.pid === p.id && x.id === variant.id) ?? p.variants[0]) : null;

  return (
    <Overlay
      open={!!p}
      onClose={onClose}
      label={p ? `Detalii ${p.name}` : "Detalii produs"}
      align={mobile ? "bottom" : "center"}
      className={
        mobile
          ? "ai-noscroll max-h-[88%] w-full overflow-y-auto rounded-t-3xl border-t border-[#272C35] bg-[#15181E] pb-8"
          : "ai-noscroll max-h-[92%] w-[512px] overflow-y-auto rounded-2xl border border-[#272C35] bg-[#15181E] shadow-2xl shadow-black/60"
      }
    >
      {p && v && (
        <div className="relative flex flex-col">
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            aria-label="Închide"
            className={`absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-[#0E1115]/80 text-[#EBE6E0] transition-colors hover:bg-[#0E1115] ${FOCUS}`}
          >
            <X size={18} />
          </button>
          {mobile && <span aria-hidden className="absolute left-1/2 top-2 z-10 h-1 w-10 -translate-x-1/2 rounded-full bg-[#9096A2]/40" />}
          <div className={`px-6 pb-2 ${mobile ? "pt-8" : "pt-6"} text-left`}>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#F97316]">{p.categoryLabel}</span>
            <h2 className="ai-h text-2xl font-bold text-[#EBE6E0]">{p.name}</h2>
            <p className="text-sm text-[#9096A2]">
              Brand: {p.brand} · Cod: {v.code}
            </p>
          </div>
          <div className="space-y-4 px-6 pb-6 pt-2">
            {p.variants.length > 1 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9096A2]">Alege varianta</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Varianta de putere">
                  {p.variants.map((x) => {
                    const on = x.id === v.id;
                    return (
                      <button
                        key={x.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setVariant({ pid: p.id, id: x.id })}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${FOCUS} ${
                          on
                            ? "border-[#F97316] bg-[#F97316] text-white"
                            : "border-[#272C35] bg-[#15181E] text-[#EBE6E0] hover:border-[#F97316] hover:text-[#F97316]"
                        }`}
                      >
                        {x.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-[#272C35] bg-[#15181E] p-3">
                <p className="text-xs text-[#9096A2]">Capacitate / Putere</p>
                <p className="mt-0.5 font-semibold text-[#EBE6E0]">{v.capacity}</p>
              </div>
              <div className="rounded-lg border border-[#272C35] bg-[#15181E] p-3">
                <p className="text-xs text-[#9096A2]">Agent frigorific</p>
                <p className="mt-0.5 font-semibold text-[#EBE6E0]">{v.refrigerant}</p>
              </div>
            </div>
            <div>
              <h3 className="ai-h text-base font-bold text-[#EBE6E0]">Avantaje cheie</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#9096A2]">{v.shortAdvantages}</p>
            </div>
            <div>
              <h3 className="ai-h text-base font-bold text-[#EBE6E0]">Descriere</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#9096A2]">{v.fullDescription}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-[#272C35] pt-4">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onQuote(p, v.code, v.label);
                }}
                className={`inline-flex items-center justify-center gap-2 rounded-lg bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E55F06] ${FOCUS}`}
              >
                <MessageCircle size={16} /> Cerere ofertă
              </button>
              <button
                type="button"
                onClick={() => notify(MSG.call)}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border border-[#272C35] px-4 py-2.5 text-sm font-semibold text-[#EBE6E0] transition-colors hover:border-[#F97316] hover:text-[#F97316] ${FOCUS}`}
              >
                <Phone size={16} /> Sună
              </button>
            </div>
          </div>
        </div>
      )}
    </Overlay>
  );
}
