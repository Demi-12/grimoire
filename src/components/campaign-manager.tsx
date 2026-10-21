"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, type Campaign, type Character, type DirectoryUser, type Invite, type Me } from "@/lib/api-client";
import type { CampaignRole } from "@/lib/permissions";
import EncounterJournal from "@/components/encounter-journal";
import styles from "./campaign-manager.module.css";

type Locale = "en" | "es";
type Props = {
  me: Me;
  campaigns: Campaign[];
  /** Every character the user can see: their own plus those in shared campaigns. */
  characters: Character[];
  locale: Locale;
  /** Reload campaigns and characters after a change. */
  onChanged: () => Promise<void>;
};

const text = {
  en: {
    eyebrow: "✦  THE CHRONICLE", title: "Campaigns",
    subtitle: "Gather your table beneath one banner. You are the DM of the campaigns you create and a player in the ones you join.",
    newCampaign: "New campaign", placeholder: "Name your campaign", create: "Create campaign",
    rename: "Edit", save: "Save", cancel: "Cancel", remove: "Delete campaign", leave: "Leave campaign",
    description: "Description", descriptionPlaceholder: "Setting, schedule, house rules…",
    deleteConfirm: (name: string) => `Delete “${name}”? Characters stay with their owners.`,
    leaveConfirm: (name: string) => `Leave “${name}”? Your characters will be taken out of it.`,
    empty: "No campaigns yet.", owner: (name: string) => `Run by ${name}`,
    roles: { dm: "DM", player: "Player" } as Record<CampaignRole, string>,
    yourRole: "Your role", table: "The table", heroes: "Heroes",
    addMember: "Add someone", addAs: "as", add: "Add", noOneToAdd: "Every approved account is already here.",
    makeDm: "Make DM", makePlayer: "Make player", removeMember: "Remove",
    noHeroes: "No heroes have joined this campaign yet.", addHero: "Bring one of your characters",
    level: (level: number) => `Level ${level}`, by: (name: string) => `played by ${name}`,
    removeHero: "Take out of campaign", error: "That change couldn't be saved. Try again.",
    nameRequired: "Enter a campaign name.",
    invites: "Invite links", createInvite: "Create invite link", inviteHint: "Anyone who opens the link and signs in joins as a player. Links expire after 7 days.",
    journal: "Encounter journal",
    copyLink: "Copy link", copied: "Copied", share: "Share", shareTitle: (c: string) => `Join "${c}" on Grimoire`,
    shareMessage: (owner: string, c: string) => `⚔️ ${owner} is calling you to the table! Join the campaign "${c}" on Grimoire, build your hero and roll initiative.\n\n🎲 Your invitation (valid 7 days):`, revoke: "Revoke", noInvites: "No active links.", expires: "Expires",
  },
  es: {
    eyebrow: "✦  LA CRÓNICA", title: "Campañas",
    subtitle: "Reúne a tu mesa bajo un mismo estandarte. Eres el DM de las campañas que creas y jugador en las que te unes.",
    newCampaign: "Nueva campaña", placeholder: "Nombre de la campaña", create: "Crear campaña",
    rename: "Editar", save: "Guardar", cancel: "Cancelar", remove: "Eliminar campaña", leave: "Salir de la campaña",
    description: "Descripción", descriptionPlaceholder: "Ambientación, horario, reglas de la casa…",
    deleteConfirm: (name: string) => `¿Eliminar «${name}»? Los personajes se quedan con sus dueños.`,
    leaveConfirm: (name: string) => `¿Salir de «${name}»? Tus personajes saldrán de ella.`,
    empty: "Aún no hay campañas.", owner: (name: string) => `Dirigida por ${name}`,
    roles: { dm: "DM", player: "Jugador" } as Record<CampaignRole, string>,
    yourRole: "Tu papel", table: "La mesa", heroes: "Héroes",
    addMember: "Añadir a alguien", addAs: "como", add: "Añadir", noOneToAdd: "Todas las cuentas aprobadas ya están aquí.",
    makeDm: "Hacer DM", makePlayer: "Hacer jugador", removeMember: "Quitar",
    noHeroes: "Todavía no se han unido héroes a esta campaña.", addHero: "Trae uno de tus personajes",
    level: (level: number) => `Nivel ${level}`, by: (name: string) => `de ${name}`,
    removeHero: "Sacar de la campaña", error: "No se pudo guardar el cambio. Inténtalo de nuevo.",
    nameRequired: "Escribe un nombre para la campaña.",
    invites: "Enlaces de invitación", createInvite: "Crear enlace de invitación", inviteHint: "Quien abra el enlace e inicie sesión se une como jugador. Los enlaces caducan a los 7 días.",
    journal: "Diario de encuentros",
    copyLink: "Copiar enlace", copied: "Copiado", share: "Compartir", shareTitle: (c: string) => `Únete a «${c}» en Grimoire`,
    shareMessage: (owner: string, c: string) => `⚔️ ¡${owner} te convoca a la mesa! Únete a la campaña «${c}» en Grimoire, crea a tu héroe y prepárate para tirar iniciativa.\n\n🎲 Tu invitación (válida 7 días):`, revoke: "Revocar", noInvites: "No hay enlaces activos.", expires: "Caduca",
  },
};

