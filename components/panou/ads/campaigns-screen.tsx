"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Megaphone, PauseCircle, Search } from "lucide-react";
import { PLATFORM_LABEL } from "@/lib/ads/constants";
import { formatAmount, formatCount, formatPercent } from "@/lib/ads/metrics";
import { CHANNEL_COLUMNS, budgetText, resultText, rowFigures, searchable, type ChannelColumn, type RowFigures } from "@/lib/ads/model/rows";
import type { Channel, DateRange } from "@/lib/ads/model/selection";
import { STATUS_ORDER, canPause } from "@/lib/ads/model/status";
import type { AccountSummary, EntityRow, Figures, Level } from "@/lib/ads/model/types";
import type { EntityDay } from "@/lib/ads/model/read";
import type { PauseRequestResult } from "@/lib/ads/model/pause";
import { callBreakdown, type CallCount } from "@/lib/ads/model/calls-shared";
import { cn } from "@/lib/utils";
import { Btn, Card, SegmentedControl, Stamp } from "../ui/primitives";
import { EmptyState } from "../ui/states";
import { ChannelMark } from "./channel-mark";
import { EntityPanel } from "./entity-panel";
import { PauseDialog } from "./pause-dialog";
import { StatusPill } from "./status-pill";

type Failure = { ok: false; message: string };

export interface ScreenActions {
  pause: (input: { entityIds: string[] }) => Promise<({ ok: true } & PauseRequestResult) | Failure>;
  days: (input: { entityIds: string[]; from: string; to: string }) => Promise<{ ok: true; days: EntityDay[] } | Failure>;
  setResult: (input: { entityId: string; key: string | null }) => Promise<{ ok: true } | Failure>;
}

const LEVEL_PARAM: Record<Level, string> = { campaign: "campanii", group: "grupuri", ad: "reclame" };
const LEVEL_TAB: Record<Level, string> = { campaign: "Campanii", group: "Grupuri", ad: "Reclame" };
const LEVEL_EMPTY: Record<Level, string> = { campaign: "Nicio campanie", group: "Niciun grup", ad: "Nicio reclamă" };
/** Platformele cu pauza din portal (funcția separată de pauză, cu garda ei). */
const PAUSE_PLATFORMS = new Set(["google", "meta", "tiktok"]);

type SortKey = "name" | "status" | "budget" | "spend" | "results" | "calls" | "cost" | "impressions" | "clicks" | "ctr" | `x:${string}`;
type Sort = { key: SortKey; dir: "asc" | "desc" };

function parseLevel(value: string | null): Level {
  return value === "grupuri" ? "group" : value === "reclame" ? "ad" : "campaign";
}

function parseSort(value: string | null): Sort {
  const [key, dir] = (value ?? "").split(".");
  const known = ["name", "status", "budget", "spend", "results", "calls", "cost", "impressions", "clicks", "ctr"];
  if ((known.includes(key) || key?.startsWith("x:")) && (dir === "asc" || dir === "desc")) return { key: key as SortKey, dir };
  return { key: "spend", dir: "desc" };
}

function idList(value: string | null): Set<string> {
  return new Set((value ?? "").split(",").filter((id) => /^[0-9a-f-]{36}$/i.test(id)));
}

function columnValue(column: ChannelColumn, figures: RowFigures, currency: string | null): string {
  const value = column.value(figures);
  if (value === null) return "—";
  if (column.kind === "money") return formatAmount(value, currency ?? "");
  if (column.kind === "percent") return formatPercent(value);
  return formatCount(value);
}

/** Celulele lipite la stânga (bifa și numele) au fundal plin, ca textul să nu treacă pe sub ele la derulare. */
function stickyBackground(isOpen: boolean, checked: boolean): string {
  return isOpen ? "bg-[#1b1830]" : checked ? "bg-[#17171c]" : "bg-card group-hover:bg-[#101015]";
}

/**
 * Campanii / Grupuri / Reclame într-un tabel (prototip: lista de campanii),
 * pe clientul, perioada și canalul alese sus. Starea ecranului stă în adresă:
 * fila, bifele, căutarea, sortarea, rândul deschis. Bifezi o campanie, treci la
 * Grupuri și vezi doar grupurile ei. Rândul deschis apare într-un panou lateral
 * (`EntityPanel`); „Pune pe pauză” e singura acțiune care ajunge la o platformă.
 */
