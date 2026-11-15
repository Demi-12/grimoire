"use client";

import Link from "next/link";
import { useState } from "react";
import type { Campaign, Character } from "@/lib/api-client";
import { translate, type Locale } from "@/lib/i18n";
import { dmName } from "./home-dashboard";
import { useToast } from "./feedback";
import { Icon } from "./icons";
import { PageHeader } from "./page-header";
import { cardAction, cardActions, firstRun, note, roleLine, sectionStack, sectionTitle } from "./section-styles";

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

  return <div className={sectionStack}>
    <PageHeader title={t("map.title")} description={t("map.description")} />

    {campaigns.length === 0 ? <div className={firstRun}>
      <div><h2 className={sectionTitle}>{t("map.emptyTitle")}</h2><p className="mt-1.5 mb-0 max-w-[46ch] leading-normal text-muted">{t("map.emptyDescription")}</p></div>
      <Link className="button button-primary" href="/campaigns#campaign-name">{t("home.createCampaign")}</Link>
    </div> : <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-4">
      {campaigns.map((campaign, index) => {
        const isDm = campaign.myRole === "dm";
        const href = `/map/${encodeURIComponent(campaign.id)}`;
        const players = campaign.members.filter((member) => member.role === "player").length;
        const heroes = characters.filter((character) => character.campaignId === campaign.id).map((character) => character.name);
        return <article className="panel flex flex-col overflow-hidden" key={campaign.id}>
          {/* A square grid stands in for the map until maps have thumbnails. */}
          <div className="relative h-37.5 border-b border-line bg-sunken bg-[linear-gradient(color-mix(in_srgb,var(--accent)_14%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--accent)_14%,transparent)_1px,transparent_1px)] bg-size-[22px_22px]" aria-hidden="true">
            {index === 0 && campaigns.length > 1 && <span className="absolute top-3 left-3 rounded-control bg-surface px-2 py-1 font-label text-xs font-bold tracking-[.1em] text-muted">{t("map.lastUsed")}</span>}
          </div>
          <div className="flex flex-col gap-3.5 p-4.5">
            <div>
              <p className={roleLine(isDm)}>
                {isDm ? (players === 1 ? t("home.roleDmOne") : t("home.roleDm", { count: players })) : upper(t("home.rolePlayer", { name: dmName(campaign) }))}
              </p>
              <h2 className={sectionTitle}>{campaign.name}</h2>
            </div>
            <div className={cardActions}>
              {/* One filled button per page: the table opened last. */}
              <Link className={`${cardAction}${index === 0 ? " button-primary" : ""}`} href={href} aria-label={t("map.openAria", { name: campaign.name })}>
                <Icon name="map" />{t("map.open")}
              </Link>
              {isDm && <button type="button" className={cardAction} onClick={() => void copy(campaign)}>
                <Icon name="link" /><span aria-live="polite">{copiedId === campaign.id ? t("map.copied") : t("map.copy")}</span>
              </button>}
            </div>
            <p className={note}>{isDm ? t("map.shareNote") : heroes.length ? t("map.youMove", { names: heroes.join(", ") }) : t("map.noHero")}</p>
          </div>
        </article>;
      })}
    </div>}
  </div>;
}
