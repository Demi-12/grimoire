"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import styles from "./campaign-manager.module.css";

export type CampaignCharacter = { id: string; name: string; level: number };
type Locale = "en" | "es";
type Campaign = { id: string; name: string; characterIds: string[] };
type Props = { characters: CampaignCharacter[]; locale: Locale; storageKey?: string };

const DEFAULT_STORAGE_KEY = "grimoire.campaigns.v1";
const text = {
  en: {
    eyebrow: "✦  THE CHRONICLE",
    title: "Campaigns",
    subtitle: "Gather your heroes beneath one banner and keep each tale together.",
    newCampaign: "New campaign", placeholder: "Name your campaign", create: "Create campaign",
    rename: "Rename", save: "Save name", cancel: "Cancel", remove: "Delete campaign",
    assign: "Add a character", noCharacters: "No saved characters are available yet.",
    empty: "No campaigns yet. Begin a new chronicle above.", noMembers: "No heroes have joined this campaign yet.",
    members: (count: number) => `${count} ${count === 1 ? "hero" : "heroes"}`,
    level: (level: number) => `Level ${level}`, removeHero: "Remove from campaign",
    storageNote: "Campaigns are saved in this browser on this device.",
    duplicate: "A campaign with that name already exists.", nameRequired: "Enter a campaign name.",
  },
  es: {
    eyebrow: "✦  LA CRÓNICA",
    title: "Campañas",
    subtitle: "Reúne a tus héroes bajo un mismo estandarte y conserva cada historia junta.",
    newCampaign: "Nueva campaña", placeholder: "Nombre de la campaña", create: "Crear campaña",
    rename: "Renombrar", save: "Guardar nombre", cancel: "Cancelar", remove: "Eliminar campaña",
    assign: "Añadir personaje", noCharacters: "Todavía no hay personajes guardados.",
    empty: "Aún no hay campañas. Inicia una crónica nueva arriba.", noMembers: "Todavía no se han unido héroes a esta campaña.",
    members: (count: number) => `${count} ${count === 1 ? "héroe" : "héroes"}`,
    level: (level: number) => `Nivel ${level}`, removeHero: "Quitar de la campaña",
    storageNote: "Las campañas se guardan en este navegador y dispositivo.",
    duplicate: "Ya existe una campaña con ese nombre.", nameRequired: "Escribe un nombre para la campaña.",
  },
} satisfies Record<Locale, Record<string, string | ((...args: number[]) => string)>>;

