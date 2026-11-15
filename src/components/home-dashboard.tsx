"use client";

import Link from "next/link";
import { useState } from "react";
import type { Campaign, Character } from "@/lib/api-client";
import { characterIdentity, sheetFor } from "@/lib/character-view";
import { translate, type Locale } from "@/lib/i18n";
import { abilities, abilityModifier } from "@/lib/rules";
import { Icon } from "./icons";
import { PageHeader } from "./page-header";
import { cardAction, cardActions, cardTitle, firstRun, glyphWell, note, roleLine, sectionStack, sectionTitle } from "./section-styles";

type Filter = "all" | "camp" | "free";
/** Cards shown before "See all in Characters"; the new-character card fills the next slot. */
const MAX_CARDS = 5;

const signedMod = (score: number) => { const mod = abilityModifier(score); return `${mod >= 0 ? "+" : "−"}${Math.abs(mod)}`; };

/** Who runs a campaign, for the "PLAYER · DM: …" line. */
export function dmName(campaign: Campaign): string {
  return campaign.members.find((member) => member.role === "dm")?.name ?? campaign.ownerName;
}

/** The overview ("Mesa de juego"): shortcuts, the person's characters and the campaigns they sit at. */
export default function HomeDashboard({ locale, characters, campaigns, mapShortcut }: {
  locale: Locale;
  /** The person's own characters. */
  characters: Character[];
  /** Campaigns the person is a member of. */
  campaigns: Campaign[];
  /** Where the "Battle map" shortcut goes, and the campaign it opens (none: the picker). */
  mapShortcut: { href: string; campaignName?: string };
}) {
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, key, values);
  const [filter, setFilter] = useState<Filter>("all");
  const upper = (text: string) => text.toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US");
  const campaignNames = new Map(campaigns.map((campaign) => [campaign.id, campaign.name]));

  const inCampaign = characters.filter((character) => character.campaignId).length;
  const counts: Record<Filter, number> = { all: characters.length, camp: inCampaign, free: characters.length - inCampaign };
  const visible = characters.filter((character) => filter === "all" || (filter === "camp" ? character.campaignId : !character.campaignId));
  const averageLevel = characters.length ? Math.round(characters.reduce((sum, character) => sum + character.level, 0) / characters.length) : 0;
  const summary = [
    characters.length === 1 ? t("home.summary.character") : t("home.summary.characters", { count: characters.length }),
    characters.length ? t("home.summary.level", { level: averageLevel }) : "",
    campaigns.length === 1 ? t("home.summary.campaign") : t("home.summary.campaigns", { count: campaigns.length }),
  ].filter(Boolean).join(" · ");

  // Shortcut tiles: the first is filled (the main thing to do here); on a phone it becomes a full-width row.
  const tileBase = "flex min-h-28 flex-col items-start gap-2.5 rounded-card border px-4 py-3.5 no-underline transition-[border-color,translate] duration-150 hover:-translate-y-px max-[650px]:gap-1.5 max-[650px]:p-3";
  const tile = `${tileBase} border-line bg-surface text-ink shadow-card hover:border-accent dark:shadow-card-dark max-[650px]:min-h-21`;
  const primaryTile = `${tileBase} col-span-2 border-accent-fill bg-accent-fill text-on-accent shadow-card dark:shadow-card-dark max-[650px]:min-h-14 max-[650px]:flex-row max-[650px]:items-center min-[901px]:col-span-1`;
  const tileLabel = "block font-display text-lg leading-tight font-medium max-[650px]:text-base";
  const tileNote = "mt-0.5 block text-sm max-[650px]:text-xs";

  return <div className={sectionStack}>
    <PageHeader title={t("home.title")} description={summary} />

    <nav className="grid grid-cols-2 gap-3 max-[650px]:gap-2 min-[901px]:grid-cols-4" aria-label={t("home.quick")}>
      <Link className={primaryTile} href="/characters/new">
        <span className={glyphWell(true)}><Icon name="plus" /></span>
        <span><b className={tileLabel}>{t("home.createCharacter")}</b><small className={`${tileNote} opacity-90`}>{t("home.quick.createNote")}</small></span>
      </Link>
      <Link className={tile} href={mapShortcut.href}>
        <span className={glyphWell()}><Icon name="map" /></span>
        <span><b className={tileLabel}>{t("nav.map")}</b><small className={`${tileNote} text-muted`}>{mapShortcut.campaignName ?? t("home.quick.mapNone")}</small></span>
      </Link>
      {/* On a phone Encounters already sits under "Run" in the bottom bar. */}
      <Link className={`${tile} max-[650px]:hidden`} href="/encounters">
        <span className={glyphWell()}><Icon name="encounters" /></span>
        <span><b className={tileLabel}>{t("nav.encounters")}</b><small className={`${tileNote} text-muted`}>{t("home.quick.encountersNote")}</small></span>
      </Link>
      <Link className={tile} href="/campaigns">
        <span className={glyphWell()}><Icon name="campaigns" /></span>
        <span><b className={tileLabel}>{t("nav.campaigns")}</b><small className={`${tileNote} text-muted`}>{t("home.quick.campaignsNote")}</small></span>
      </Link>
    </nav>

    <div className="flex flex-wrap items-start gap-6">
      <section className="flex min-w-0 flex-[3_1_440px] flex-col gap-3.5" aria-labelledby="home-characters">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="home-characters" className={sectionTitle}>{t("home.characters")}</h2>
          {characters.length > 0 && <div className="chips" role="group" aria-label={t("home.filter")}>
            {(["all", "camp", "free"] as const).map((id) => <button key={id} type="button" className="chip" aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {t(`home.filter.${id}`, { count: counts[id] })}
            </button>)}
          </div>}
        </div>

        {characters.length === 0 ? <div className={firstRun}>
          <div><h3 className={sectionTitle}>{t("home.firstTitle")}</h3><p className="mt-1.5 mb-0 max-w-[46ch] leading-normal text-muted">{t("home.firstDescription")}</p></div>
          <Link className="button button-primary" href="/characters/new">✦ {t("home.createCharacter")}</Link>
        </div> : <>
          {visible.length === 0 && <p className="m-0 text-muted italic">{t("home.filterEmpty")}</p>}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {visible.slice(0, MAX_CARDS).map((character) => {
              const sheet = sheetFor(character);
              const identity = characterIdentity(character, locale);
              const subtitle = [identity.className, identity.species].filter(Boolean).join(" · ") || t("character.adventurer");
              return <article className="panel flex flex-col gap-3.5 p-4.5" key={character.id}>
                <div className="flex items-start gap-3">
                  <span className="grid size-11 flex-none place-items-center rounded-full bg-sunken font-display text-[19px] font-medium text-accent" aria-hidden="true">{upper(character.name.slice(0, 1))}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className={cardTitle}>{character.name}</h3>
                    <p className="mt-1 mb-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">{subtitle}<span className="flex-none rounded-control border border-line px-1.5 py-0.5 font-label text-xs whitespace-nowrap">{t("character.levelPill", { level: character.level })}</span></p>
                  </div>
                </div>
                {sheet && <dl className="m-0 grid grid-cols-3 gap-1.5 text-center">
                  {[["character.acShort", sheet.armorClass], ["character.hpShort", sheet.hitPoints], ["home.passive", sheet.passivePerception]].map(([label, value]) => <div key={label} className="rounded-control bg-sunken px-1 py-2">
                    <dt className="font-label text-xs text-muted">{t(String(label))}</dt><dd className="m-0 font-statblock text-lg font-bold text-ink">{value}</dd>
                  </div>)}
                </dl>}
                <dl className="m-0 grid grid-cols-6 gap-0.5 text-center font-statblock">
                  {abilities.map(({ key }) => <div key={key} className="flex flex-col gap-px">
                    <dt className="font-label text-xs text-muted"><abbr title={t(`ability.${key}`)}>{upper(t(`ability.${key}`).slice(0, 3))}</abbr></dt>
                    <dd className="m-0 text-sm font-bold text-ink">{character.scores[key]}</dd>
                    <dd className="m-0 text-xs text-accent">{signedMod(character.scores[key])}</dd>
                  </div>)}
                </dl>
                <div className="mt-auto flex items-center justify-between gap-2.5 border-t border-line pt-3 font-statblock text-sm">
                  <span className="min-w-0 truncate text-muted">{(character.campaignId && campaignNames.get(character.campaignId)) || t("home.noCampaign")}</span>
                  <Link className="inline-flex min-h-11 flex-none items-center font-bold text-accent" href={`/characters/${encodeURIComponent(character.id)}`} aria-label={t("home.openSheetAria", { name: character.name })}>{t("home.openSheet")}</Link>
                </div>
              </article>;
            })}
            <Link className="flex min-h-50 flex-col items-start justify-center gap-2 rounded-card border border-dashed border-control-line p-4.5 text-ink no-underline hover:border-accent" href="/characters/new">
              <span className="grid size-11 place-items-center rounded-full border border-dashed border-accent text-xl text-accent" aria-hidden="true"><Icon name="plus" /></span>
              <b className="font-display text-xl font-medium">{t("home.newCharacter")}</b>
              <small className="text-sm leading-normal text-muted">{t("home.newCharacterNote")}</small>
            </Link>
          </div>
          {visible.length > MAX_CARDS && <Link className="inline-flex min-h-11 items-center self-start font-statblock text-sm font-bold text-accent" href="/characters">{t("home.seeAllCharacters")}</Link>}
        </>}
      </section>

      <section className="flex min-w-0 flex-[1_1_240px] flex-col gap-3.5" aria-labelledby="home-campaigns">
        <h2 id="home-campaigns" className={sectionTitle}>{t("home.yourCampaigns")}</h2>
        {campaigns.length === 0 ? <div className="panel flex flex-col gap-2.5 p-4">
          <p className={note}>{t("home.noCampaigns")}</p>
          <div className={cardActions}><Link className={cardAction} href="/campaigns#campaign-name">{t("home.createCampaign")}</Link></div>
        </div> : campaigns.map((campaign) => {
          const isDm = campaign.myRole === "dm";
          const players = campaign.members.filter((member) => member.role === "player").length;
          const heroes = characters.filter((character) => character.campaignId === campaign.id).map((character) => character.name);
          return <article className="panel flex flex-col gap-2.5 p-4" key={campaign.id}>
            <div>
              <p className={roleLine(isDm)}>
                {isDm ? (players === 1 ? t("home.roleDmOne") : t("home.roleDm", { count: players })) : upper(t("home.rolePlayer", { name: dmName(campaign) }))}
              </p>
              <h3 className={cardTitle}>{campaign.name}</h3>
              {!isDm && heroes.length > 0 && <p className={`${note} mt-1`}>{t("home.playingWith", { names: heroes.join(", ") })}</p>}
            </div>
            <div className={cardActions}>
              <Link className={cardAction} href={`/map/${encodeURIComponent(campaign.id)}`} aria-label={t("home.campaignMapAria", { name: campaign.name })}>{t("home.campaignMap")}</Link>
              <Link className={cardAction} href={`/campaigns#campaign-${campaign.id}`} aria-label={t("home.campaignOpenAria", { name: campaign.name })}>{t("home.campaignOpen")}</Link>
            </div>
          </article>;
        })}
        <p className="local-data-note">◈ {t("home.privacyDescription")}</p>
      </section>
    </div>
  </div>;
}
