"use client";

import { useState } from "react";
import { Download, Tags } from "lucide-react";
import { CATEGORY_LABEL, CONVERSION_TYPE_LABEL, sendToText } from "@/lib/ads/google/conversions/standard";
import { FORM_TRIGGER_LABEL, GTM_FILE_NAME, buildGtmImport, checkGtmInput, type FormTrigger, type GtmField, type GtmInput } from "@/lib/ads/google/conversions/gtm";
import type { ConversionActionInfo } from "@/lib/ads/google/conversions/types";
import { InlineNote } from "@/components/panou/ui/actions";
import { Btn, Card, SectionTitle } from "@/components/panou/ui/primitives";
import { SoftSelect } from "@/components/panou/ui/select";
import { EmptyState } from "@/components/panou/ui/states";
import { useToast } from "@/components/panou/ui/toast";
import { cn } from "@/lib/utils";
import { Camp, campClass, descriere } from "./cautari-conversii-ui";

/**
 * Exportul pentru Google Tag Manager: alegi acțiunile (cu eticheta lor
 * AW-…/…) și cum se recunoaște formularul trimis; fișierul de import îl face
 * `lib/ads/google/conversions/gtm.ts`. Omul îl importă și îl publică în GTM —
 * portalul nu are acces acolo și nu atinge nimic din containerul clientului.
 */

const ITEM_KIND_LABEL = { tag: "Etichetă", trigger: "Declanșator", variable: "Variabile" } as const;