export default function CampaignManager({ me, campaigns, characters, locale, onChanged }: Props) {
  const t = text[locale];
  const managesAny = campaigns.some((campaign) => campaign.canManage);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!managesAny) return;
    api<{ users: DirectoryUser[] }>("/api/directory").then((data) => setDirectory(data.users)).catch(() => setDirectory([]));
  }, [managesAny]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await onChanged();
      return true;
    } catch {
      setError(t.error);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) { setError(t.nameRequired); return; }
    if (await run(() => api("/api/campaigns", { method: "POST", body: { name, description: "" } }))) setNewName("");
  }

  async function saveCampaign(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const name = editName.trim();
    if (!name) { setError(t.nameRequired); return; }
    if (await run(() => api(`/api/campaigns/${id}`, { method: "PATCH", body: { name, description: editDescription } }))) setEditingId(null);
  }

  const moveCharacter = (character: Character, campaignId: string | null) => run(() => api(`/api/characters/${character.id}`, {
    method: "PUT",
    body: {
      name: character.name, level: character.level, className: character.className, species: character.species,
      background: character.background, scores: character.scores, notes: character.notes, build: character.build, campaignId,
    },
  }));

  return <section className={styles.manager} aria-labelledby="campaign-manager-heading">
    <header className={styles.header}>
      <p className={styles.eyebrow}>{t.eyebrow}</p>
      <h2 id="campaign-manager-heading">{t.title}</h2>
      <p>{t.subtitle}</p>
    </header>

    <form className={styles.createForm} onSubmit={(event) => void createCampaign(event)}>
      <label htmlFor="campaign-name">{t.newCampaign}</label>
      <div className={styles.createRow}>
        <input id="campaign-name" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={80} placeholder={t.placeholder} />
        <button type="submit" disabled={busy}>✧ {t.create}</button>
      </div>
    </form>

    {error && <p className={styles.error} role="alert">{error}</p>}
    {!campaigns.length ? <p className={styles.empty}>{t.empty}</p> : <div className={styles.campaignList}>
      {campaigns.map((campaign) => {
        const heroes = characters.filter((character) => character.campaignId === campaign.id);
        const myLooseCharacters = characters.filter((character) => character.editable && character.campaignId !== campaign.id);
        const memberIds = new Set(campaign.members.map((member) => member.userId));
        const candidates = directory.filter((user) => !memberIds.has(user.id));
        const canDelete = campaign.isOwner || me.role === "admin";
        return <article className={styles.campaign} key={campaign.id}>
          <div className={styles.campaignHead}>
            {editingId === campaign.id ? <form className={styles.renameForm} onSubmit={(event) => void saveCampaign(event, campaign.id)}>
              <input aria-label={t.newCampaign} autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={80} />
              <textarea aria-label={t.description} className={styles.descriptionInput} value={editDescription} maxLength={1000} rows={2}
                placeholder={t.descriptionPlaceholder} onChange={(event) => setEditDescription(event.target.value)} />
              <button type="submit" disabled={busy}>{t.save}</button>
              <button type="button" className={styles.quietButton} onClick={() => { setEditingId(null); setError(""); }}>{t.cancel}</button>
            </form> : <>
              <div>
                <h3>{campaign.name}</h3>
                <span className={styles.memberCount}>{t.owner(campaign.ownerName)} · {t.yourRole}: {campaign.myRole ? t.roles[campaign.myRole] : "—"}</span>
                {campaign.description && <p className={styles.description}>{campaign.description}</p>}
              </div>
              <div className={styles.actions}>
                {campaign.canManage && <button type="button" className={styles.quietButton} onClick={() => { setEditingId(campaign.id); setEditName(campaign.name); setEditDescription(campaign.description); setError(""); }}>{t.rename}</button>}
                {canDelete && <button type="button" className={styles.deleteButton} disabled={busy} onClick={() => { if (window.confirm(t.deleteConfirm(campaign.name))) void run(() => api(`/api/campaigns/${campaign.id}`, { method: "DELETE" })); }}>{t.remove}</button>}
                {!campaign.isOwner && campaign.myRole && <button type="button" className={styles.quietButton} disabled={busy} onClick={() => { if (window.confirm(t.leaveConfirm(campaign.name))) void run(() => api(`/api/campaigns/${campaign.id}/members/${me.id}`, { method: "DELETE" })); }}>{t.leave}</button>}
              </div>
            </>}
          </div>

          <h4 className={styles.subheading}>{t.table}</h4>
          <ul className={styles.memberList}>{campaign.members.map((member) => {
            const isOwner = member.userId === campaign.ownerId;
            return <li key={member.userId}>
              <span className={styles.sigle}>{member.role === "dm" ? "♛" : "♙"}</span>
              <span className={styles.heroName}>{member.name}<small>{t.roles[member.role]}{member.userId === me.id ? " · ✦" : ""}</small></span>
              {campaign.canManage && !isOwner && <>
                <button type="button" className={styles.quietButton} disabled={busy}
                  onClick={() => void run(() => api(`/api/campaigns/${campaign.id}/members`, { method: "POST", body: { userId: member.userId, role: member.role === "dm" ? "player" : "dm" } }))}>
                  {member.role === "dm" ? t.makePlayer : t.makeDm}
                </button>
                <button type="button" className={styles.removeHero} disabled={busy} aria-label={`${t.removeMember}: ${member.name}`}
                  onClick={() => void run(() => api(`/api/campaigns/${campaign.id}/members/${member.userId}`, { method: "DELETE" }))}>×</button>
              </>}
            </li>;
          })}</ul>
          {campaign.canManage && (candidates.length ? <AddMember key={candidates.length} locale={locale} candidates={candidates} disabled={busy}
            onAdd={(userId, role) => run(() => api(`/api/campaigns/${campaign.id}/members`, { method: "POST", body: { userId, role } }))} /> : <p className={styles.noMembers}>{t.noOneToAdd}</p>)}

          {campaign.canManage && <InvitePanel campaignId={campaign.id} campaignName={campaign.name} ownerName={campaign.ownerName} locale={locale} />}

          {campaign.canManage && <details className={styles.journalBox}>
            <summary className={styles.subheading}>{t.journal}</summary>
            <EncounterJournal campaign={campaign} locale={locale} />
          </details>}

          <h4 className={styles.subheading}>{t.heroes}</h4>
          {heroes.length ? <ul className={styles.memberList}>{heroes.map((character) => <li key={character.id}>
            <span className={styles.sigle}>✦</span>
            <span className={styles.heroName}>{character.name}<small>{t.level(character.level)}{character.className ? ` · ${character.className}` : ""} · {t.by(character.ownerName)}</small></span>
            {(campaign.canManage || character.editable) && <button type="button" className={styles.removeHero} disabled={busy} aria-label={`${t.removeHero}: ${character.name}`}
              onClick={() => void run(() => api(`/api/campaigns/${campaign.id}/characters/${character.id}`, { method: "DELETE" }))}>×</button>}
          </li>)}</ul> : <p className={styles.noMembers}>{t.noHeroes}</p>}
          {campaign.myRole && myLooseCharacters.length > 0 && <label className={styles.assign}>
            <span>{t.addHero}</span>
            <select value="" disabled={busy} onChange={(event) => {
              const character = myLooseCharacters.find((item) => item.id === event.target.value);
              if (character) void moveCharacter(character, campaign.id);
            }}>
              <option value="">{t.addHero}…</option>
              {myLooseCharacters.map((character) => <option key={character.id} value={character.id}>{character.name} · {t.level(character.level)}</option>)}
            </select>
          </label>}
        </article>;
      })}
    </div>}
  </section>;
}

