import { Mark } from "@/components/site/mark";

/**
 * /vault — ecranul principal (feat/vault).
 *
 * FAZA 1 livrează doar stratul criptografic, schema și izolarea rutei;
 * pagina de aici există ca ruta să fie verificabilă (middleware, CSP,
 * noindex). Faza 2 o înlocuiește cu deblocarea și inițializarea.
 */
export default function VaultPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-16">
      <div aria-hidden className="techgrid pointer-events-none absolute inset-0" />

      <div className="glass-2 edge-light relative w-full max-w-[26rem] !bg-[rgb(12_13_17/0.9)] p-7 sm:p-9">
        <div className="flex items-center gap-2.5 text-bone">
          <Mark size={22} />
          <span className="font-md-display text-[14px] font-semibold tracking-[0.2em]">
            MERIDIAN
          </span>
        </div>

        <p className="eyebrow mt-8 !text-[11.5px]">Vault · faza 1 din 6</p>
        <h1 className="display mt-3 text-[2.125rem] text-bone">
          Se construiește
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-dim">
          Stratul criptografic și schema există. Deblocarea vine în faza
          următoare.
        </p>
      </div>
    </main>
  );
}