export function GtmExport({ trackingId, actions }: { trackingId: string | null; actions: ConversionActionInfo[] }) {
  const { notify } = useToast();
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
    notify("Fișierul GTM e gata de importat.");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fileText());
      notify("JSON-ul e copiat.");
    } catch {
      notify("Browserul n-a lăsat copierea: folosește descărcarea.", "error");
    }
  };

  const choice = (action: ConversionActionInfo) =>
    `${action.name} — ${CONVERSION_TYPE_LABEL[action.type] ?? action.type}${action.type === "WEBPAGE" ? `, ${CATEGORY_LABEL[action.category] ?? action.category}` : ""}`;

  const pathError = errorOf("path") && path ? errorOf("path") : undefined;

  return (
    <Card>
      <SectionTitle title="Export pentru Google Tag Manager" hint="fișier de import + pașii" />
      <ol className="mt-3 space-y-2 text-[11.5px] leading-relaxed text-muted-foreground">
        <li>1. Alege ce trimit clicul pe telefon și formularul trimis.</li>
        <li>2. Descarcă fișierul JSON de mai jos.</li>
        <li>3. Importă-l în Tag Manager și publică (pașii exacți, mai jos pe pagină).</li>
      </ol>

      {tagged.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/[0.12]">
          <EmptyState
            icon={Tags}
            className="px-4 py-8"
            title="Nicio acțiune cu etichetă încă"
            text="Importul are nevoie de eticheta AW-…/… a unei acțiuni de pe site — clic pe telefon sau pagină web. Creează-le în cardul „Creează acțiunile standard”: eticheta apare imediat după."
          />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <SoftSelect
              label="Clicul pe telefon trimite"
              value={phoneId}
              onChange={setPhoneId}
              options={[{ value: "", label: "nimic — fără conversie pe telefon" }, ...phoneChoices.map((action) => ({ value: action.id, label: choice(action) }))]}
            />
            {errorOf("phone") ? <p className="mt-1.5 text-[11.5px] leading-snug text-rose">{errorOf("phone")}</p> : null}
          </div>
          <div>
            <SoftSelect
              label="Formularul trimis trimite"
              value={formActionId}
              onChange={setFormActionId}
              options={[{ value: "", label: "nimic — fără conversie pe formular" }, ...formChoices.map((action) => ({ value: action.id, label: choice(action) }))]}
            />
            {errorOf("form") ? <p className="mt-1.5 text-[11.5px] leading-snug text-rose">{errorOf("form")}</p> : null}
          </div>

          {form ? (
            <fieldset>
              <legend className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Cum se recunoaște formularul trimis</legend>
              <div className="mt-2 grid gap-1.5">
                {(Object.keys(FORM_TRIGGER_LABEL) as Array<FormTrigger["kind"]>).map((kind) => (
                  <label
                    key={kind}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-[12.5px] transition-colors",
                      triggerKind === kind ? "border-lav/30 bg-lav/[0.07] text-foreground" : "border-white/[0.07] text-foreground/80 hover:bg-white/[0.04]"
                    )}
                  >
                    <input type="radio" name="declansator" checked={triggerKind === kind} onChange={() => setTriggerKind(kind)} className="h-4 w-4 accent-lav" />
                    {FORM_TRIGGER_LABEL[kind]}
                  </label>
                ))}
              </div>
              <div className="mt-3">
                {triggerKind === "thank_you" ? (
                  <Camp
                    id="gtm-cale"
                    label="Calea paginii de mulțumire"
                    error={pathError}
                    hint="Pagina pe care ajunge omul DOAR după ce a trimis formularul. Fără domeniu."
                  >
                    <input
                      id="gtm-cale"
                      value={path}
                      onChange={(change) => setPath(change.target.value)}
                      placeholder="/multumim"
                      spellCheck={false}
                      className={campClass(Boolean(pathError), true)}
                      {...descriere("gtm-cale", pathError, true)}
                    />
                  </Camp>
                ) : triggerKind === "event" ? (
                  <Camp
                    id="gtm-eveniment"
                    label="Numele evenimentului din dataLayer"
                    error={errorOf("event")}
                    hint={`Site-ul trebuie să trimită, după trimiterea reușită: dataLayer.push({ event: "${event.trim() || "generate_lead"}" }).`}
                  >
                    <input
                      id="gtm-eveniment"
                      value={event}
                      onChange={(change) => setEvent(change.target.value)}
                      spellCheck={false}
                      className={campClass(Boolean(errorOf("event")), true)}
                      {...descriere("gtm-eveniment", errorOf("event"), true)}
                    />
                  </Camp>
                ) : (
                  <Camp id="gtm-form-id" label="Form ID (opțional)" error={errorOf("formId")} hint="Atributul id al formularului de pe site. Gol = orice formular trimis.">
                    <input
                      id="gtm-form-id"
                      value={formId}
                      onChange={(change) => setFormId(change.target.value)}
                      placeholder="toate formularele"
                      spellCheck={false}
                      className={campClass(Boolean(errorOf("formId")), true)}
                      {...descriere("gtm-form-id", errorOf("formId"), true)}
                    />
                  </Camp>
                )}
              </div>
            </fieldset>
          ) : null}

          <label className="flex items-start gap-2.5 text-[12.5px] leading-snug text-foreground/85">
            <input type="checkbox" checked={hasGoogleTag} onChange={(change) => setHasGoogleTag(change.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-lav" />
            <span>
              Site-ul are deja tag-ul Google cu {input.conversionId ? `AW-${input.conversionId}` : "id-ul contului"}
              <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                În cod (gtag.js) sau într-o etichetă GTM. Dacă nu ești sigur, lasă nebifat: importul îl adaugă.
              </span>
            </span>
          </label>

          {built ? (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
              <p className="text-[12px] font-medium text-[#A7EFC3]">Ce intră în container</p>
              <ul className="mt-2.5 space-y-2.5">
                {built.items.map((item) => (
                  <li key={`${item.kind}-${item.name}`} className="text-[12px] leading-snug">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{ITEM_KIND_LABEL[item.kind]}</span>
                    <span className="block [overflow-wrap:anywhere]">{item.name}</span>
                    <span className="block text-muted-foreground">{item.what}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[12px] leading-snug text-muted-foreground">{check.errors.find((error) => error.field !== "path" || path)?.message ?? "Scrie calea paginii de mulțumire."}</p>
          )}

          {check.warnings.length > 0 ? (
            <InlineNote tone="apricot">
              <ul className="space-y-1.5 text-[12px] leading-snug">
                {check.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </InlineNote>
          ) : null}

          <div className="space-y-2">
            <Btn variant="primary" size="sm" icon={Download} onClick={download} disabled={!ready} className="w-full justify-center">
              Descarcă importul GTM
            </Btn>
            <Btn variant="outline" size="sm" onClick={copy} disabled={!ready} className="w-full justify-center">
              Copiază JSON-ul
            </Btn>
          </div>
          <p className="text-[10.5px] text-muted-foreground">Conține doar etichetele alese. Nicio cheie de acces.</p>

          {ready ? (
            <details onToggle={(toggle) => setShowJson((toggle.target as HTMLDetailsElement).open)} className="rounded-xl border border-white/[0.07]">
              <summary className="cursor-pointer rounded-xl px-3.5 py-2.5 text-[12px] text-muted-foreground hover:text-foreground">Vezi JSON-ul</summary>
              {showJson ? <pre className="max-h-72 overflow-auto border-t border-white/[0.06] px-3.5 py-3 font-mono text-[11px] leading-relaxed text-foreground/85">{fileText()}</pre> : null}
            </details>
          ) : null}
          {phone?.sendTo || form?.sendTo ? (
            <p className="text-[11.5px] leading-snug text-muted-foreground">
              Etichetele: {[phone?.sendTo ? `telefon ${sendToText(phone.sendTo)}` : null, form?.sendTo ? `formular ${sendToText(form.sendTo)}` : null].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}
