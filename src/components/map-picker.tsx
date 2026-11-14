"use client";

import Link from "next/link";
import { useState } from "react";
import type { Campaign, Character } from "@/lib/api-client";
import { translate, type Locale } from "@/lib/i18n";
import { dmName } from "./home-dashboard";
import { useToast } from "./feedback";
import { Icon } from "./icons";
import styles from "./sections.module.css";

/**
 * `/map`: the battle map of each campaign the person sits at, the one they opened last first.
 * (With a single campaign the menu links straight to its map, so this page is mostly for groups of tables.)
 */
export default function MapPicker({ locale, campaigns, characters }: {
  locale: Locale;
  /** Member campaigns, already sorted by when their map was last opened. */
  campaigns: Campaign[];
  /** The person's own characters, to say which hero they move. */
  characters: Character[];
}) {
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, key, values);
  const toast = useToast();
  const [copiedId, setCopiedId] = useState("");
  const upper = (text: string) => text.toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US");

  async function copy(campaign: Campaign) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/map/${encodeURIComponent(campaign.id)}`);
      setCopiedId(campaign.id);
      window.setTimeout(() => setCopiedId((current) => current === campaign.id ? "" : current), 2_000);
    } catch {
      toast.error(t("map.copyError"));
    }
  }

  return <div className={styles.page}>
    <header className={styles.head}>
      <h1>{t("map.title")}</h1>
      <p>{t("map.description")}</p>
    </header>

    {campaigns.length === 0 ? <div className={styles.firstRun}>
      <div><h2 className={styles.firstRunTitle}>{t("map.emptyTitle")}</h2><p>{t("map.emptyDescription")}</p></div>
      <Link className="button button-primary" href="/campaigns#campaign-name">{t("home.createCampaign")}</Link>
    </div> : <div className={styles.maps}>
      {campaigns.map((campaign, index) => {
        const isDm = campaign.myRole === "dm";
        const href = `/map/${encodeURIComponent(campaign.id)}`;
        const players = campaign.members.filter((member) => member.role === "player").length;
        const heroes = characters.filter((character) => character.campaignId === campaign.id).map((character) => character.name);
        return <article className={`${styles.campaign} ${styles.mapCard}`} key={campaign.id}>
          <div className={styles.mapThumb} aria-hidden="true">{index === 0 && campaigns.length > 1 && <span>{t("map.lastUsed")}</span>}</div>
          <div className={styles.mapBody}>
            <div>
              <p className={`${styles.role}${isDm ? ` ${styles.roleDm}` : ""}`}>
                {isDm ? (players === 1 ? t("home.roleDmOne") : t("home.roleDm", { count: players })) : upper(t("home.rolePlayer", { name: dmName(campaign) }))}
              </p>
              <h2>{campaign.name}</h2>
            </div>
            <div className={styles.actions}>
              {/* One filled button per page: the table opened last. */}
              <Link className={`${styles.action}${index === 0 ? ` ${styles.actionPrimary}` : ""}`} href={href} aria-label={t("map.openAria", { name: campaign.name })}>
                <Icon name="map" />{t("map.open")}
              </Link>
              {isDm && <button type="button" className={styles.action} onClick={() => void copy(campaign)}>
                <Icon name="link" /><span aria-live="polite">{copiedId === campaign.id ? t("map.copied") : t("map.copy")}</span>
              </button>}
            </div>
            <p className={styles.note}>{isDm ? t("map.shareNote") : heroes.length ? t("map.youMove", { names: heroes.join(", ") }) : t("map.noHero")}</p>
          </div>
        </article>;
      })}
    </div>}
  </div>;
}
