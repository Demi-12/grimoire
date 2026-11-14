"use client";

import Link from "next/link";
import { useState } from "react";
import type { Campaign, Character } from "@/lib/api-client";
import { sheetFor } from "@/lib/character-view";
import { translate, type Locale } from "@/lib/i18n";
import { abilities, abilityModifier } from "@/lib/rules";
import { Icon } from "./icons";
import styles from "./sections.module.css";

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

  return <div className={styles.page}>
    <header className={styles.head}>
      <h1>{t("home.title")}</h1>
      <p>{summary}</p>
    </header>

    <nav className={styles.quick} aria-label={t("home.quick")}>
      <Link className={`${styles.tile} ${styles.tilePrimary}`} href="/characters/new">
        <span className={styles.tileGlyph}><Icon name="plus" /></span>
        <span><b>{t("home.createCharacter")}</b><small>{t("home.quick.createNote")}</small></span>
      </Link>
      <Link className={styles.tile} href={mapShortcut.href}>
        <span className={styles.tileGlyph}><Icon name="map" /></span>
        <span><b>{t("nav.map")}</b><small>{mapShortcut.campaignName ?? t("home.quick.mapNone")}</small></span>
      </Link>
      <Link className={`${styles.tile} ${styles.tileWide}`} href="/encounters">
        <span className={styles.tileGlyph}><Icon name="encounters" /></span>
        <span><b>{t("nav.encounters")}</b><small>{t("home.quick.encountersNote")}</small></span>
      </Link>
      <Link className={styles.tile} href="/campaigns">
        <span className={styles.tileGlyph}><Icon name="campaigns" /></span>
        <span><b>{t("nav.campaigns")}</b><small>{t("home.quick.campaignsNote")}</small></span>
      </Link>
    </nav>

    <div className={styles.columns}>
      <section className={styles.main} aria-labelledby="home-characters">
        <div className={styles.sectionHead}>
          <h2 id="home-characters">{t("home.characters")}</h2>
          {characters.length > 0 && <div className={styles.filters} role="group" aria-label={t("home.filter")}>
            {(["all", "camp", "free"] as const).map((id) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {t(`home.filter.${id}`, { count: counts[id] })}
            </button>)}
          </div>}
        </div>

        {characters.length === 0 ? <div className={styles.firstRun}>
          <div><h3>{t("home.firstTitle")}</h3><p>{t("home.firstDescription")}</p></div>
          <Link className="button button-primary" href="/characters/new">✦ {t("home.createCharacter")}</Link>
        </div> : <>
          {visible.length === 0 && <p className={styles.empty}>{t("home.filterEmpty")}</p>}
          <div className={styles.grid}>
            {visible.slice(0, MAX_CARDS).map((character) => {
              const sheet = sheetFor(character);
              const subtitle = [character.className, character.species].filter(Boolean).join(" · ") || t("character.adventurer");
              return <article className={styles.card} key={character.id}>
                <div className={styles.cardTop}>
                  <span className={styles.initial} aria-hidden="true">{upper(character.name.slice(0, 1))}</span>
                  <div className={styles.cardName}>
                    <h3>{character.name}</h3>
                    <p>{subtitle}<span className={styles.level}>{t("character.levelPill", { level: character.level })}</span></p>
                  </div>
                </div>
                {sheet && <dl className={styles.vitals}>
                  <div><dt>{t("character.acShort")}</dt><dd>{sheet.armorClass}</dd></div>
                  <div><dt>{t("character.hpShort")}</dt><dd>{sheet.hitPoints}</dd></div>
                  <div><dt>{t("home.passive")}</dt><dd>{sheet.passivePerception}</dd></div>
                </dl>}
                <dl className={styles.scores}>
                  {abilities.map(({ key }) => <div key={key}>
                    <dt><abbr title={t(`ability.${key}`)}>{upper(t(`ability.${key}`).slice(0, 3))}</abbr></dt>
                    <dd>{character.scores[key]}</dd>
                    <dd>{signedMod(character.scores[key])}</dd>
                  </div>)}
                </dl>
                <div className={styles.cardFoot}>
                  <span>{(character.campaignId && campaignNames.get(character.campaignId)) || t("home.noCampaign")}</span>
                  <Link href={`/characters/${encodeURIComponent(character.id)}`} aria-label={t("home.openSheetAria", { name: character.name })}>{t("home.openSheet")}</Link>
                </div>
              </article>;
            })}
            <Link className={styles.newCard} href="/characters/new">
              <span aria-hidden="true"><Icon name="plus" /></span>
              <b>{t("home.newCharacter")}</b>
              <small>{t("home.newCharacterNote")}</small>
            </Link>
          </div>
          {visible.length > MAX_CARDS && <Link className={styles.more} href="/characters">{t("home.seeAllCharacters")}</Link>}
        </>}
      </section>

      <section className={styles.aside} aria-labelledby="home-campaigns">
        <h2 id="home-campaigns">{t("home.yourCampaigns")}</h2>
        {campaigns.length === 0 ? <div className={styles.campaign}>
          <p className={styles.note}>{t("home.noCampaigns")}</p>
          <div className={styles.actions}><Link className={styles.action} href="/campaigns#campaign-name">{t("home.createCampaign")}</Link></div>
        </div> : campaigns.map((campaign) => {
          const isDm = campaign.myRole === "dm";
          const players = campaign.members.filter((member) => member.role === "player").length;
          const heroes = characters.filter((character) => character.campaignId === campaign.id).map((character) => character.name);
          return <article className={styles.campaign} key={campaign.id}>
            <div>
              <p className={`${styles.role}${isDm ? ` ${styles.roleDm}` : ""}`}>
                {isDm ? (players === 1 ? t("home.roleDmOne") : t("home.roleDm", { count: players })) : upper(t("home.rolePlayer", { name: dmName(campaign) }))}
              </p>
              <h3>{campaign.name}</h3>
              {!isDm && heroes.length > 0 && <p className={styles.note}>{t("home.playingWith", { names: heroes.join(", ") })}</p>}
            </div>
            <div className={styles.actions}>
              <Link className={styles.action} href={`/map/${encodeURIComponent(campaign.id)}`} aria-label={t("home.campaignMapAria", { name: campaign.name })}>{t("home.campaignMap")}</Link>
              <Link className={styles.action} href={`/campaigns#campaign-${campaign.id}`} aria-label={t("home.campaignOpenAria", { name: campaign.name })}>{t("home.campaignOpen")}</Link>
            </div>
          </article>;
        })}
        <p className="local-data-note">◈ {t("home.privacyDescription")}</p>
      </section>
    </div>
  </div>;
}
