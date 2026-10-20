import type { EntitySnapshot, NormalizedStatus } from "./types";

/**
 * O reclamă nu poate livra dacă grupul sau campania ei sunt oprite, iar
 * platformele nu spun asta la fel: Meta dă `CAMPAIGN_PAUSED` pe reclamă,
 * Google lasă grupul `ENABLED` sub o campanie ștearsă. Aici starea copiilor
 * urmează părintele, ca tabelul să nu arate „Activă” sub o campanie pe pauză.
 * Starea brută a platformei rămâne în `statusDetail`.
 */

const STOPS: ReadonlyArray<NormalizedStatus> = ["removed", "archived", "paused", "ended"];

const BECAUSE: Record<"campania" | "grupul", Record<string, string>> = {
  campania: { removed: "ștearsă", archived: "arhivată", paused: "pe pauză", ended: "încheiată" },
  grupul: { removed: "șters", archived: "arhivat", paused: "pe pauză", ended: "încheiat" },
};

function stopOf(status: NormalizedStatus | undefined): NormalizedStatus | null {
  return status && STOPS.includes(status) ? status : null;
}

export function inheritStatus(entities: EntitySnapshot[]): EntitySnapshot[] {
  const campaigns = new Map(entities.filter((entity) => entity.level === "campaign").map((entity) => [entity.platformId, entity.status]));
  const groups = new Map<string, NormalizedStatus>();
  const out: EntitySnapshot[] = [];

  const adjust = (entity: EntitySnapshot, parentStop: NormalizedStatus | null, parent: "campania" | "grupul"): EntitySnapshot => {
    if (!parentStop || STOPS.includes(entity.status)) return entity;
    const status: NormalizedStatus = parentStop === "ended" ? "ended" : parentStop === "removed" || parentStop === "archived" ? parentStop : "paused";
    const note = `${parent} e ${BECAUSE[parent][parentStop]}`;
    return { ...entity, status, statusDetail: entity.statusDetail ? `${entity.statusDetail} · ${note}` : note };
  };

  for (const entity of entities.filter((item) => item.level === "group")) {
    const adjusted = adjust(entity, stopOf(campaigns.get(entity.campaignId)), "campania");
    groups.set(adjusted.platformId, adjusted.status);
    out.push(adjusted);
  }
  for (const entity of entities) {
    if (entity.level === "campaign") out.push(entity);
    if (entity.level !== "ad") continue;
    const campaignStop = stopOf(campaigns.get(entity.campaignId));
    const groupStop = entity.groupId ? stopOf(groups.get(entity.groupId)) : null;
    out.push(campaignStop ? adjust(entity, campaignStop, "campania") : adjust(entity, groupStop, "grupul"));
  }
  return out;
}
