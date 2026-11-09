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
        <SectionTitle title="În GTM, după descărcare" info="Portalul nu publică nimic în containerul clientului." />
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13.5px] leading-relaxed text-foreground/80 marker:text-muted-foreground">
          <li>Administrator → Importă containerul → alege fișierul.</li>
          <li>Spațiul de lucru: cel existent (sau unul nou, dacă mai lucrează cineva).</li>
          <li>
            <strong className="font-semibold text-foreground">Combinare</strong>, cu{" "}
            <strong className="font-semibold text-foreground">Redenumește etichetele, declanșatoarele și variabilele în conflict</strong>. Niciodată „Suprascrie” sau „Înlocuiește”: ar
            schimba ce are clientul.
          </li>
          <li>Rezumatul importului: doar elemente adăugate. Ceva modificat sau șters → renunță.</li>
          <li>Previzualizare pe site: atinge telefonul, trimite un formular de test. Etichetele „Google Ads · conversie · …” apar declanșate.</li>
          <li>Trimite → Publică.</li>
          <li>Google Ads → Obiective → Conversii: acțiunea trece pe „Înregistrează conversii” după prima conversie (câteva ore).</li>
        </ol>
      </Card>

      <Card>
        <SectionTitle title="De mână, în Google Ads" info="Setări de cont: portalul le citește, nu le schimbă." />
        <ul className="mt-3 space-y-3.5 text-[13.5px] leading-relaxed text-foreground/80">
          <li>
            <p className="flex flex-wrap items-center gap-2">
              <strong className="font-semibold text-foreground">Raportarea apelurilor</strong>
              <Pill tone={callReportingOn ? "mint" : "apricot"} dot>
                {callReportingOn ? "pornită" : "oprită"}
              </Pill>
            </p>
            <p className="mt-1">Administrator → Setările contului → Raportarea apelurilor: pornită, cu „Conversii din apeluri”.</p>
            {callReportingOn ? null : <p className="mt-1 text-[#FFC79C]">Apelurile din anunțuri nu se numără.</p>}
          </li>
          <li>
            <strong className="font-semibold text-foreground">Butonul de apel</strong> — id-ul acțiunii „apel din anunț” merge în planul de căutare, la{" "}
            <code className="font-mono text-[12.5px] text-foreground">assets.call.conversion_action_id</code>
            {calls.length > 0 ? (
              <>
                : <span className="font-mono text-[12.5px] text-foreground">{calls.map((action) => `${action.id} (${action.name})`).join(", ")}</span>.
              </>
            ) : (
              "; contul n-are încă una: creeaz-o mai sus."
            )}
          </li>
          <li>
            <strong className="font-semibold text-foreground">Obiectivele campaniilor</strong> — o campanie cu obiective proprii nu ia singură acțiunile noi: adaugă-le în setările ei.
          </li>
          <li>
            <strong className="font-semibold text-foreground">Consimțământul</strong> — cu banner de cookie-uri, etichetele numără corect doar dacă bannerul trimite Consent Mode
            (implicit refuzat, apoi alegerea omului).
          </li>
          <li>
            <strong className="font-semibold text-foreground">Fără dubluri</strong> — dacă site-ul trimite deja conversia din cod (gtag), nu importa eticheta GTM pentru ea: s-ar număra
            dublu.
          </li>
        </ul>
      </Card>
    </div>
  );
}
