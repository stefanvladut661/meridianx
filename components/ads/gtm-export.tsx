"use client";

import { useState } from "react";
import { CATEGORY_LABEL, CONVERSION_TYPE_LABEL, sendToText } from "@/lib/ads/google/conversions/standard";
import { FORM_TRIGGER_LABEL, GTM_FILE_NAME, buildGtmImport, checkGtmInput, type FormTrigger, type GtmField, type GtmInput } from "@/lib/ads/google/conversions/gtm";
import type { ConversionActionInfo } from "@/lib/ads/google/conversions/types";
import { cn } from "@/lib/utils";
import { ERROR_TEXT, FIELD, FIELD_INVALID, LABEL, OK_TEXT, WARNING_TEXT } from "./tone";

/**
 * /admin/ads/conversii, importul GTM: alegi acțiunile (cu eticheta lor
 * AW-…/…) și cum se recunoaște formularul trimis; pagina face fișierul de
 * import (`lib/ads/google/conversions/gtm.ts`). Omul îl importă și îl publică
 * în GTM — portalul nu are acces acolo.
 */

const ITEM_KIND_LABEL = { tag: "Etichetă", trigger: "Declanșator", variable: "Variabile" } as const;

export function GtmExport({ trackingId, actions }: { trackingId: string | null; actions: ConversionActionInfo[] }) {
  const tagged = actions.filter((action) => action.sendTo && action.status === "ENABLED");
  const phoneChoices = tagged.filter((action) => action.type === "CLICK_TO_CALL" || action.type === "WEBPAGE");
  const formChoices = tagged.filter((action) => action.type === "WEBPAGE");
  // null = alegerea implicită, recalculată când apar acțiuni noi (după „Creează”).
  const [phoneChoice, setPhoneId] = useState<string | null>(null);
  const [formChoice, setFormActionId] = useState<string | null>(null);
  const phoneId = phoneChoice ?? phoneChoices.find((action) => action.type === "CLICK_TO_CALL")?.id ?? "";
  const formActionId = formChoice ?? (formChoices.find((action) => action.category === "SUBMIT_LEAD_FORM") ?? formChoices[0])?.id ?? "";
  const [triggerKind, setTriggerKind] = useState<FormTrigger["kind"]>("thank_you");
  const [formId, setFormId] = useState("");
  const [path, setPath] = useState("");
  const [event, setEvent] = useState("generate_lead");
  const [hasGoogleTag, setHasGoogleTag] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);

  const phone = phoneChoices.find((action) => action.id === phoneId) ?? null;
  const form = formChoices.find((action) => action.id === formActionId) ?? null;
  const trigger: FormTrigger =
    triggerKind === "form_submit" ? { kind: "form_submit", formId: formId.trim() } : triggerKind === "thank_you" ? { kind: "thank_you", path: path.trim() } : { kind: "event", event: event.trim() };
  const input: GtmInput = {
    conversionId: phone?.sendTo?.conversionId ?? form?.sendTo?.conversionId ?? trackingId ?? "",
    includeGoogleTag: !hasGoogleTag,
    phone: phone?.sendTo ?? null,
    form: form?.sendTo ? { ...form.sendTo, trigger } : null,
  };
  const check = checkGtmInput(input);
  const errorOf = (field: GtmField) => check.errors.find((error) => error.field === field)?.message;
  const ready = check.errors.length === 0;
  const built = ready ? buildGtmImport(input, new Date(0)) : null;
  const fileText = () => JSON.stringify(buildGtmImport(input, new Date()).file, null, 2);

  const download = () => {
    const url = URL.createObjectURL(new Blob([fileText()], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = GTM_FILE_NAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fileText());
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
    window.setTimeout(() => setCopied(null), 2500);
  };

  if (tagged.length === 0) {
    return (
      <div className="mt-4 rounded-panel-lg border border-dashed border-hair-strong px-6 py-8">
        <p className="font-md-display text-[1.25rem] font-semibold text-bone">Nicio acțiune cu etichetă încă.</p>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-bone/70">
          Importul are nevoie de eticheta AW-…/… a unei acțiuni de pe site — clic pe telefon sau pagină web. Creează-le mai sus: eticheta apare imediat
          după.
        </p>
      </div>
    );
  }

  const choice = (action: ConversionActionInfo) =>
    `${action.name} — ${CONVERSION_TYPE_LABEL[action.type] ?? action.type}${action.type === "WEBPAGE" ? `, ${CATEGORY_LABEL[action.category] ?? action.category}` : ""}`;

  return (
    <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
      <div className="min-w-0 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="gtm-telefon" className={LABEL}>
              Clicul pe telefon trimite
            </label>
            <select
              id="gtm-telefon"
              value={phoneId}
              onChange={(change) => setPhoneId(change.target.value)}
              aria-invalid={errorOf("phone") ? true : undefined}
              className={cn(FIELD, "mt-1.5 h-10 text-[14px]", errorOf("phone") && FIELD_INVALID)}
            >
              <option value="">nimic — fără conversie pe telefon</option>
              {phoneChoices.map((action) => (
                <option key={action.id} value={action.id}>
                  {choice(action)}
                </option>
              ))}
            </select>
            {errorOf("phone") ? <p className={cn("mt-1.5 text-[12.5px]", ERROR_TEXT)}>{errorOf("phone")}</p> : null}
          </div>
          <div>
            <label htmlFor="gtm-formular" className={LABEL}>
              Formularul trimis trimite
            </label>
            <select
              id="gtm-formular"
              value={formActionId}
              onChange={(change) => setFormActionId(change.target.value)}
              aria-invalid={errorOf("form") ? true : undefined}
              className={cn(FIELD, "mt-1.5 h-10 text-[14px]", errorOf("form") && FIELD_INVALID)}
            >
              <option value="">nimic — fără conversie pe formular</option>
              {formChoices.map((action) => (
                <option key={action.id} value={action.id}>
                  {choice(action)}
                </option>
              ))}
            </select>
            {errorOf("form") ? <p className={cn("mt-1.5 text-[12.5px]", ERROR_TEXT)}>{errorOf("form")}</p> : null}
          </div>
        </div>

        {form ? (
          <fieldset>
            <legend className={LABEL}>Cum se recunoaște formularul trimis</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(Object.keys(FORM_TRIGGER_LABEL) as Array<FormTrigger["kind"]>).map((kind) => (
                <label
                  key={kind}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-panel border px-3.5 py-2.5 text-[14px]",
                    triggerKind === kind ? "border-bone/50 bg-glass text-bone" : "border-hair text-bone/80"
                  )}
                >
                  <input type="radio" name="declansator" checked={triggerKind === kind} onChange={() => setTriggerKind(kind)} className="h-4 w-4 accent-[var(--md-a1)]" />
                  {FORM_TRIGGER_LABEL[kind]}
                </label>
              ))}
            </div>
            <div className="mt-3 max-w-md">
              {triggerKind === "thank_you" ? (
                <>
                  <label htmlFor="gtm-cale" className={LABEL}>
                    Calea paginii de mulțumire
                  </label>
                  <input
                    id="gtm-cale"
                    value={path}
                    onChange={(change) => setPath(change.target.value)}
                    placeholder="/multumim"
                    spellCheck={false}
                    aria-invalid={errorOf("path") && path ? true : undefined}
                    aria-describedby="gtm-cale-nota"
                    className={cn(FIELD, "mt-1.5 h-10 font-md-mono text-[14px]", errorOf("path") && path && FIELD_INVALID)}
                  />
                  <p id="gtm-cale-nota" className={cn("mt-1.5 text-[12.5px] leading-snug", errorOf("path") && path ? ERROR_TEXT : "text-dim")}>
                    {errorOf("path") && path ? errorOf("path") : "Pagina pe care ajunge omul DOAR după ce a trimis formularul. Fără domeniu."}
                  </p>
                </>
              ) : triggerKind === "event" ? (
                <>
                  <label htmlFor="gtm-eveniment" className={LABEL}>
                    Numele evenimentului din dataLayer
                  </label>
                  <input
                    id="gtm-eveniment"
                    value={event}
                    onChange={(change) => setEvent(change.target.value)}
                    spellCheck={false}
                    aria-invalid={errorOf("event") ? true : undefined}
                    aria-describedby="gtm-eveniment-nota"
                    className={cn(FIELD, "mt-1.5 h-10 font-md-mono text-[14px]", errorOf("event") && FIELD_INVALID)}
                  />
                  <p id="gtm-eveniment-nota" className={cn("mt-1.5 text-[12.5px] leading-snug", errorOf("event") ? ERROR_TEXT : "text-dim")}>
                    {errorOf("event") ?? `Site-ul trebuie să trimită, după trimiterea reușită: dataLayer.push({ event: "${event.trim() || "generate_lead"}" }).`}
                  </p>
                </>
              ) : (
                <>
                  <label htmlFor="gtm-form-id" className={LABEL}>
                    Form ID (opțional)
                  </label>
                  <input
                    id="gtm-form-id"
                    value={formId}
                    onChange={(change) => setFormId(change.target.value)}
                    placeholder="toate formularele"
                    spellCheck={false}
                    aria-invalid={errorOf("formId") ? true : undefined}
                    aria-describedby="gtm-form-id-nota"
                    className={cn(FIELD, "mt-1.5 h-10 font-md-mono text-[14px]", errorOf("formId") && FIELD_INVALID)}
                  />
                  <p id="gtm-form-id-nota" className={cn("mt-1.5 text-[12.5px] leading-snug", errorOf("formId") ? ERROR_TEXT : "text-dim")}>
                    {errorOf("formId") ?? "Atributul id al formularului de pe site. Gol = orice formular trimis."}
                  </p>
                </>
              )}
            </div>
          </fieldset>
        ) : null}

        <label className="flex items-start gap-3 text-[14px] leading-snug text-bone/85">
          <input type="checkbox" checked={hasGoogleTag} onChange={(change) => setHasGoogleTag(change.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--md-a1)]" />
          <span>
            Site-ul are deja tag-ul Google cu {input.conversionId ? `AW-${input.conversionId}` : "id-ul contului"}
            <span className="block text-[12.5px] text-dim">În cod (gtag.js) sau într-o etichetă GTM. Dacă nu ești sigur, lasă nebifat: importul îl adaugă.</span>
          </span>
        </label>
      </div>

      <div className="min-w-0 space-y-4 lg:sticky lg:top-[8rem]">
        {built ? (
          <div className="rounded-panel-lg border border-hair bg-char/60 px-4 py-4">
            <p className={cn("text-[13.5px] font-semibold", OK_TEXT)}>Ce intră în container</p>
            <ul className="mt-3 space-y-2.5">
              {built.items.map((item) => (
                <li key={`${item.kind}-${item.name}`} className="text-[13px] leading-snug">
                  <span className="font-md-mono text-[10.5px] uppercase tracking-[0.14em] text-dim">{ITEM_KIND_LABEL[item.kind]}</span>
                  <span className="block text-bone [overflow-wrap:anywhere]">{item.name}</span>
                  <span className="block text-dim">{item.what}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-[13px] leading-snug text-dim">
            {check.errors.find((error) => error.field !== "path" || path)?.message ?? "Scrie calea paginii de mulțumire."}
          </p>
        )}
        {check.warnings.length > 0 ? (
          <ul className={cn("space-y-1.5 text-[12.5px] leading-snug", WARNING_TEXT)}>
            {check.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={download} disabled={!ready} className="btn btn-light disabled:cursor-not-allowed disabled:opacity-45">
            Descarcă fișierul de import
          </button>
          <button type="button" onClick={copy} disabled={!ready} className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-45">
            Copiază JSON-ul
          </button>
        </div>
        <p aria-live="polite" className={cn("text-[13px]", copied === "failed" ? ERROR_TEXT : OK_TEXT)}>
          {copied === "ok" ? "Copiat." : copied === "failed" ? "Browserul n-a lăsat copierea: folosește descărcarea." : ""}
        </p>
        {ready ? (
          <details onToggle={(toggle) => setShowJson((toggle.target as HTMLDetailsElement).open)} className="rounded-panel-lg border border-hair">
            <summary className="cursor-pointer px-4 py-2.5 text-[13px] text-dim hover:text-bone">Vezi JSON-ul</summary>
            {showJson ? (
              <pre className="max-h-80 overflow-auto border-t border-hair px-4 py-3 font-md-mono text-[11.5px] leading-relaxed text-bone/85">{fileText()}</pre>
            ) : null}
          </details>
        ) : null}
        {phone?.sendTo || form?.sendTo ? (
          <p className="text-[12.5px] leading-snug text-dim">
            Etichetele: {[phone?.sendTo ? `telefon ${sendToText(phone.sendTo)}` : null, form?.sendTo ? `formular ${sendToText(form.sendTo)}` : null].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
