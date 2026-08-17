"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
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
    <div className="mt-6 rounded-md border border-line bg-surface p-5">
      <h3 className="font-mono text-[11px] tracking-[0.22em] text-accent">
        {t("manage.title").toUpperCase()}
      </h3>

      {/* până la montare nu afirmăm nimic: serverul nu știe alegerea */}
      <div aria-live="polite" className="mt-4 text-sm text-fg/85">
        {!mounted ? null : consent ? (
          <>
            <p>{t("manage.current")}</p>
            <ul className="mt-2 space-y-1">
              <li className="font-mono text-xs tracking-wider text-muted">
                {t("categories.necessary.label")} — {t("alwaysOn").toLowerCase()}
              </li>
              <li className="font-mono text-xs tracking-wider text-muted">
                {t("categories.analytics.label")} — {status(consent.analytics)}
              </li>
              <li className="font-mono text-xs tracking-wider text-muted">
                {t("categories.marketing.label")} — {status(consent.marketing)}
              </li>
            </ul>
          </>
        ) : (
          <p>{t("manage.none")}</p>
        )}
      </div>

      <Button
        variant="secondary"
        className="mt-5"
        onClick={() => resetConsent()}
      >
        {t("manage.button")}
      </Button>
    </div>
  );
}
