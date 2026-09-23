"use client";

import { useId, useState, type ReactNode } from "react";
import {
  CONVERSION_EVENT_LABEL,
  CONVERSION_EVENT_NAME,
  CTA_LABEL,
  CURRENCIES,
  GENDER_LABEL,
  MAX_TEXT_VARIANTS,
  META_ENHANCEMENTS,
  META_ENHANCEMENT_LABEL,
  META_HEADLINE_VISIBLE,
  META_PLACEMENTS,
  META_PLACEMENT_LABEL,
  META_PRIMARY_TEXT_VISIBLE,
  META_SPECIAL_CATEGORIES,
  META_SPECIAL_CATEGORY_LABEL,
  OBJECTIVES,
  OBJECTIVES_WITH_CONVERSION,
  OBJECTIVE_LABEL,
  TIKTOK_AD_TEXT_MAX,
  TIKTOK_ENHANCEMENTS,
  TIKTOK_ENHANCEMENT_LABEL,
  TIKTOK_IDENTITY_LABEL,
  TIKTOK_IDENTITY_TYPES,
  TIKTOK_PLACEMENTS,
  TIKTOK_PLACEMENT_LABEL,
  VARIANT_MODES,
  VARIANT_MODE_LABEL,
  type Objective,
  type Platform,
} from "@/lib/ads/constants";
import { asArray, asRecord, asString, getIn } from "@/lib/ads/plan-path";
import type { PlanSummary } from "@/lib/ads/plan-summary";
import { UTM_KEYS } from "@/lib/ads/plan-derive";
import type { WorkspaceSummary } from "@/lib/ads/workspaces";
import { cn } from "@/lib/utils";
import {
  FieldMessages,
  NumberField,
  PathMessages,
  RemoveButton,
  SelectField,
  TextField,
  TextListField,
  ToggleField,
  fieldId,
  usePlanForm,
} from "./fields";
import { ERROR_DOT, ERROR_TEXT, FIELD, LABEL, OK_DOT, OK_TEXT, WARNING_DOT, WARNING_TEXT } from "./tone";

/**
 * Previzualizarea editabilă, pe secțiuni — fișa de ordin a campaniei.
 *
 * În stânga fiecărei secțiuni: numele și starea ei (punct roșu = de
 * corectat, chihlimbar = de citit, verde = în regulă). Starea e calculată
 * din erorile validării, deci nu poate spune „în regulă" despre ceva
 * greșit. În dreapta: câmpurile, legate direct de plan.
 */

function entries<T extends string>(values: readonly T[], labels: Record<T, string>) {
  return values.map((value) => [value, labels[value]] as const);
}

// ---------------------------------------------------------------------------
// Secțiune
// ---------------------------------------------------------------------------