function isCampaignList(value: unknown): value is Campaign[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => item !== null && typeof item === "object"
    && typeof item.id === "string" && item.id.length > 0
    && typeof item.name === "string" && item.name.trim().length > 0
    && Array.isArray(item.characterIds)
    && item.characterIds.every((id: unknown) => typeof id === "string"));
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function CampaignManager({ characters, locale, storageKey = DEFAULT_STORAGE_KEY }: Props) {
  const t = text[locale];
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [readyKey, setReadyKey] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState("");
  const availableCharacters = useMemo(() => {
    const ids = new Set(characters.map((character) => character.id));
    return characters.filter((character, index) => ids.has(character.id)
      && characters.findIndex((candidate) => candidate.id === character.id) === index);
  }, [characters]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (isCampaignList(parsed)) {
          const ids = new Set<string>();
          setCampaigns(parsed.filter((campaign) => !ids.has(campaign.id) && Boolean(ids.add(campaign.id)))
            .map((campaign) => ({ ...campaign, name: campaign.name.trim(), characterIds: [...new Set(campaign.characterIds)] })));
        }
      }
    } catch {
      // Ignore malformed or inaccessible browser storage and start with an empty chronicle.
    }
    setReadyKey(storageKey);
  // Storage is read once; later character changes are reconciled in the effect below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (readyKey !== storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(campaigns));
    } catch {
      setError(locale === "es" ? "No se pudieron guardar las campañas en este navegador." : "Campaigns could not be saved in this browser.");
    }
  }, [campaigns, readyKey, storageKey, locale]);

  function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) { setError(t.nameRequired as string); return; }
    if (campaigns.some((campaign) => campaign.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { setError(t.duplicate as string); return; }
    setCampaigns((current) => [{ id: createId(), name, characterIds: [] }, ...current]);
    setNewName(""); setError("");
  }

  function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = editingName.trim();
    if (!name) { setError(t.nameRequired as string); return; }
    if (campaigns.some((campaign) => campaign.id !== editingId && campaign.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { setError(t.duplicate as string); return; }
    setCampaigns((current) => current.map((campaign) => campaign.id === editingId ? { ...campaign, name } : campaign));
    setEditingId(null); setEditingName(""); setError("");
  }

  function assign(campaignId: string, characterId: string) {
    setCampaigns((current) => current.map((campaign) => campaign.id === campaignId && !campaign.characterIds.includes(characterId)
      ? { ...campaign, characterIds: [...campaign.characterIds, characterId] } : campaign));
  }

  function characterName(id: string) { return availableCharacters.find((character) => character.id === id); }

  return <section className={styles.manager} aria-labelledby="campaign-manager-heading">
    <header className={styles.header}>
      <p className={styles.eyebrow}>{t.eyebrow as string}</p>
      <h2 id="campaign-manager-heading">{t.title as string}</h2>
      <p>{t.subtitle as string}</p>
    </header>

    <form className={styles.createForm} onSubmit={createCampaign}>
      <label htmlFor="campaign-name">{t.newCampaign as string}</label>
      <div className={styles.createRow}>
        <input id="campaign-name" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={80} placeholder={t.placeholder as string} />
        <button type="submit">✧ {t.create as string}</button>
      </div>
    </form>

    {error && <p className={styles.error} role="alert">{error}</p>}
    {!campaigns.length ? <p className={styles.empty}>{t.empty as string}</p> : <div className={styles.campaignList}>
      {campaigns.map((campaign) => {
        const members = campaign.characterIds.map(characterName).filter((character): character is CampaignCharacter => Boolean(character));
        const assigned = new Set(campaign.characterIds);
        const candidates = availableCharacters.filter((character) => !assigned.has(character.id));
        return <article className={styles.campaign} key={campaign.id}>
          <div className={styles.campaignHead}>
            {editingId === campaign.id ? <form className={styles.renameForm} onSubmit={saveName}>
              <input aria-label={t.newCampaign as string} autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} maxLength={80} />
              <button type="submit">{t.save as string}</button>
              <button type="button" className={styles.quietButton} onClick={() => { setEditingId(null); setError(""); }}>{t.cancel as string}</button>
            </form> : <>
              <div><h3>{campaign.name}</h3><span className={styles.memberCount}>{(t.members as (count: number) => string)(members.length)}</span></div>
              <div className={styles.actions}>
                <button type="button" className={styles.quietButton} onClick={() => { setEditingId(campaign.id); setEditingName(campaign.name); setError(""); }}>{t.rename as string}</button>
                <button type="button" className={styles.deleteButton} onClick={() => setCampaigns((current) => current.filter((item) => item.id !== campaign.id))}>{t.remove as string}</button>
              </div>
            </>}
          </div>
          {members.length ? <ul className={styles.memberList}>{members.map((character) => <li key={character.id}>
            <span className={styles.sigle}>✦</span><span className={styles.heroName}>{character.name}<small>{(t.level as (level: number) => string)(character.level)}</small></span>
            <button type="button" className={styles.removeHero} aria-label={`${t.removeHero as string}: ${character.name}`} onClick={() => setCampaigns((current) => current.map((item) => item.id === campaign.id ? { ...item, characterIds: item.characterIds.filter((id) => id !== character.id) } : item))}>×</button>
          </li>)}</ul> : <p className={styles.noMembers}>{t.noMembers as string}</p>}
          {candidates.length ? <label className={styles.assign}>
            <span>{t.assign as string}</span>
            <select value="" onChange={(event) => { if (event.target.value) assign(campaign.id, event.target.value); }}>
              <option value="">{t.assign as string}…</option>
              {candidates.map((character) => <option key={character.id} value={character.id}>{character.name} · {(t.level as (level: number) => string)(character.level)}</option>)}
            </select>
          </label> : !availableCharacters.length ? <p className={styles.noMembers}>{t.noCharacters as string}</p> : null}
        </article>;
      })}
    </div>}
    <p className={styles.storageNote}>◈ &nbsp; {t.storageNote as string}</p>
  </section>;
}
