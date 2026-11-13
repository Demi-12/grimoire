"use client";

import Link from "next/link";
import { Spinner } from "./skeleton";
import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type Campaign, type Character, type Invite, type Me } from "@/lib/api-client";
import type { CampaignRole } from "@/lib/permissions";
import EncounterJournal from "@/components/encounter-journal";
import { useConfirm, useToast } from "./feedback";
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
  /** Open a character's full sheet. */
  onOpenCharacter?: (id: string) => void;
};

const text = {
  en: {
    eyebrow: "✦  THE CHRONICLE", title: "Campaigns",
    subtitle: "Gather your table beneath one banner. You are the DM of the campaigns you create and a player in the ones you join.",
    newCampaign: "New campaign", placeholder: "Name your campaign", create: "Create campaign",
    rename: "Edit", save: "Save", cancel: "Cancel", remove: "Delete campaign", leave: "Leave campaign",
    description: "Description", descriptionPlaceholder: "Setting, schedule, house rules…",
    deleteConfirm: (name: string) => `Delete “${name}”?`,
    deleteBody: "Characters stay with their owners. The encounter journal, battle maps and invite links go with the campaign, and this can't be undone.",
    deleted: (name: string) => `“${name}” was deleted.`, created: (name: string) => `“${name}” is ready. Invite your table.`, saved: "Campaign updated.",
    leaveConfirm: (name: string) => `Leave “${name}”?`, leaveBody: "Your characters will be taken out of it. You'll need a new invitation to come back.",
    left: (name: string) => `You left “${name}”.`,
    removeMemberConfirm: (name: string) => `Remove ${name} from the table?`, removeMemberBody: "Their characters are taken out of this campaign; they keep them.",
    memberRemoved: (name: string) => `${name} left the table.`,
    empty: "No campaigns yet.", owner: (name: string) => `Run by ${name}`,
    roles: { dm: "DM", player: "Player" } as Record<CampaignRole, string>,
    yourRole: "Your role", table: "The table", heroes: "Heroes",
    makeDm: "Make DM", makePlayer: "Make player", removeMember: "Remove",
    addMember: "Add by email or name", addAs: "as", add: "Add", added: (name: string) => `${name} joined the table.`,
    noHeroes: "No heroes have joined this campaign yet.", addHero: "Bring one of your characters",
    level: (level: number) => `Level ${level}`, by: (name: string) => `played by ${name}`,
    viewSheet: "View sheet", removeHero: "Take out of campaign", error: "That change couldn't be saved. Try again.",
    nameRequired: "Enter a campaign name.",
    invites: "Invite links", createInvite: "Create invite link", inviteHint: "Anyone who opens the link and signs in joins as a player. Links expire after 7 days.",
    journal: "Encounter journal", map: "Battle map",
    copyLink: "Copy link", copied: "Copied", inviteCopied: "Invitation copied. Paste it in your group chat.",
    copyManual: "Copy this link", copyManualBody: "Your browser didn't let us copy it. Select the link and copy it by hand.", inviteCreated: "New invite link ready.", share: "Share", shareTitle: (c: string) => `Join "${c}" on Grimoire`,
    shareMessage: (owner: string, c: string) => `⚔️ ${owner} is calling you to the table! Join the campaign "${c}" on Grimoire, build your hero and roll initiative.\n\n🎲 Your invitation (valid 7 days):`, revoke: "Revoke", noInvites: "No active links.", expires: "Expires",
  },
  es: {
    eyebrow: "✦  LA CRÓNICA", title: "Campañas",
    subtitle: "Reúne a tu mesa bajo un mismo estandarte. Eres el DM de las campañas que creas y jugador en las que te unes.",
    newCampaign: "Nueva campaña", placeholder: "Nombre de la campaña", create: "Crear campaña",
    rename: "Editar", save: "Guardar", cancel: "Cancelar", remove: "Eliminar campaña", leave: "Salir de la campaña",
    description: "Descripción", descriptionPlaceholder: "Ambientación, horario, reglas de la casa…",
    deleteConfirm: (name: string) => `¿Eliminar «${name}»?`,
    deleteBody: "Los personajes se quedan con sus dueños. El diario de encuentros, los mapas de batalla y los enlaces de invitación se borran con la campaña, y no se puede deshacer.",
    deleted: (name: string) => `«${name}» se ha eliminado.`, created: (name: string) => `«${name}» está lista. Invita a tu mesa.`, saved: "Campaña actualizada.",
    leaveConfirm: (name: string) => `¿Salir de «${name}»?`, leaveBody: "Tus personajes saldrán de ella. Para volver necesitarás una nueva invitación.",
    left: (name: string) => `Has salido de «${name}».`,
    removeMemberConfirm: (name: string) => `¿Quitar a ${name} de la mesa?`, removeMemberBody: "Sus personajes salen de esta campaña; los conserva.",
    memberRemoved: (name: string) => `${name} ha dejado la mesa.`,
    empty: "Aún no hay campañas.", owner: (name: string) => `Dirigida por ${name}`,
    roles: { dm: "DM", player: "Jugador" } as Record<CampaignRole, string>,
    yourRole: "Tu papel", table: "La mesa", heroes: "Héroes",
    makeDm: "Hacer DM", makePlayer: "Hacer jugador", removeMember: "Quitar",
    addMember: "Añadir por correo o nombre", addAs: "como", add: "Añadir", added: (name: string) => `${name} se ha unido a la mesa.`,
    noHeroes: "Todavía no se han unido héroes a esta campaña.", addHero: "Trae uno de tus personajes",
    level: (level: number) => `Nivel ${level}`, by: (name: string) => `de ${name}`,
    viewSheet: "Ver ficha", removeHero: "Sacar de la campaña", error: "No se pudo guardar el cambio. Inténtalo de nuevo.",
    nameRequired: "Escribe un nombre para la campaña.",
    invites: "Enlaces de invitación", createInvite: "Crear enlace de invitación", inviteHint: "Quien abra el enlace e inicie sesión se une como jugador. Los enlaces caducan a los 7 días.",
    journal: "Diario de encuentros", map: "Mapa de batalla",
    copyLink: "Copiar enlace", copied: "Copiado", inviteCopied: "Invitación copiada. Pégala en el chat de tu grupo.",
    copyManual: "Copia este enlace", copyManualBody: "Tu navegador no nos deja copiarlo. Selecciona el enlace y cópialo a mano.", inviteCreated: "Nuevo enlace de invitación listo.", share: "Compartir", shareTitle: (c: string) => `Únete a «${c}» en Grimoire`,
    shareMessage: (owner: string, c: string) => `⚔️ ¡${owner} te convoca a la mesa! Únete a la campaña «${c}» en Grimoire, crea a tu héroe y prepárate para tirar iniciativa.\n\n🎲 Tu invitación (válida 7 días):`, revoke: "Revocar", noInvites: "No hay enlaces activos.", expires: "Caduca",
  },
};