export function CampaignsScreen({
  entities,
  totals,
  previous,
  accounts,
  channel,
  range,
  actions,
  calls,
  callsHref,
}: {
  entities: EntityRow[];
  totals: Record<string, Figures>;
  previous: Record<string, Figures>;
  accounts: AccountSummary[];
  channel: Channel;
  range: DateRange;
  actions: ScreenActions;
  /** „Apeluri notate” pe campanie, în perioadă (din pagina Apeluri). */
  calls: Record<string, CallCount>;
  callsHref: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [level, setLevel] = useState<Level>(() => parseLevel(params.get("nivel")));
  const [campaigns, setCampaigns] = useState<Set<string>>(() => idList(params.get("campanii")));
  const [groups, setGroups] = useState<Set<string>>(() => idList(params.get("grupuri")));
  const [ads, setAds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState(() => params.get("cauta") ?? "");
  const [sort, setSort] = useState<Sort>(() => parseSort(params.get("ord")));
  const [showRemoved, setShowRemoved] = useState(false);
  const [open, setOpen] = useState<string | null>(() => params.get("rand"));
  const [pauseIds, setPauseIds] = useState<string[] | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  // Adresa schimbată din afară (meniul „Campanii”, înapoi în browser): ecranul o
  // urmează. Schimbările făcute de ecranul însuși dau aceeași stare, deci nimic nu se repetă.
  const search = params.toString();
  useEffect(() => {
    const current = new URLSearchParams(search);
    const nextLevel = parseLevel(current.get("nivel"));
    const nextCampaigns = idList(current.get("campanii"));
    const nextGroups = idList(current.get("grupuri"));
    const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((id) => b.has(id));
    setLevel((value) => (value === nextLevel ? value : nextLevel));
    setCampaigns((value) => (same(value, nextCampaigns) ? value : nextCampaigns));
    setGroups((value) => (same(value, nextGroups) ? value : nextGroups));
    setOpen((value) => (value === current.get("rand") ? value : current.get("rand")));
  }, [search]);

  // Starea ecranului stă în adresă (fără o nouă cerere spre server): un link
  // trimis cuiva deschide aceeași filă, aceleași bife, același rând.
  useEffect(() => {
    const next = new URLSearchParams(window.location.search);
    const set = (key: string, value: string | null) => (value ? next.set(key, value) : next.delete(key));
    set("nivel", level === "campaign" ? null : LEVEL_PARAM[level]);
    set("campanii", campaigns.size ? [...campaigns].join(",") : null);
    set("grupuri", groups.size ? [...groups].join(",") : null);
    set("cauta", query.trim() || null);
    set("ord", sort.key === "spend" && sort.dir === "desc" ? null : `${sort.key}.${sort.dir}`);
    set("rand", open);
    const search = next.toString();
    if (search !== window.location.search.replace(/^\?/, "")) window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
  }, [level, campaigns, groups, query, sort, open]);

  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const figures = useMemo(() => {
    const map = new Map<string, RowFigures>();
    for (const entity of entities) map.set(entity.id, rowFigures(entity, totals[entity.id], accountById.get(entity.accountId)?.conversions ?? []));
    return map;
  }, [entities, totals, accountById]);
  const previousFigures = useMemo(() => {
    const map = new Map<string, RowFigures>();
    for (const entity of entities) map.set(entity.id, rowFigures(entity, previous[entity.id], accountById.get(entity.accountId)?.conversions ?? []));
    return map;
  }, [entities, previous, accountById]);

  const campaignOf = useMemo(() => {
    const map = new Map<string, EntityRow>();
    for (const entity of entities) if (entity.level === "campaign") map.set(`${entity.accountId}|${entity.platformId}`, entity);
    return map;
  }, [entities]);
  const groupOf = useMemo(() => {
    const map = new Map<string, EntityRow>();
    for (const entity of entities) if (entity.level === "group") map.set(`${entity.accountId}|${entity.platformId}`, entity);
    return map;
  }, [entities]);
  const parentCampaign = useCallback((entity: EntityRow) => campaignOf.get(`${entity.accountId}|${entity.campaignId}`) ?? null, [campaignOf]);
  const parentGroup = useCallback((entity: EntityRow) => (entity.groupId ? (groupOf.get(`${entity.accountId}|${entity.groupId}`) ?? null) : null), [groupOf]);

  const counts = useMemo(() => {
    const visible = (entity: EntityRow) => entity.status !== "removed" || (figures.get(entity.id)?.spend ?? 0) > 0;
    const inCampaigns = (entity: EntityRow) => campaigns.size === 0 || campaigns.has(parentCampaign(entity)?.id ?? "");
    const inGroups = (entity: EntityRow) => groups.size === 0 || groups.has(parentGroup(entity)?.id ?? "");
    return {
      campaign: entities.filter((entity) => entity.level === "campaign" && visible(entity)).length,
      group: entities.filter((entity) => entity.level === "group" && visible(entity) && inCampaigns(entity)).length,
      ad: entities.filter((entity) => entity.level === "ad" && visible(entity) && inCampaigns(entity) && inGroups(entity)).length,
    };
  }, [entities, figures, campaigns, groups, parentCampaign, parentGroup]);

  const removedHere = useMemo(
    () => entities.filter((entity) => entity.level === level && entity.status === "removed" && (figures.get(entity.id)?.spend ?? 0) === 0).length,
    [entities, level, figures]
  );

  const columns = useMemo(() => (channel === "toate" ? [] : CHANNEL_COLUMNS[channel]), [channel]);

  const rows = useMemo(() => {
    const needle = searchable(query.trim());
    const list = entities.filter((entity) => {
      if (entity.level !== level) return false;
      if (!showRemoved && entity.status === "removed" && (figures.get(entity.id)?.spend ?? 0) === 0) return false;
      if (level !== "campaign" && campaigns.size > 0 && !campaigns.has(parentCampaign(entity)?.id ?? "")) return false;
      if (level === "ad" && groups.size > 0 && !groups.has(parentGroup(entity)?.id ?? "")) return false;
      if (needle && !searchable(entity.name).includes(needle)) return false;
      return true;
    });
    const value = (entity: EntityRow): number | string => {
      const f = figures.get(entity.id)!;
      switch (sort.key) {
        case "name":
          return searchable(entity.name);
        case "status":
          return STATUS_ORDER[entity.status];
        case "budget":
          return entity.dailyBudget ?? entity.lifetimeBudget ?? -1;
        case "results":
          return f.results ?? -1;
        case "calls":
          return calls[entity.id]?.total ?? 0;
        case "cost":
          return f.costPerResult ?? Number.POSITIVE_INFINITY;
        case "impressions":
          return f.impressions;
        case "clicks":
          return f.clicks;
        case "ctr":
          return f.ctr ?? -1;
        case "spend":
          return f.spend;
        default: {
          const column = columns.find((item) => `x:${item.key}` === sort.key);
          return column ? (column.value(f) ?? -1) : 0;
        }
      }
    };
    return list.sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const order = typeof x === "string" ? x.localeCompare(String(y), "ro") : x - (y as number);
      return (sort.dir === "asc" ? order : -order) || a.name.localeCompare(b.name, "ro");
    });
  }, [entities, level, showRemoved, figures, campaigns, groups, query, sort, parentCampaign, parentGroup, columns, calls]);

  // Apelurile se notează pe campanie: coloana stă doar pe fila Campanii.
  const showCalls = level === "campaign";
  const callsTotal = showCalls ? rows.reduce((sum, entity) => sum + (calls[entity.id]?.total ?? 0), 0) : 0;

  const selected = level === "campaign" ? campaigns : level === "group" ? groups : ads;
  const setSelected = level === "campaign" ? setCampaigns : level === "group" ? setGroups : setAds;
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = rows.length > 0 && rows.every((entity) => selected.has(entity.id));
  const selectedRows = rows.filter((entity) => selected.has(entity.id));
  const pausable = selectedRows.filter((entity) => canPause(entity.status) && PAUSE_PLATFORMS.has(entity.platform));

  const openRow = (entity: EntityRow, from: HTMLElement | null) => {
    opener.current = from;
    setOpen(entity.id);
  };
  const closePanel = () => {
    setOpen(null);
    opener.current?.focus();
  };
  const openEntity = open ? (entities.find((entity) => entity.id === open) ?? null) : null;

  const sortButton = (key: SortKey, label: string, hint?: string, align: "left" | "right" = "right", extra?: string) => {
    const active = sort.key === key;
    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("whitespace-nowrap px-3 py-2.5 font-medium", align === "right" ? "text-right" : "text-left", extra)}>
        <button
          type="button"
          title={hint}
          onClick={() => setSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "status" || key === "cost" ? "asc" : "desc" }))}
          className={cn(
            "inline-flex items-center gap-1 rounded text-[10px] font-medium uppercase tracking-[0.14em] transition-colors hover:text-foreground",
            active ? "text-foreground" : "text-muted-foreground",
            align === "right" && "flex-row-reverse"
          )}
        >
          {label}
          {hint ? <span className="sr-only"> ({hint})</span> : null}
          <Icon className={cn("h-3 w-3", !active && "opacity-50")} aria-hidden="true" />
        </button>
      </th>
    );
  };

  // Totalul rândurilor din tabel (ca în Ads Manager), pe monedă.
  const footer = useMemo(() => {
    const currencies = new Set(rows.map((entity) => entity.currency ?? "—"));
    const sum = rows.reduce(
      (acc, entity) => {
        const f = figures.get(entity.id)!;
        return { spend: acc.spend + f.spend, impressions: acc.impressions + f.impressions, clicks: acc.clicks + f.clicks };
      },
      { spend: 0, impressions: 0, clicks: 0 }
    );
    return { currency: currencies.size === 1 ? [...currencies][0] : null, ...sum };
  }, [rows, figures]);

  const parentNote = (entity: EntityRow): string | null => {
    if (entity.level === "group") return parentCampaign(entity)?.name ?? null;
    if (entity.level === "ad") return parentGroup(entity)?.name ?? parentCampaign(entity)?.name ?? null;
    return null;
  };

  const pausedHere = rows.filter((entity) => entity.status === "paused").length;

  const emptyText = query.trim()
    ? `${LEVEL_EMPTY[level]} cu „${query.trim()}” în nume.`
    : level !== "campaign" && campaigns.size > 0
      ? `${LEVEL_EMPTY[level]} în ${campaigns.size === 1 ? "campania bifată" : "campaniile bifate"}.`
      : `${LEVEL_EMPTY[level]} în perioada aleasă.`;

  const cell = "whitespace-nowrap px-3 py-3 text-right align-top pu-num text-[12.5px] text-foreground/85";

  return (
    <section aria-label="Campanii, grupuri și reclame" className="space-y-3">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl<Level>
              ariaLabel="Nivelul"
              size="sm"
              value={level}
              onChange={setLevel}
              options={(["campaign", "group", "ad"] as const).map((item) => {
                const picked = item === "campaign" ? campaigns.size : item === "group" ? groups.size : ads.size;
                return {
                  value: item,
                  label: (
                    <>
                      {LEVEL_TAB[item]} <span className="pu-num text-muted-foreground">{counts[item]}</span>
                      {picked > 0 ? <span className="pu-num ml-1.5 text-lav">· {picked} bifate</span> : null}
                    </>
                  ),
                };
              })}
            />
            <h2 className="text-[13.5px] font-medium">
              <span className="sr-only">{LEVEL_TAB[level]}</span>
              <span className="text-muted-foreground">
                {rows.length} {rows.length === 1 ? "rând" : "rânduri"}
                {pausedHere > 0 ? ` · ${pausedHere} pe pauză` : ""}
              </span>
            </h2>
          </div>
          <label className="relative min-w-[11rem] flex-1 sm:max-w-[16rem]">
            <span className="sr-only">Caută după nume</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={`Caută în ${LEVEL_TAB[level].toLowerCase()}`}
              className="h-8 w-full rounded-lg border border-white/[0.12] bg-white/[0.03] pl-8 pr-3 text-[12.5px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-lav/50 focus:bg-white/[0.05]"
            />
          </label>
        </div>

        {(level !== "campaign" && (campaigns.size > 0 || groups.size > 0)) || removedHere > 0 ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/[0.06] px-4 py-2 text-[12px] text-muted-foreground">
            {level !== "campaign" && (campaigns.size > 0 || groups.size > 0) ? (
              <p>
                Doar din {campaigns.size > 0 ? `${campaigns.size === 1 ? "campania bifată" : `${campaigns.size} campanii bifate`}` : ""}
                {campaigns.size > 0 && groups.size > 0 && level === "ad" ? " și " : ""}
                {level === "ad" && groups.size > 0 ? `${groups.size === 1 ? "grupul bifat" : `${groups.size} grupuri bifate`}` : ""} ·{" "}
                <button
                  type="button"
                  onClick={() => {
                    setCampaigns(new Set());
                    setGroups(new Set());
                  }}
                  className="font-medium text-lav underline underline-offset-4"
                >
                  arată tot
                </button>
              </p>
            ) : null}
            {removedHere > 0 ? (
              <label className="ml-auto flex items-center gap-2">
                <input type="checkbox" checked={showRemoved} onChange={(event) => setShowRemoved(event.currentTarget.checked)} className="h-3.5 w-3.5 accent-[#C6B5FF]" />
                Arată și cele șterse ({removedHere})
              </label>
            ) : null}
          </div>
        ) : null}

        {selectedRows.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-lav/20 bg-lav/[0.06] px-4 py-2.5 text-[12.5px]">
            <span className="font-medium">{selectedRows.length === 1 ? "Un rând bifat" : `${selectedRows.length} rânduri bifate`}</span>
            {level !== "ad" ? (
              <button type="button" onClick={() => setLevel(level === "campaign" ? "group" : "ad")} className="font-medium text-lav underline underline-offset-4">
                Vezi {level === "campaign" ? "grupurile lor" : "reclamele lor"}
              </button>
            ) : null}
            <Btn
              size="xs"
              variant="outline"
              icon={PauseCircle}
              disabled={pausable.length === 0}
              onClick={() => setPauseIds(pausable.map((entity) => entity.id))}
              title={pausable.length === 0 ? "Niciun rând bifat nu cheltuie acum, sau platforma lui nu are încă pauza în portal." : undefined}
            >
              Pune pe pauză{pausable.length > 0 ? ` (${pausable.length})` : ""}
            </Btn>
            <button type="button" onClick={() => setSelected(new Set())} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Debifează
            </button>
          </div>
        ) : null}

        {rows.length === 0 ? (
          <EmptyState icon={Megaphone} title={emptyText} text="Schimbă clientul, canalul sau perioada din bara de sus, ori creează primul plan." />
        ) : (
          <>
            {/* Desktop și tabletă: tabelul dens, ca în Ads Manager. */}
            <div className="hidden max-h-[70vh] overflow-auto md:block">
              <table className="w-full border-separate border-spacing-0 text-left">
                <caption className="sr-only">
                  {LEVEL_TAB[level]} — {rows.length} rânduri. Clic pe nume deschide detaliile în dreapta.
                </caption>
                <thead className="sticky top-0 z-[2] bg-card">
                  <tr className="border-b border-white/[0.06]">
                    <th scope="col" className="sticky left-0 z-[3] w-9 border-b border-white/[0.06] bg-card py-2.5 pl-4 pr-1">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((entity) => entity.id)))}
                        aria-label={allSelected ? "Debifează toate rândurile" : "Bifează toate rândurile"}
                        className="h-4 w-4 accent-[#C6B5FF]"
                      />
                    </th>
                    {sortButton("name", "Nume", undefined, "left", "sticky left-9 z-[3] bg-card")}
                    {sortButton("status", "Stare", undefined, "left")}
                    {sortButton("budget", "Buget")}
                    {sortButton("spend", "Cheltuit")}
                    {sortButton("results", "Rezultate", "apel, lead sau formular — ce numără campania")}
                    {showCalls ? sortButton("calls", "Apeluri notate", "notate de mână, în Apeluri") : null}
                    {sortButton("cost", "Cost / rez.", "cost per rezultat")}
                    {sortButton("impressions", "Afișări")}
                    {sortButton("clicks", "Clickuri")}
                    {sortButton("ctr", "CTR", "clickuri la 100 de afișări")}
                    {columns.map((column) => (
                      <Fragment key={column.key}>{sortButton(`x:${column.key}`, column.label, column.hint)}</Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entity) => {
                    const f = figures.get(entity.id)!;
                    const parent = parentNote(entity);
                    const checked = selected.has(entity.id);
                    const isOpen = open === entity.id;
                    return (
                      <tr
                        key={entity.id}
                        onClick={(event) => {
                          if ((event.target as HTMLElement).closest("input, button, a")) return;
                          openRow(entity, event.currentTarget.querySelector("button[data-open]"));
                        }}
                        className={cn("group cursor-pointer transition-colors hover:bg-white/[0.03]", isOpen && "bg-lav/[0.07]", checked && !isOpen && "bg-white/[0.035]")}
                      >
                        <td className={cn("sticky left-0 z-[1] border-b border-white/[0.04] py-3 pl-4 pr-1 align-top", stickyBackground(isOpen, checked))}>
                          <input type="checkbox" checked={checked} onChange={() => toggle(entity.id)} aria-label={`Bifează ${entity.name}`} className="mt-0.5 h-4 w-4 accent-[#C6B5FF]" />
                        </td>
                        <td className={cn("sticky left-9 z-[1] max-w-[22rem] border-b border-white/[0.04] px-3 py-3 align-top", stickyBackground(isOpen, checked))}>
                          <div className="flex min-w-0 items-start gap-2.5">
                            <ChannelMark platform={entity.platform} size="sm" label={false} className="mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <button
                                data-open
                                type="button"
                                onClick={(event) => openRow(entity, event.currentTarget)}
                                className="block max-w-full truncate text-left text-[13px] font-medium transition-colors group-hover:text-lav"
                              >
                                <span className="sr-only">{PLATFORM_LABEL[entity.platform]}: </span>
                                {entity.name}
                              </button>
                              {parent ? <p className="truncate text-[11.5px] text-muted-foreground">în {parent}</p> : null}
                              {entity.portalCampaignId ? <Stamp className="mt-1">Creată pe pauză</Stamp> : null}
                            </div>
                          </div>
                        </td>
                        <td className="border-b border-white/[0.04] px-3 py-3 align-top">
                          <StatusPill status={entity.status} detail={entity.statusDetail} />
                        </td>
                        <td className={cn(cell, "border-b border-white/[0.04]")}>{budgetText(entity, Boolean(parentCampaign(entity)?.dailyBudget || parentCampaign(entity)?.lifetimeBudget))}</td>
                        <td className={cn(cell, "border-b border-white/[0.04] font-medium text-foreground")}>{formatAmount(f.spend, entity.currency ?? "")}</td>
                        <td className={cn(cell, "border-b border-white/[0.04]", f.results === null ? "text-muted-foreground" : "text-foreground")}>{resultText(f)}</td>
                        {showCalls ? (
                          <td className={cn(cell, "border-b border-white/[0.04]")}>
                            {calls[entity.id]?.total ? (
                              <span title={callBreakdown(calls[entity.id])} className="text-foreground">
                                {calls[entity.id].total}
                                <span className="sr-only"> ({callBreakdown(calls[entity.id])})</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        ) : null}
                        <td className={cn(cell, "border-b border-white/[0.04]")}>{f.costPerResult === null ? "—" : formatAmount(f.costPerResult, entity.currency ?? "")}</td>
                        <td className={cn(cell, "border-b border-white/[0.04]")}>{formatCount(f.impressions)}</td>
                        <td className={cn(cell, "border-b border-white/[0.04]")}>{formatCount(f.clicks)}</td>
                        <td className={cn(cell, "border-b border-white/[0.04]")}>{formatPercent(f.ctr)}</td>
                        {columns.map((column) => (
                          <td key={column.key} className={cn(cell, "border-b border-white/[0.04]")}>
                            {columnValue(column, f, entity.currency)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-white/[0.02] text-[12.5px]">
                    <td className="sticky left-0 z-[1] bg-[#0f0f13] py-3 pl-4 pr-1" />
                    <th scope="row" className="sticky left-9 z-[1] bg-[#0f0f13] px-3 py-3 text-left text-[12px] font-medium">
                      Total · {rows.length} {rows.length === 1 ? "rând" : "rânduri"}
                    </th>
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3" />
                    <td className="whitespace-nowrap px-3 py-3 text-right pu-num font-medium">{footer.currency ? formatAmount(footer.spend, footer.currency) : "monede diferite"}</td>
                    <td className="px-3 py-3" />
                    {showCalls ? (
                      <td className="whitespace-nowrap px-3 py-3 text-right pu-num text-foreground/85">
                        <Link href={callsHref} className="hover:text-lav hover:underline">
                          {callsTotal}
                          <span className="sr-only"> apeluri notate — deschide Apeluri</span>
                        </Link>
                      </td>
                    ) : null}
                    <td className="px-3 py-3" />
                    <td className="whitespace-nowrap px-3 py-3 text-right pu-num text-foreground/85">{formatCount(footer.impressions)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right pu-num text-foreground/85">{formatCount(footer.clicks)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right pu-num text-foreground/85">{formatPercent(footer.impressions > 0 ? (footer.clicks / footer.impressions) * 100 : null)}</td>
                    {columns.map((column) => (
                      <td key={column.key} className="px-3 py-3" />
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Telefon: cifrele care contează și pauza, un rând pe card. */}
            <ul className="divide-y divide-white/[0.05] md:hidden">
              {rows.map((entity) => {
                const f = figures.get(entity.id)!;
                const parent = parentNote(entity);
                return (
                  <li key={entity.id} className="px-4 py-3.5">
                    <div className="flex items-start gap-2">
                      <ChannelMark platform={entity.platform} size="sm" label={false} className="mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <button type="button" onClick={(event) => openRow(entity, event.currentTarget)} className="block w-full text-left text-[13px] font-medium leading-snug">
                          <span className="sr-only">{PLATFORM_LABEL[entity.platform]}: </span>
                          {entity.name}
                        </button>
                        {parent ? <p className="truncate text-[11.5px] text-muted-foreground">în {parent}</p> : null}
                      </div>
                      <StatusPill status={entity.status} detail={entity.statusDetail} />
                    </div>
                    <dl className="mt-2.5 grid grid-cols-3 gap-2 text-[12px]">
                      <div>
                        <dt className="text-muted-foreground">Cheltuit</dt>
                        <dd className="pu-num font-medium">{formatAmount(f.spend, entity.currency ?? "")}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Rezultate</dt>
                        <dd className={cn("pu-num", f.results === null ? "text-muted-foreground" : "font-medium")}>{resultText(f)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Cost / rez.</dt>
                        <dd className="pu-num">{f.costPerResult === null ? "—" : formatAmount(f.costPerResult, entity.currency ?? "")}</dd>
                      </div>
                    </dl>
                    {showCalls && calls[entity.id]?.total ? (
                      <p className="mt-1.5 text-[12px] text-foreground/85">
                        <span className="text-muted-foreground">Apeluri notate:</span> {calls[entity.id].total} · {callBreakdown(calls[entity.id])}
                      </p>
                    ) : null}
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      {entity.portalCampaignId ? <Stamp>Creată pe pauză</Stamp> : <span />}
                      {canPause(entity.status) && PAUSE_PLATFORMS.has(entity.platform) ? (
                        <Btn size="sm" variant="outline" icon={PauseCircle} onClick={() => setPauseIds([entity.id])}>
                          Pune pe pauză
                        </Btn>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      {openEntity ? (
        <EntityPanel
          key={openEntity.id}
          entity={openEntity}
          figures={figures.get(openEntity.id)!}
          previousFigures={previousFigures.get(openEntity.id)!}
          account={accountById.get(openEntity.accountId) ?? null}
          parents={{ campaign: parentCampaign(openEntity), group: parentGroup(openEntity) }}
          descendants={entities.filter(
            (entity) =>
              entity.accountId === openEntity.accountId &&
              ((openEntity.level === "campaign" && entity.level === "group" && entity.campaignId === openEntity.platformId) ||
                (openEntity.level === "group" && entity.level === "ad" && entity.groupId === openEntity.platformId))
          )}
          childFigures={figures}
          range={range}
          actions={actions}
          canPauseHere={PAUSE_PLATFORMS.has(openEntity.platform)}
          onPause={() => setPauseIds([openEntity.id])}
          onOpen={(entity) => setOpen(entity.id)}
          onClose={closePanel}
        />
      ) : null}

      {pauseIds ? (
        <PauseDialog
          entities={entities.filter((entity) => pauseIds.includes(entity.id))}
          figures={figures}
          pause={actions.pause}
          onDone={(changed) => {
            setPauseIds(null);
            if (changed) {
              setSelected(new Set());
              router.refresh();
            }
          }}
        />
      ) : null}
    </section>
  );
}