function AddMember({ locale, candidates, disabled, onAdd }: {
  locale: Locale;
  candidates: DirectoryUser[];
  disabled: boolean;
  onAdd: (userId: string, role: CampaignRole) => Promise<boolean>;
}) {
  const t = text[locale];
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<CampaignRole>("player");
  return <form className={styles.addMember} onSubmit={(event) => { event.preventDefault(); if (userId) void onAdd(userId, role).then((ok) => { if (ok) setUserId(""); }); }}>
    <span>{t.addMember}</span>
    <select aria-label={t.addMember} value={userId} onChange={(event) => setUserId(event.target.value)}>
      <option value="">…</option>
      {candidates.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
    </select>
    <span>{t.addAs}</span>
    <select aria-label={t.addAs} value={role} onChange={(event) => setRole(event.target.value as CampaignRole)}>
      <option value="player">{t.roles.player}</option>
      <option value="dm">{t.roles.dm}</option>
    </select>
    <button type="submit" disabled={disabled || !userId}>{t.add}</button>
  </form>;
}

function InvitePanel({ campaignId, campaignName, ownerName, locale }: { campaignId: string; campaignName: string; ownerName: string; locale: Locale }) {
  const t = text[locale];
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const [failed, setFailed] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => { setCanShare(typeof navigator.share === "function"); }, []);
  useEffect(() => {
    api<{ invites: Invite[] }>(`/api/campaigns/${campaignId}/invites`).then((data) => setInvites(data.invites)).catch(() => setInvites([]));
  }, [campaignId]);

  const linkFor = (invite: Invite) => `${window.location.origin}/?invite=${invite.token}`;

  async function change(action: () => Promise<unknown>) {
    setBusy(true);
    setFailed(false);
    try {
      await action();
      setInvites((await api<{ invites: Invite[] }>(`/api/campaigns/${campaignId}/invites`)).invites);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const messageFor = (invite: Invite) => `${t.shareMessage(ownerName, campaignName)}\n${linkFor(invite)}`;

  async function copy(invite: Invite) {
    const message = messageFor(invite);
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      // Insecure contexts and some mobile webviews have no async clipboard: fall back to a hidden textarea.
      const area = document.createElement("textarea");
      area.value = message;
      area.setAttribute("readonly", "");
      area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(area);
      area.select();
      area.setSelectionRange(0, message.length);
      let done = false;
      try { done = document.execCommand("copy"); } catch { /* handled below */ }
      document.body.removeChild(area);
      if (!done) {
        window.prompt(t.copyLink, linkFor(invite));
        return;
      }
    }
    setCopiedId(invite.id);
    window.setTimeout(() => setCopiedId((current) => (current === invite.id ? "" : current)), 2500);
  }

  async function share(invite: Invite) {
    try {
      await navigator.share({ title: t.shareTitle(campaignName), text: t.shareMessage(ownerName, campaignName), url: linkFor(invite) });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) await copy(invite);
    }
  }

  return <>
    <h4 className={styles.subheading}>{t.invites}</h4>
    <p className={styles.noMembers}>{t.inviteHint}</p>
    {failed && <p className={styles.error} role="alert">{t.error}</p>}
    {invites.length ? <ul className={styles.memberList}>{invites.map((invite) => <li key={invite.id}>
      <span className={styles.sigle}>⚑</span>
      <span className={styles.heroName}>…{invite.token.slice(-6)}<small>{t.expires} {new Date(invite.expiresAt).toLocaleDateString(locale === "es" ? "es-ES" : "en-US")}</small></span>
      {canShare && <button type="button" className={styles.quietButton} onClick={() => void share(invite)}>{t.share}</button>}
      <button type="button" className={styles.quietButton} onClick={() => void copy(invite)}>{copiedId === invite.id ? t.copied : t.copyLink}</button>
      <button type="button" className={styles.quietButton} disabled={busy} onClick={() => void change(() => api(`/api/campaigns/${campaignId}/invites/${invite.id}`, { method: "DELETE" }))}>{t.revoke}</button>
    </li>)}</ul> : <p className={styles.noMembers}>{t.noInvites}</p>}
    <form className={styles.addMember} onSubmit={(event) => { event.preventDefault(); void change(() => api(`/api/campaigns/${campaignId}/invites`, { method: "POST" })); }}>
      <button type="submit" disabled={busy}>{t.createInvite}</button>
    </form>
  </>;
}
