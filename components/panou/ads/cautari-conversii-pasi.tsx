import type { ConversionActionInfo, ConversionSetup } from "@/lib/ads/google/conversions/types";
import { Card, Pill, SectionTitle } from "@/components/panou/ui/primitives";

/**
 * Ce rămâne în mâna omului: pașii din Google Tag Manager după descărcare și
 * setările din Google Ads pe care portalul le citește, dar nu le schimbă. Sunt
 * pași reali, în ordine, deci numerotarea spune ceva adevărat.
 */

export function ConversiiPasi({ setup, calls }: { setup: ConversionSetup; calls: ConversionActionInfo[] }) {
  const callReportingOn = setup.callReporting.enabled && setup.callReporting.conversions;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <SectionTitle title="În GTM, după descărcare" hint="portalul nu publică nimic în containerul clientului" />
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[12px] leading-relaxed text-foreground/80 marker:text-muted-foreground">
          <li>Administrator → Importă containerul → alege fișierul.</li>
          <li>Spațiul de lucru: cel existent (sau unul nou, dacă altcineva lucrează în container).</li>
          <li>
            Opțiunea: <strong className="font-semibold text-foreground">Combinare</strong>, cu{" "}
            <strong className="font-semibold text-foreground">Redenumește etichetele, declanșatoarele și variabilele în conflict</strong>. Niciodată „Suprascrie” sau „Înlocuiește”: ar
            schimba ce are deja clientul.
          </li>
          <li>Citește rezumatul importului: trebuie să apară doar elemente adăugate. Dacă apare ceva modificat sau șters, renunță.</li>
          <li>Previzualizare pe site: atinge un număr de telefon, trimite formularul de test — etichetele „Google Ads · conversie · …” trebuie să apară ca declanșate.</li>
          <li>Trimite → Publică. Portalul nu publică nimic în GTM.</li>
          <li>În Google Ads → Obiective → Conversii, acțiunea trece pe „Înregistrează conversii” după prima conversie (până la câteva ore).</li>
        </ol>
      </Card>

      <Card>
        <SectionTitle title="De mână, în Google Ads" hint="setări de cont pe care portalul le citește, dar nu le schimbă" />
        <ul className="mt-3 space-y-3.5 text-[12px] leading-relaxed text-foreground/80">
          <li>
            <p className="flex flex-wrap items-center gap-2">
              <strong className="font-semibold text-foreground">Raportarea apelurilor</strong>
              <Pill tone={callReportingOn ? "mint" : "apricot"} dot>
                {callReportingOn ? "pornită" : "oprită"}
              </Pill>
            </p>
            <p className="mt-1">
              Administrator → Setările contului → Raportarea apelurilor: pornită, cu „Conversii din apeluri”. E o setare de cont; portalul doar o citește (singura modificare pe care o
              face pe un cont existent e pauza).
            </p>
            <p className={callReportingOn ? "mt-1 text-[#A7EFC3]" : "mt-1 text-[#FFC79C]"}>
              {callReportingOn ? "Contul ăsta o are pornită." : "Contul ăsta n-o are pornită: apelurile din anunțuri nu se numără."}
            </p>
          </li>
          <li>
            <strong className="font-semibold text-foreground">Butonul de apel din planul de căutare</strong> — pune id-ul acțiunii „apel din anunț” la{" "}
            <code className="font-mono text-[11px] text-foreground">assets.call.conversion_action_id</code>
            {calls.length > 0 ? (
              <>
                : <span className="font-mono text-[11px] text-foreground">{calls.map((action) => `${action.id} (${action.name})`).join(", ")}</span>.
              </>
            ) : (
              "; contul n-are încă una — creează-o în cardul de creare."
            )}
          </li>
          <li>
            <strong className="font-semibold text-foreground">Obiectivele campaniilor</strong> — o campanie cu obiective proprii (nu cele ale contului) nu ia singură acțiunile noi:
            adaugă-le în setările ei.
          </li>
          <li>
            <strong className="font-semibold text-foreground">Consimțământul</strong> — pe un site cu banner de cookie-uri, etichetele Google din GTM numără corect doar dacă bannerul
            trimite semnalele Consent Mode (implicit refuzat, apoi alegerea omului).
          </li>
          <li>
            <strong className="font-semibold text-foreground">Fără dubluri</strong> — dacă site-ul trimite deja conversia din cod (gtag), nu importa eticheta GTM pentru aceeași acțiune:
            s-ar număra de două ori.
          </li>
        </ul>
      </Card>
    </div>
  );
}
