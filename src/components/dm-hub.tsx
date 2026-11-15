import Link from "next/link";
import { translate, type Locale } from "@/lib/i18n";
import { Icon, type IconName } from "./icons";
import { PageHeader } from "./page-header";
import { glyphWell, linkCard, sectionStack } from "./section-styles";

/**
 * `/dm`: the "Run the game" group as a page of its own. On a phone the bottom bar has room for four tabs,
 * so Campaigns, Encounters and Bestiary sit behind this one; on wider screens the sidebar lists them directly.
 */
export default function DmHub({ locale, campaignCount }: { locale: Locale; campaignCount: number }) {
  const t = (key: string) => translate(locale, key);
  const links: { href: string; icon: IconName; title: string; note: string; count?: number }[] = [
    { href: "/campaigns", icon: "campaigns", title: t("nav.campaigns"), note: t("dm.campaignsNote"), count: campaignCount },
    { href: "/encounters", icon: "encounters", title: t("nav.encounters"), note: t("dm.encountersNote") },
    { href: "/bestiary", icon: "bestiary", title: t("nav.bestiary"), note: t("dm.bestiaryNote") },
  ];
  return <div className={sectionStack}>
    <PageHeader kicker={t("dm.kicker")} title={t("dm.title")} description={t("dm.description")} />
    <nav className="flex max-w-160 flex-col gap-2.5" aria-label={t("dm.aria")}>
      {links.map((link) => <Link key={link.href} className={`${linkCard} min-h-21 items-center gap-3.5 p-4`} href={link.href}>
        <span className={glyphWell()} aria-hidden="true"><Icon name={link.icon} /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5"><b className="font-display text-[19px] font-medium">{link.title}</b><small className="text-sm leading-snug text-muted">{link.note}</small></span>
        {link.count !== undefined && <span className="font-label text-xs text-muted">{link.count}</span>}
        <span className="flex-none text-muted" aria-hidden="true"><Icon name="chevron" /></span>
      </Link>)}
    </nav>
    <Link className="button button-primary min-h-12 self-start px-5 text-[15px] max-[650px]:self-stretch" href="/campaigns#campaign-name">✦ {t("dm.createCampaign")}</Link>
  </div>;
}