export default function CampaignManager({ me, campaigns, characters, locale, onChanged, onOpenCharacter }: Props) {
  const t = text[locale];
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [busy, setBusy] = useState(false);
  /** Only form validation stays inline; the outcome of an action is a toast, since the button may be far down the page. */
  const [error, setError] = useState("");
  const confirm = useConfirm();
  const toast = useToast();

  async function run(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setError("");
    try {
      await action();
      await onChanged();
      if (success) toast.success(success);
      return true;
    } catch {
      toast.error(t.error);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function removeCampaign(campaign: Campaign) {
    if (!await confirm({ title: t.deleteConfirm(campaign.name), message: t.deleteBody, confirmLabel: t.remove, tone: "danger" })) return;
    await run(() => api(`/api/campaigns/${campaign.id}`, { method: "DELETE" }), t.deleted(campaign.name));
  }

  async function leaveCampaign(campaign: Campaign) {
    if (!await confirm({ title: t.leaveConfirm(campaign.name), message: t.leaveBody, confirmLabel: t.leave, tone: "danger" })) return;
    await run(() => api(`/api/campaigns/${campaign.id}/members/${me.id}`, { method: "DELETE" }), t.left(campaign.name));
  }

  async function removeMember(campaign: Campaign, member: { userId: string; name: string }) {
    if (!await confirm({ title: t.removeMemberConfirm(member.name), message: t.removeMemberBody, confirmLabel: t.removeMember, tone: "danger" })) return;
    await run(() => api(`/api/campaigns/${campaign.id}/members/${member.userId}`, { method: "DELETE" }), t.memberRemoved(member.name));
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) { setError(t.nameRequired); return; }
    if (await run(() => api("/api/campaigns", { method: "POST", body: { name, description: "" } }), t.created(name))) setNewName("");
  }

  async function saveCampaign(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const name = editName.trim();
    if (!name) { setError(t.nameRequired); return; }
    if (await run(() => api(`/api/campaigns/${id}`, { method: "PATCH", body: { name, description: editDescription } }), t.saved)) setEditingId(null);
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
      <h1 id="campaign-manager-heading">{t.title}</h1>
      <p>{t.subtitle}</p>
    </header>

    <form className={styles.createForm} onSubmit={(event) => void createCampaign(event)}>
      <label htmlFor="campaign-name">{t.newCampaign}</label>
      <div className={styles.createRow}>
        <input id="campaign-name" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={80} placeholder={t.placeholder} />
        <button type="submit" disabled={busy}>{busy ? <Spinner /> : "✧ "}{t.create}</button>
      </div>
    </form>

    {error && <p className={styles.error} role="alert">{error}</p>}
    {!campaigns.length ? <p className={styles.empty}>{t.empty}</p> : <div className={styles.campaignList}>
      {campaigns.map((campaign) => {
        const heroes = characters.filter((character) => character.campaignId === campaign.id);
        const myLooseCharacters = characters.filter((character) => character.editable && character.campaignId !== campaign.id);
        const canDelete = campaign.isOwner || me.role === "admin";
        return <article className={styles.campaign} key={campaign.id}>
          <div className={styles.campaignHead}>
            {editingId === campaign.id ? <form className={styles.renameForm} onSubmit={(event) => void saveCampaign(event, campaign.id)}>
              <input aria-label={t.newCampaign} autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={80} />
              <textarea aria-label={t.description} className={styles.descriptionInput} value={editDescription} maxLength={1000} rows={2}
                placeholder={t.descriptionPlaceholder} onChange={(event) => setEditDescription(event.target.value)} />
              <button type="submit" disabled={busy}>{busy && <Spinner />}{t.save}</button>
              <button type="button" className={styles.quietButton} onClick={() => { setEditingId(null); setError(""); }}>{t.cancel}</button>
            </form> : <>
              <div>
                <h2>{campaign.name}</h2>
                <span className={styles.memberCount}>{t.owner(campaign.ownerName)} · {t.yourRole}: {campaign.myRole ? t.roles[campaign.myRole] : "—"}</span>
                {campaign.description && <p className={styles.description}>{campaign.description}</p>}
              </div>
              <div className={styles.actions}>
                {campaign.myRole && <Link className={styles.mapLink} href={`/map/${encodeURIComponent(campaign.id)}`}>{t.map}</Link>}
                {campaign.canManage && <button type="button" className={styles.quietButton} onClick={() => { setEditingId(campaign.id); setEditName(campaign.name); setEditDescription(campaign.description); setError(""); }}>{t.rename}</button>}
                {canDelete && <button type="button" className={styles.deleteButton} disabled={busy} onClick={() => void removeCampaign(campaign)}>{t.remove}</button>}
                {!campaign.isOwner && campaign.myRole && <button type="button" className={styles.quietButton} disabled={busy} onClick={() => void leaveCampaign(campaign)}>{t.leave}</button>}
              </div>
            </>}
          </div>

          <h3 className={styles.subheading}>{t.table}</h3>
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
                  onClick={() => void removeMember(campaign, member)}>×</button>
              </>}
            </li>;
          })}</ul>

          {campaign.canManage && <AddMember key={campaign.members.length} campaignId={campaign.id} locale={locale} onAdded={onChanged} />}

          {campaign.canManage && <InvitePanel campaignId={campaign.id} campaignName={campaign.name} ownerName={campaign.ownerName} locale={locale} />}

          {campaign.canManage && <details className={styles.journalBox}>
            <summary className={styles.subheading}>{t.journal}</summary>
            <EncounterJournal campaign={campaign} locale={locale} />
          </details>}

          <h3 className={styles.subheading}>{t.heroes}</h3>
          {heroes.length ? <ul className={styles.memberList}>{heroes.map((character) => <li key={character.id}>
            <span className={styles.sigle}>✦</span>
            <span className={styles.heroName}>{onOpenCharacter ? <Link className={styles.heroLink} href={`/characters/${encodeURIComponent(character.id)}`}>{character.name}</Link> : character.name}<small>{t.level(character.level)}{character.className ? ` · ${character.className}` : ""} · {t.by(character.ownerName)}</small></span>
            {onOpenCharacter && <button type="button" className={styles.quietButton} onClick={() => onOpenCharacter(character.id)} aria-label={`${t.viewSheet}: ${character.name}`}>{t.viewSheet}</button>}
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

function AddMember({ campaignId, locale, onAdded }: { campaignId: string; locale: Locale; onAdded: () => Promise<void> | void }) {
  const t = text[locale];
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<CampaignRole>("player");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const toast = useToast();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const { name } = await api<{ name: string }>(`/api/campaigns/${campaignId}/members`, { method: "POST", body: { query: query.trim(), role } });
      setQuery("");
      toast.success(t.added(name));
      await onAdded();
    } catch (cause) {
      // Kept next to the field: it usually says the name or email didn't match anyone.
      setMessage(cause instanceof ApiError && cause.status !== 403 ? cause.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <form className={styles.addMember} onSubmit={(event) => void submit(event)}>
      <span>{t.addMember}</span>
      <input aria-label={t.addMember} value={query} maxLength={254} onChange={(event) => setQuery(event.target.value)} />
      <span>{t.addAs}</span>
      <select aria-label={t.addAs} value={role} onChange={(event) => setRole(event.target.value as CampaignRole)}>
        <option value="player">{t.roles.player}</option>
        <option value="dm">{t.roles.dm}</option>
      </select>
      <button type="submit" disabled={busy || !query.trim()}>{busy && <Spinner />}{t.add}</button>
    </form>
    {message && <p className={styles.error} role="alert">{message}</p>}
  </>;
}

function InvitePanel({ campaignId, campaignName, ownerName, locale }: { campaignId: string; campaignName: string; ownerName: string; locale: Locale }) {
  const t = text[locale];
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const [canShare, setCanShare] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  useEffect(() => { setCanShare(typeof navigator.share === "function"); }, []);
  useEffect(() => {
    api<{ invites: Invite[] }>(`/api/campaigns/${campaignId}/invites`).then((data) => setInvites(data.invites)).catch(() => setInvites([]));
  }, [campaignId]);

  const linkFor = (invite: Invite) => `${window.location.origin}/?invite=${invite.token}`;

  async function change(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    try {
      await action();
      setInvites((await api<{ invites: Invite[] }>(`/api/campaigns/${campaignId}/invites`)).invites);
      if (success) toast.success(success);
    } catch {
      toast.error(t.error);
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
        const link = linkFor(invite);
        await confirm({
          title: t.copyManual, acknowledge: true,
          message: <><p>{t.copyManualBody}</p><input readOnly value={link} aria-label={t.copyManual} onFocus={(event) => event.target.select()} /></>,
        });
        return;
      }
    }
    toast.success(t.inviteCopied);
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
    <h3 className={styles.subheading}>{t.invites}</h3>
    <p className={styles.noMembers}>{t.inviteHint}</p>
    {invites.length ? <ul className={styles.memberList}>{invites.map((invite) => <li key={invite.id}>
      <span className={styles.sigle}>⚑</span>
      <span className={styles.heroName}>…{invite.token.slice(-6)}<small>{t.expires} {new Date(invite.expiresAt).toLocaleDateString(locale === "es" ? "es-ES" : "en-US")}</small></span>
      {canShare && <button type="button" className={styles.quietButton} onClick={() => void share(invite)}>{t.share}</button>}
      <button type="button" className={styles.quietButton} onClick={() => void copy(invite)}>{copiedId === invite.id ? t.copied : t.copyLink}</button>
      <button type="button" className={styles.quietButton} disabled={busy} onClick={() => void change(() => api(`/api/campaigns/${campaignId}/invites/${invite.id}`, { method: "DELETE" }))}>{t.revoke}</button>
    </li>)}</ul> : <p className={styles.noMembers}>{t.noInvites}</p>}
    <form className={styles.addMember} onSubmit={(event) => { event.preventDefault(); void change(() => api(`/api/campaigns/${campaignId}/invites`, { method: "POST" }), t.inviteCreated); }}>
      <button type="submit" disabled={busy}>{busy && <Spinner />}{t.createInvite}</button>
    </form>
  </>;
}