function Section({
  title,
  prefixes,
  children,
  aside,
}: {
  title: string;
  /** Căile care aparțin secțiunii — din ele se calculează starea. */
  prefixes: string[];
  children: ReactNode;
  aside?: ReactNode;
}) {
  const { errors, warnings } = usePlanForm();
  const headingId = useId();
  const belongs = (path: string) =>
    prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}.`));
  const errorCount = [...errors.entries()]
    .filter(([path]) => belongs(path))
    .reduce((total, [, list]) => total + list.length, 0);
  const warningCount = [...warnings.entries()]
    .filter(([path]) => belongs(path))
    .reduce((total, [, list]) => total + list.length, 0);

  const state =
    errorCount > 0
      ? { dot: ERROR_DOT, text: ERROR_TEXT, label: `${errorCount} de corectat` }
      : warningCount > 0
        ? { dot: WARNING_DOT, text: WARNING_TEXT, label: `${warningCount} de citit` }
        : { dot: OK_DOT, text: OK_TEXT, label: "în regulă" };

  return (
    <section
      aria-labelledby={headingId}
      className="grid gap-x-8 gap-y-4 border-t border-hair py-7 lg:grid-cols-[9.5rem_minmax(0,1fr)]"
    >
      <div>
        <h3 id={headingId} className="eyebrow !text-[11.5px] !text-bone">
          {title}
        </h3>
        <p className={cn("mt-2 flex items-center gap-2 text-[12.5px]", state.text)}>
          <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", state.dot)} />
          {state.label}
        </p>
        {aside ? <div className="mt-3 text-[12.5px] leading-snug text-dim">{aside}</div> : null}
      </div>
      <div className="min-w-0 space-y-5">{children}</div>
    </section>
  );
}

function Grid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-x-4 gap-y-5 sm:grid-cols-2", className)}>{children}</div>;
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-hair px-3.5 py-1.5 text-[13px] font-medium text-bone/85 transition-colors duration-150 hover:border-hair-strong hover:text-bone"
    >
      + {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Locații
// ---------------------------------------------------------------------------

const LOCATION_TYPES = [
  ["country", "Țară"],
  ["region", "Regiune / județ"],
  ["city", "Oraș, cu rază"],
] as const;

function LocationsEditor({ platform }: { platform: Platform }) {
  const { draft, update, errors, warnings } = usePlanForm();
  const items = asArray(getIn(draft, "audience.locations"));

  /** Schimbarea tipului reface obiectul — o țară nu are rază, un oraș nu are cod. */
  const changeType = (index: number, type: string) => {
    const current = asRecord(items[index]) ?? {};
    const country = asString(current.country) ?? asString(current.code) ?? "RO";
    const name = asString(current.name) ?? "";
    const next =
      type === "country"
        ? { type, code: country }
        : type === "region"
          ? { type, name, country }
          : { type, name, country, ...(platform === "meta" ? { radius_km: 25 } : {}) };
    update(`audience.locations.${index}`, next);
  };

  return (
    <div>
      <p className={LABEL}>Locații</p>
      <PathMessages path="audience.locations" />
      <ol className="mt-3 space-y-3">
        {items.map((item, index) => {
          const record = asRecord(item) ?? {};
          const type = record.type;
          const base = `audience.locations.${index}`;
          const typeId = fieldId(`${base}.type`);
          return (
            <li key={index} className="rounded-panel border border-hair bg-ink/40 p-4">
              <fieldset>
                <legend className="font-md-mono text-[11px] uppercase tracking-[0.18em] text-dim">
                  Locația {index + 1}
                </legend>
                <div className="mt-3 grid gap-x-3 gap-y-4 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
                  <div>
                    <label htmlFor={typeId} className={LABEL}>
                      Tip
                    </label>
                    <select
                      id={typeId}
                      value={typeof type === "string" ? type : ""}
                      onChange={(event) => changeType(index, event.target.value)}
                      aria-describedby={`${typeId}-msg`}
                      className={cn(FIELD, "mt-1.5 h-11")}
                    >
                      {typeof type !== "string" || !["country", "region", "city"].includes(type) ? (
                        <option value="">— alege —</option>
                      ) : null}
                      {LOCATION_TYPES.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <FieldMessages
                      id={`${typeId}-msg`}
                      errors={errors.get(`${base}.type`) ?? []}
                      warnings={[]}
                    />
                  </div>

                  {type === "country" ? (
                    <TextField path={`${base}.code`} label="Cod țară" placeholder="RO" mono />
                  ) : type === "region" || type === "city" ? (
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_5rem] lg:grid-cols-[minmax(0,1fr)_5rem_6.5rem]">
                      <TextField
                        path={`${base}.name`}
                        label={type === "city" ? "Oraș" : "Regiune"}
                        placeholder={type === "city" ? "Cluj-Napoca" : "Cluj"}
                      />
                      <TextField path={`${base}.country`} label="Țară" placeholder="RO" mono />
                      {type === "city" && platform === "meta" ? (
                        <NumberField path={`${base}.radius_km`} label="Rază" suffix="km" />
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <PathMessages path={base} />
                {type === "city" && platform === "tiktok" ? (
                  <FieldMessages
                    id={`${fieldId(`${base}.radius_km`)}-msg`}
                    errors={[]}
                    warnings={warnings.get(`${base}.radius_km`) ?? []}
                  />
                ) : null}
                <RemoveButton
                  label={`Scoate locația ${index + 1}`}
                  onClick={() => update(base, undefined)}
                />
              </fieldset>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <AddButton onClick={() => update(`audience.locations.${items.length}`, { type: "country", code: "RO" })}>
          țară
        </AddButton>
        <AddButton
          onClick={() =>
            update(`audience.locations.${items.length}`, {
              type: "city",
              name: "",
              country: "RO",
              ...(platform === "meta" ? { radius_km: 25 } : {}),
            })
          }
        >
          oraș
        </AddButton>
        <AddButton
          onClick={() => update(`audience.locations.${items.length}`, { type: "region", name: "", country: "RO" })}
        >
          regiune
        </AddButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interese, comportamente, limbi
// ---------------------------------------------------------------------------

function NamedListEditor({
  path,
  label,
  itemLabel,
  addLabel,
  emptyText,
}: {
  path: string;
  label: string;
  itemLabel: string;
  addLabel: string;
  emptyText: string;
}) {
  const { draft, update } = usePlanForm();
  const items = asArray(getIn(draft, path));

  return (
    <div>
      <p className={LABEL}>{label}</p>
      <PathMessages path={path} />
      {items.length === 0 ? <p className="mt-2 text-[13.5px] text-dim">{emptyText}</p> : null}
      <ol className="mt-2 space-y-3">
        {items.map((_, index) => (
          <li key={index} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <TextField path={`${path}.${index}.name`} label={`${itemLabel} ${index + 1}`} />
            <div>
              <TextField path={`${path}.${index}.id`} label="Id (opțional)" mono />
              <RemoveButton
                label={`Scoate ${itemLabel.toLowerCase()} ${index + 1}`}
                onClick={() => update(`${path}.${index}`, undefined)}
              />
            </div>
            <PathMessages path={`${path}.${index}`} />
          </li>
        ))}
      </ol>
      <div className="mt-3">
        <AddButton onClick={() => update(`${path}.${items.length}`, { name: "" })}>{addLabel}</AddButton>
      </div>
    </div>
  );
}

/** Coduri separate prin virgulă: „ro, hu". Textul are starea lui, ca virgula să nu dispară sub cursor. */
function LanguagesField() {
  const { draft, update, errors } = usePlanForm();
  const value = getIn(draft, "audience.languages");
  const joined = asArray(value).map(String).join(", ");
  const [local, setLocal] = useState(joined);
  const [seen, setSeen] = useState(joined);
  if (joined !== seen) {
    setSeen(joined);
    const localCodes = local.split(/[\s,]+/).filter(Boolean).join(", ");
    if (localCodes !== joined) setLocal(joined);
  }

  const id = fieldId("audience.languages");
  const problems = [...errors.entries()]
    .filter(([path]) => path === "audience.languages" || path.startsWith("audience.languages."))
    .flatMap(([, list]) => list);

  return (
    <div className="min-w-0">
      <label htmlFor={id} className={LABEL}>
        Limbi
      </label>
      <input
        id={id}
        type="text"
        value={local}
        placeholder="ro, hu — gol = orice limbă"
        spellCheck={false}
        aria-describedby={`${id}-msg`}
        aria-invalid={problems.length > 0 || undefined}
        onChange={(event) => {
          setLocal(event.target.value);
          const codes = event.target.value.split(/[\s,]+/).filter(Boolean);
          update("audience.languages", codes.length > 0 ? codes : undefined);
        }}
        className={cn(FIELD, "mt-1.5 h-11 font-md-mono text-[13.5px]")}
      />
      <FieldMessages id={`${id}-msg`} errors={problems} warnings={[]} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alegeri cu butoane radio
// ---------------------------------------------------------------------------

function RadioRow({
  name,
  legend,
  options,
  value,
  onChange,
  describedBy,
}: {
  name: string;
  legend: string;
  options: ReadonlyArray<readonly [string, string]>;
  value: string;
  onChange: (value: string) => void;
  describedBy?: string;
}) {
  return (
    <fieldset aria-describedby={describedBy}>
      <legend className={LABEL}>{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map(([option, label]) => (
          <label
            key={option}
            className={cn(
              "flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-[13.5px] transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-bone",
              value === option ? "border-bone bg-bone text-ink" : "border-hair text-bone/80 hover:border-hair-strong"
            )}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CheckboxGrid({
  legend,
  options,
  selected,
  onToggle,
  describedBy,
}: {
  legend: string;
  options: ReadonlyArray<readonly [string, string]>;
  selected: string[];
  onToggle: (value: string, on: boolean) => void;
  describedBy?: string;
}) {
  return (
    <fieldset aria-describedby={describedBy}>
      <legend className={LABEL}>{legend}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map(([value, label]) => {
          const on = selected.includes(value);
          return (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-3 rounded-panel-sm border border-hair px-3 py-2.5 text-[13.5px] text-bone/85 hover:border-hair-strong"
            >
              <input
                type="checkbox"
                checked={on}
                onChange={(event) => onToggle(value, event.target.checked)}
                className="h-4 w-4 accent-[#edeef2]"
              />
              {label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Formularul
// ---------------------------------------------------------------------------

export function PlanForm({
  platform,
  summary,
  workspaces,
  currentWorkspace,
  onSwitchWorkspace,
}: {
  platform: Platform;
  summary: PlanSummary;
  workspaces: WorkspaceSummary[];
  currentWorkspace: WorkspaceSummary;
  onSwitchWorkspace: (id: string) => void;
}) {
  const { draft, update } = usePlanForm();
  const planWorkspace = workspaces.find((workspace) => workspace.id === draft.workspace) ?? null;
  const mismatch = planWorkspace !== null && planWorkspace.id !== currentWorkspace.id;

  const objective = getIn(draft, "campaign.objective");
  const needsConversion =
    typeof objective === "string" && OBJECTIVES_WITH_CONVERSION.includes(objective as Objective);
  const hasConversion = draft.conversion !== undefined;

  const videoSource = getIn(draft, "creative.video.source");
  const thumbnail = getIn(draft, "creative.thumbnail");
  const placements = getIn(draft, "meta.placements");
  const categories = asArray(getIn(draft, "meta.special_ad_categories")).map(String);

  const eventOptions = (Object.keys(CONVERSION_EVENT_LABEL) as Array<keyof typeof CONVERSION_EVENT_LABEL>)
    .filter((event) => CONVERSION_EVENT_NAME[event][platform] !== null)
    .map((event) => [event, `${CONVERSION_EVENT_LABEL[event]} · ${CONVERSION_EVENT_NAME[event][platform]}`] as const);

  return (
    <div>
      <Section title="Unde" prefixes={["format", "workspace", "ad_account"]}>
        <Grid>
          <SelectField
            path="workspace"
            label="Spațiul de lucru"
            options={workspaces.map((workspace) => [workspace.id, workspace.name] as const)}
          />
          <TextField
            path="ad_account"
            label={platform === "meta" ? "Contul de reclame" : "Advertiser id"}
            placeholder={platform === "meta" ? "act_…" : "cifre"}
            mono
            hint="Se verifică la creare: trebuie să fie un cont la care are acces tokenul spațiului."
          />
        </Grid>
        {mismatch && planWorkspace ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSwitchWorkspace(planWorkspace.id)}
              className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13px]"
            >
              Treci în {planWorkspace.name}
            </button>
            <button
              type="button"
              onClick={() => update("workspace", currentWorkspace.id)}
              className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13px]"
            >
              Scrie {currentWorkspace.name} în plan
            </button>
          </div>
        ) : null}
        <PathMessages path="format" />
      </Section>

      <Section
        title="Campania"
        prefixes={["campaign"]}
        aside={summary.monthly ? `${summary.monthly}, dacă rulează toată luna.` : null}
      >
        <PathMessages path="campaign" />
        <TextField path="campaign.name" label="Nume în Ads Manager" />
        <Grid className="sm:grid-cols-[minmax(0,1fr)_minmax(0,9rem)_minmax(0,7rem)]">
          <SelectField path="campaign.objective" label="Obiectiv" options={entries(OBJECTIVES, OBJECTIVE_LABEL)} />
          <NumberField path="campaign.daily_budget" label="Buget pe zi" />
          <SelectField
            path="campaign.currency"
            label="Moneda"
            options={CURRENCIES.map((currency) => [currency, currency] as const)}
          />
        </Grid>
      </Section>

      <Section title="Publicul" prefixes={["audience"]}>
        <PathMessages path="audience" />
        <LocationsEditor platform={platform} />
        <Grid className="sm:grid-cols-3">
          <NumberField path="audience.age_min" label="Vârsta de la" hint="Implicit 18" />
          <NumberField path="audience.age_max" label="până la" hint="65 = 65 și peste" />
          <SelectField
            path="audience.gender"
            label="Gen"
            options={entries(["all", "male", "female"] as const, GENDER_LABEL)}
            placeholder="toate genurile (implicit)"
          />
        </Grid>
        <LanguagesField />
        <NamedListEditor
          path="audience.interests"
          label="Interese"
          itemLabel="Interesul"
          addLabel="interes"
          emptyText="Fără interese: publicul e doar locație, vârstă și limbă."
        />
        <NamedListEditor
          path="audience.behaviors"
          label="Comportamente"
          itemLabel="Comportamentul"
          addLabel="comportament"
          emptyText="Fără comportamente."
        />
        <p className="text-[12.5px] leading-snug text-dim">
          Interesele, comportamentele, orașele și limbile fără id se caută după nume la creare, iar
          portalul îți arată ce a găsit înainte să trimită ceva.
        </p>
      </Section>

      {needsConversion || hasConversion ? (
        <Section title="Conversia" prefixes={["conversion"]}>
          <PathMessages path="conversion" />
          <Grid>
            <TextField path="conversion.pixel_id" label="Pixel" mono placeholder="id din Events Manager" />
            <SelectField path="conversion.event" label="Eveniment" options={eventOptions} />
          </Grid>
          {!needsConversion ? (
            <button
              type="button"
              onClick={() => update("conversion", undefined)}
              className="text-[13px] text-dim underline underline-offset-4 hover:text-bone"
            >
              Scoate secțiunea — obiectivul nu o folosește
            </button>
          ) : null}
        </Section>
      ) : null}

      <Section title="Destinația" prefixes={["destination"]}>
        <PathMessages path="destination" />
        <PathMessages path="destination.type" />
        <TextField path="destination.url" label="Pagina" placeholder="https://www.meridianx.ro/video" mono />
        <div className="grid gap-x-3 gap-y-4 sm:grid-cols-3">
          {UTM_KEYS.map((key) => (
            <TextField key={key} path={`destination.utm.${key}`} label={`utm_${key}`} mono />
          ))}
        </div>
        <div>
          <p className={LABEL}>Unde ajunge omul după clic</p>
          <p className="mt-1.5 break-all rounded-panel-sm border border-hair bg-ink/60 px-3.5 py-2.5 font-md-mono text-[12.5px] leading-relaxed text-bone/85">
            {summary.finalUrl ?? "—"}
          </p>
        </div>
      </Section>

      <Section title="Materialul" prefixes={["creative"]}>
        <PathMessages path="creative" />
        <RadioRow
          name="video-source"
          legend="Video"
          value={typeof videoSource === "string" ? videoSource : ""}
          describedBy={`${fieldId("creative.video")}-msg`}
          options={[
            ["library", "Deja urcat în cont"],
            ["upload", "Fișier nou"],
          ]}
          onChange={(value) =>
            update("creative.video", value === "library" ? { source: "library", video_id: "" } : { source: "upload" })
          }
        />
        <PathMessages path="creative.video" />
        <PathMessages path="creative.video.source" />
        {videoSource === "library" ? (
          <TextField
            path="creative.video.video_id"
            label="Id video"
            mono
            hint="Din biblioteca de media a contului de reclame. Alegerea din listă vine odată cu conectarea platformei."
          />
        ) : videoSource === "upload" ? (
          <TextField
            path="creative.video.file_name"
            label="Numele fișierului (opțional)"
            mono
            hint="Fișierul îl alegi aici, după verificare. Merge direct din browser la platformă — încărcarea vine în faza 3."
          />
        ) : null}

        <RadioRow
          name="thumbnail"
          legend="Copertă"
          value={thumbnail === undefined || thumbnail === "auto" ? "auto" : "url"}
          options={[
            ["auto", "Propusă de platformă"],
            ["url", "Imagine de la o adresă"],
          ]}
          onChange={(value) => update("creative.thumbnail", value === "auto" ? "auto" : { url: "" })}
        />
        <PathMessages path="creative.thumbnail" />
        {asRecord(thumbnail) ? (
          <TextField path="creative.thumbnail.url" label="Adresa imaginii" mono placeholder="https://…" />
        ) : null}

        <TextListField
          path="creative.primary_texts"
          label="Texte principale"
          itemLabel={(index) => `Textul ${index + 1}`}
          max={MAX_TEXT_VARIANTS}
          multiline
          counter={
            platform === "tiktok"
              ? { limit: TIKTOK_AD_TEXT_MAX, hard: true }
              : { limit: META_PRIMARY_TEXT_VISIBLE }
          }
          addLabel="text"
        />
        {platform === "meta" ? (
          <>
            <TextListField
              path="creative.headlines"
              label="Titluri"
              itemLabel={(index) => `Titlul ${index + 1}`}
              max={MAX_TEXT_VARIANTS}
              counter={{ limit: META_HEADLINE_VISIBLE }}
              addLabel="titlu"
              emptyText="Fără titlu."
            />
            <TextListField
              path="creative.descriptions"
              label="Descrieri"
              itemLabel={(index) => `Descrierea ${index + 1}`}
              max={MAX_TEXT_VARIANTS}
              addLabel="descriere"
              emptyText="Fără descriere."
            />
          </>
        ) : (
          <>
            <PathMessages path="creative.headlines" />
          </>
        )}
        <Grid>
          <SelectField
            path="creative.cta"
            label="Butonul"
            options={(Object.keys(CTA_LABEL) as Array<keyof typeof CTA_LABEL>).map(
              (cta) => [cta, `${CTA_LABEL[cta]} · ${cta}`] as const
            )}
            hint="Textul exact îl pune platforma, în limba celui care vede reclama."
          />
          <SelectField
            path="creative.variants"
            label="Variantele"
            options={entries(VARIANT_MODES, VARIANT_MODE_LABEL)}
            placeholder={`${VARIANT_MODE_LABEL.one_ad_per_text} (implicit)`}
          />
        </Grid>
      </Section>

      {platform === "meta" ? (
        <Section title="Meta" prefixes={["meta"]}>
          <PathMessages path="meta" />
          <Grid>
            <TextField path="meta.page_id" label="Pagina de Facebook" mono placeholder="id pagină" />
            <TextField path="meta.instagram_account_id" label="Instagram (opțional)" mono placeholder="id cont" />
          </Grid>
          <CheckboxGrid
            legend="Categorie specială"
            options={entries(META_SPECIAL_CATEGORIES, META_SPECIAL_CATEGORY_LABEL)}
            selected={categories}
            describedBy={`${fieldId("meta.special_ad_categories")}-msg`}
            onToggle={(value, on) => {
              const next = on ? [...categories, value] : categories.filter((item) => item !== value);
              update("meta.special_ad_categories", next.length > 0 ? next : undefined);
            }}
          />
          <PathMessages path="meta.special_ad_categories" />
          <div className="divide-y divide-hair rounded-panel border border-hair px-4">
            <ToggleField
              path="meta.advantage_audience"
              title="Advantage+ audience"
              body="Pornit, Meta tratează vârsta și interesele ca sugestii."
              dangerWhenOn
            />
          </div>
          <RadioRow
            name="meta-placements"
            legend="Plasări"
            value={Array.isArray(placements) ? "manual" : "automatic"}
            options={[
              ["automatic", "Automate (Advantage+ placements)"],
              ["manual", "Alese de mine"],
            ]}
            onChange={(value) =>
              update("meta.placements", value === "automatic" ? undefined : ["instagram_reels", "facebook_reels"])
            }
          />
          {Array.isArray(placements) ? (
            <CheckboxGrid
              legend="Unde apare"
              options={entries(META_PLACEMENTS, META_PLACEMENT_LABEL)}
              selected={placements.map(String)}
              onToggle={(value, on) => {
                const current = placements.map(String);
                update(
                  "meta.placements",
                  on ? [...current, value] : current.filter((item) => item !== value)
                );
              }}
            />
          ) : null}
          <PathMessages path="meta.placements" />
        </Section>
      ) : (
        <Section title="TikTok" prefixes={["tiktok"]}>
          <PathMessages path="tiktok" />
          <Grid>
            <SelectField
              path="tiktok.identity_type"
              label="Identitatea de pe reclamă"
              options={entries(TIKTOK_IDENTITY_TYPES, TIKTOK_IDENTITY_LABEL)}
            />
            <TextField path="tiktok.identity_id" label="Id identitate" mono />
          </Grid>
          <SelectField
            path="tiktok.placements"
            label="Plasări"
            options={entries(TIKTOK_PLACEMENTS, TIKTOK_PLACEMENT_LABEL)}
            placeholder={`${TIKTOK_PLACEMENT_LABEL.tiktok_only} (implicit)`}
          />
        </Section>
      )}

      <Section
        title="Îmbunătățiri automate"
        prefixes={[`${platform}.enhancements`]}
        aside="Toate oprite implicit. Un testimonial filmat nu se lasă rescris de platformă."
      >
        <div className="divide-y divide-hair rounded-panel border border-hair px-4">
          {platform === "meta"
            ? META_ENHANCEMENTS.map((key) => (
                <ToggleField
                  key={key}
                  path={`meta.enhancements.${key}`}
                  title={META_ENHANCEMENT_LABEL[key].title}
                  body={META_ENHANCEMENT_LABEL[key].body}
                  dangerWhenOn
                />
              ))
            : TIKTOK_ENHANCEMENTS.map((key) => (
                <ToggleField
                  key={key}
                  path={`tiktok.enhancements.${key}`}
                  title={TIKTOK_ENHANCEMENT_LABEL[key].title}
                  body={TIKTOK_ENHANCEMENT_LABEL[key].body}
                  dangerWhenOn
                />
              ))}
        </div>
      </Section>
    </div>
  );
}
