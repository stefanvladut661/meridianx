"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CONSENT_EVENT,
  readConsent,
  resetConsent,
  type ConsentState,
} from "@/lib/consent";

/**
 * Panoul de pe pagina de cookie-uri: arată alegerea curentă și o poate
 * reseta (FAZA 7).
 *
 * GDPR cere ca retragerea consimțământului să fie la fel de simplă ca
 * acordarea lui. Aici e un buton, pe pagina la care duce link-ul din
 * banner și din subsol.
 */
export function ConsentPreferences() {
  const t = useTranslations("cookies");
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [mounted, setMounted] = useState(false);

  const sync = useCallback(() => setConsent(readConsent()), []);

  useEffect(() => {
    sync();
    setMounted(true);
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, [sync]);

  const status = (value: boolean) =>
    value ? t("manage.granted") : t("manage.denied");

  return (
    <div className="mt-6 rounded-panel border border-hair bg-glass p-5">
      <h3 className="font-md-mono text-[11px] tracking-[0.22em] text-a1">
        {t("manage.title").toUpperCase()}
      </h3>

      {/* până la montare nu afirmăm nimic: serverul nu știe alegerea */}
      <div aria-live="polite" className="mt-4 text-[14.5px] leading-relaxed text-bone/85">
        {!mounted ? null : consent ? (
          <>
            <p>{t("manage.current")}</p>
            <ul className="mt-2 space-y-1">
              <li className="font-md-mono text-[12px] tracking-wider text-dim">
                {t("categories.necessary.label")} — {t("alwaysOn").toLowerCase()}
              </li>
              <li className="font-md-mono text-[12px] tracking-wider text-dim">
                {t("categories.analytics.label")} — {status(consent.analytics)}
              </li>
              <li className="font-md-mono text-[12px] tracking-wider text-dim">
                {t("categories.marketing.label")} — {status(consent.marketing)}
              </li>
            </ul>
          </>
        ) : (
          <p>{t("manage.none")}</p>
        )}
      </div>

      <button
        type="button"
        className="btn btn-ghost mt-5 !min-h-10 !px-4 !py-2 !text-[13.5px]"
        onClick={() => resetConsent()}
      >
        {t("manage.button")}
      </button>
    </div>
  );
}
