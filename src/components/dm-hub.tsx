import Link from "next/link";
import { translate, type Locale } from "@/lib/i18n";
import { Icon, type IconName } from "./icons";
import styles from "./sections.module.css";

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
  return <div className={styles.page}>
    <header className={styles.head}>
      <p className={styles.kicker}>{t("dm.kicker")}</p>
      <h1>{t("dm.title")}</h1>
      <p>{t("dm.description")}</p>
    </header>
    <nav className={styles.hub} aria-label={t("dm.aria")}>
      {links.map((link) => <Link key={link.href} className={styles.hubLink} href={link.href}>
        <span className={styles.tileGlyph} aria-hidden="true"><Icon name={link.icon} /></span>
        <span><b>{link.title}</b><small>{link.note}</small></span>
        {link.count !== undefined && <span className={styles.hubCount}>{link.count}</span>}
        <span className={styles.chevron} aria-hidden="true"><Icon name="chevron" /></span>
      </Link>)}
    </nav>
    <Link className={`button button-primary ${styles.hubCreate}`} href="/campaigns#campaign-name">✦ {t("dm.createCampaign")}</Link>
  </div>;
}
