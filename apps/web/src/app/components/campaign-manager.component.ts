import {
  afterRenderEffect, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, signal, untracked, viewChild,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { characterIdentity } from "@grimoire/shared/character-view";
import type { CampaignRole } from "@grimoire/shared/permissions";
import { api, type Campaign, type Character, type Invite, type Me } from "../core/api-client";
import { FeedbackService } from "../core/feedback.service";
import { I18nService } from "../core/i18n.service";
import { EncounterJournalComponent } from "./encounter-journal.component";
import { PageHeaderComponent } from "./page-header.component";
import { SpinnerComponent } from "./skeleton.component";

/**
 * `/campaigns`: the person's campaigns, each with its table (members and roles), heroes, invite links,
 * the DM's encounter journal and the delete/leave actions. `AddMemberComponent` and `InvitePanelComponent`
 * are pieces of a campaign card with their own state and requests.
 */

/* Rows of the table, heroes and invite links: flat lines with a hairline between them, not boxes inside the card. */
const rowList = "m-0 grid list-none p-0";
const row = "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-2.5 last:border-b-0";
const sigil = "w-5 flex-none text-center text-lg text-gilt-text";
const rowName = "min-w-0 flex-1 font-bold [overflow-wrap:anywhere] text-ink";
const rowMeta = "mt-0.5 block font-label text-xs font-normal text-muted";
const removeButton = "button button-quiet button-sm min-w-9 px-0 text-lg leading-none max-[650px]:min-w-11";
const hint = "my-2 text-sm text-muted italic";
const errorBox = "my-3 rounded-control border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger";

const text = {
  en: {
    eyebrow: "The chronicle", title: "Campaigns",
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
    yourRole: "Your role", you: "you", table: "The table", heroes: "Heroes",
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
    eyebrow: "La crónica", title: "Campañas",
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
    yourRole: "Tu papel", you: "tú", table: "La mesa", heroes: "Héroes",
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

/** Add someone to a campaign's table by exact email or name. */
@Component({
  selector: "app-add-member",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
  host: { class: "contents" },
  template: `
    <form class="mt-3 flex flex-wrap items-center gap-2" (submit)="submit($event)">
      <label class="flex min-w-0 flex-[1_1_220px] flex-col gap-1"><span class="font-label text-xs font-bold tracking-[.1em] text-muted uppercase">{{ t().addMember }}</span>
        <input #queryInput class="field" [value]="query()" maxlength="254" (input)="query.set(queryInput.value)" /></label>
      <label class="flex flex-col gap-1"><span class="font-label text-xs font-bold tracking-[.1em] text-muted uppercase">{{ t().addAs }}</span>
        <select #roleSelect class="field" (change)="setRole(roleSelect.value)">
          <option value="player" [selected]="role() === 'player'">{{ t().roles.player }}</option>
          <option value="dm" [selected]="role() === 'dm'">{{ t().roles.dm }}</option>
        </select></label>
      <button type="submit" class="button button-quiet self-end" [disabled]="busy() || !query().trim()">@if (busy()) {<span appSpinner></span>}{{ t().add }}</button>
    </form>
    @if (message()) { <p [class]="errorBox" role="alert">{{ message() }}</p> }
  `,
})
export class AddMemberComponent {
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(FeedbackService).toast;
  protected readonly t = computed(() => text[this.i18n.locale()]);

  readonly campaignId = input.required<string>();
  readonly onAdded = input.required<() => Promise<void> | void>();

  protected readonly query = signal("");
  protected readonly role = signal<CampaignRole>("player");
  protected readonly busy = signal(false);
  protected readonly message = signal("");
  protected readonly errorBox = errorBox;

  protected setRole(value: string): void {
    this.role.set(value === "dm" ? "dm" : "player");
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.query().trim()) return;
    this.busy.set(true);
    this.message.set("");
    try {
      const { name } = await api<{ name: string }>(`/api/campaigns/${this.campaignId()}/members`, { method: "POST", body: { query: this.query().trim(), role: this.role() } });
      this.query.set("");
      this.toast.success(this.t().added(name));
      await this.onAdded()();
    } catch (cause) {
      // Kept next to the field: it usually says the name or email didn't match anyone.
      this.message.set(this.i18n.errorText(cause, this.t().error));
    } finally {
      this.busy.set(false);
    }
  }
}

/** A campaign's invite links: list, copy or share, revoke, create. */
@Component({
  selector: "app-invite-panel",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
  host: { class: "contents" },
  template: `
    <h3 class="subheading">{{ t().invites }}</h3>
    <p [class]="hint">{{ t().inviteHint }}</p>
    @if (invites().length) {
      <ul [class]="rowList">
        @for (invite of invites(); track invite.id) {
          <li [class]="row">
            <span [class]="sigil" aria-hidden="true">⚑</span>
            <span [class]="rowName">…{{ invite.token.slice(-6) }}<small [class]="rowMeta">{{ t().expires }} {{ expiry(invite) }}</small></span>
            @if (canShare()) { <button type="button" class="button button-quiet button-sm" (click)="share(invite)">{{ t().share }}</button> }
            <button type="button" class="button button-quiet button-sm" (click)="copy(invite)">{{ copiedId() === invite.id ? t().copied : t().copyLink }}</button>
            <button type="button" class="button button-quiet button-sm" [disabled]="busy()" (click)="revoke(invite)">{{ t().revoke }}</button>
          </li>
        }
      </ul>
    } @else {
      <p [class]="hint">{{ t().noInvites }}</p>
    }
    <form class="mt-3" (submit)="create($event)">
      <button type="submit" class="button button-quiet" [disabled]="busy()">@if (busy()) {<span appSpinner></span>}{{ t().createInvite }}</button>
    </form>
  `,
})
export class InvitePanelComponent {
  private readonly i18n = inject(I18nService);
  private readonly feedback = inject(FeedbackService);
  protected readonly t = computed(() => text[this.i18n.locale()]);

  readonly campaignId = input.required<string>();
  readonly campaignName = input.required<string>();
  readonly ownerName = input.required<string>();

  protected readonly invites = signal<Invite[]>([]);
  protected readonly busy = signal(false);
  protected readonly copiedId = signal("");
  protected readonly canShare = signal(typeof navigator.share === "function");

  protected readonly rowList = rowList;
  protected readonly row = row;
  protected readonly sigil = sigil;
  protected readonly rowName = rowName;
  protected readonly rowMeta = rowMeta;
  protected readonly hint = hint;

  constructor() {
    effect(() => {
      const campaignId = this.campaignId();
      untracked(() => {
        api<{ invites: Invite[] }>(`/api/campaigns/${campaignId}/invites`).then((data) => this.invites.set(data.invites)).catch(() => this.invites.set([]));
      });
    });
  }

  protected expiry(invite: Invite): string {
    return new Date(invite.expiresAt).toLocaleDateString(this.i18n.locale() === "es" ? "es-ES" : "en-US");
  }

  private linkFor(invite: Invite): string {
    return `${window.location.origin}/?invite=${invite.token}`;
  }

  private messageFor(invite: Invite): string {
    return `${this.t().shareMessage(this.ownerName(), this.campaignName())}\n${this.linkFor(invite)}`;
  }

  private async change(action: () => Promise<unknown>, success?: string): Promise<void> {
    this.busy.set(true);
    try {
      await action();
      this.invites.set((await api<{ invites: Invite[] }>(`/api/campaigns/${this.campaignId()}/invites`)).invites);
      if (success) this.feedback.toast.success(success);
    } catch {
      this.feedback.toast.error(this.t().error);
    } finally {
      this.busy.set(false);
    }
  }

  protected revoke(invite: Invite): Promise<void> {
    return this.change(() => api(`/api/campaigns/${this.campaignId()}/invites/${invite.id}`, { method: "DELETE" }));
  }

  protected create(event: Event): Promise<void> {
    event.preventDefault();
    return this.change(() => api(`/api/campaigns/${this.campaignId()}/invites`, { method: "POST" }), this.t().inviteCreated);
  }

  protected async copy(invite: Invite): Promise<void> {
    const t = this.t();
    const message = this.messageFor(invite);
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
        const link = this.linkFor(invite);
        await this.feedback.confirm({ title: t.copyManual, acknowledge: true, message: t.copyManualBody, copyField: { value: link, label: t.copyManual } });
        return;
      }
    }
    this.feedback.toast.success(t.inviteCopied);
    this.copiedId.set(invite.id);
    window.setTimeout(() => this.copiedId.update((current) => (current === invite.id ? "" : current)), 2500);
  }

  protected async share(invite: Invite): Promise<void> {
    const t = this.t();
    try {
      await navigator.share({ title: t.shareTitle(this.campaignName()), text: t.shareMessage(this.ownerName(), this.campaignName()), url: this.linkFor(invite) });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) await this.copy(invite);
    }
  }
}

/** The campaigns screen: create, edit, manage the table and heroes, invite, keep the encounter journal, delete or leave. */
@Component({
  selector: "app-campaign-manager",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeaderComponent, SpinnerComponent, EncounterJournalComponent, AddMemberComponent, InvitePanelComponent],
  host: { class: "contents" },
  templateUrl: "./campaign-manager.component.html",
})
export class CampaignManagerComponent {
  private readonly i18n = inject(I18nService);
  private readonly feedback = inject(FeedbackService);
  protected readonly t = computed(() => text[this.i18n.locale()]);

  readonly me = input.required<Me>();
  readonly campaigns = input.required<Campaign[]>();
  /** Every character the user can see: their own plus those in shared campaigns. */
  readonly characters = input.required<Character[]>();
  /** Reload campaigns and characters after a change. */
  readonly onChanged = input.required<() => Promise<void>>();
  /** Open a character's full sheet. */
  readonly onOpenCharacter = input<(id: string) => void>();

  protected readonly newName = signal("");
  protected readonly editingId = signal<string | null>(null);
  protected readonly editName = signal("");
  protected readonly editDescription = signal("");
  protected readonly busy = signal(false);
  /** Only form validation stays inline; the outcome of an action is a toast, since the button may be far down the page. */
  protected readonly error = signal("");

  /** The name field of the campaign being edited, focused when the form opens. */
  private readonly editNameInput = viewChild<ElementRef<HTMLInputElement>>("editNameInput");

  protected readonly cards = computed(() => {
    const locale = this.i18n.locale();
    const characters = this.characters();
    const me = this.me();
    return this.campaigns().map((campaign) => ({
      campaign,
      heroes: characters.filter((character) => character.campaignId === campaign.id)
        .map((character) => ({ character, className: characterIdentity(character, locale).className })),
      myLooseCharacters: characters.filter((character) => character.editable && character.campaignId !== campaign.id),
      canDelete: campaign.isOwner || me.role === "admin",
      leaves: !campaign.isOwner && !!campaign.myRole,
    }));
  });

  protected readonly rowList = rowList;
  protected readonly row = row;
  protected readonly sigil = sigil;
  protected readonly rowName = rowName;
  protected readonly rowMeta = rowMeta;
  protected readonly removeButton = removeButton;
  protected readonly hint = hint;
  protected readonly errorBox = errorBox;

  constructor() {
    afterRenderEffect(() => {
      this.editNameInput()?.nativeElement.focus();
    });
  }

  private async run(action: () => Promise<unknown>, success?: string): Promise<boolean> {
    this.busy.set(true);
    this.error.set("");
    try {
      await action();
      await this.onChanged()();
      if (success) this.feedback.toast.success(success);
      return true;
    } catch {
      this.feedback.toast.error(this.t().error);
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  protected async removeCampaign(campaign: Campaign): Promise<void> {
    const t = this.t();
    if (!await this.feedback.confirm({ title: t.deleteConfirm(campaign.name), message: t.deleteBody, confirmLabel: t.remove, tone: "danger" })) return;
    await this.run(() => api(`/api/campaigns/${campaign.id}`, { method: "DELETE" }), t.deleted(campaign.name));
  }

  protected async leaveCampaign(campaign: Campaign): Promise<void> {
    const t = this.t();
    if (!await this.feedback.confirm({ title: t.leaveConfirm(campaign.name), message: t.leaveBody, confirmLabel: t.leave, tone: "danger" })) return;
    await this.run(() => api(`/api/campaigns/${campaign.id}/members/${this.me().id}`, { method: "DELETE" }), t.left(campaign.name));
  }

  protected async removeMember(campaign: Campaign, member: { userId: string; name: string }): Promise<void> {
    const t = this.t();
    if (!await this.feedback.confirm({ title: t.removeMemberConfirm(member.name), message: t.removeMemberBody, confirmLabel: t.removeMember, tone: "danger" })) return;
    await this.run(() => api(`/api/campaigns/${campaign.id}/members/${member.userId}`, { method: "DELETE" }), t.memberRemoved(member.name));
  }

  protected async toggleRole(campaign: Campaign, member: { userId: string; role: CampaignRole }): Promise<void> {
    await this.run(() => api(`/api/campaigns/${campaign.id}/members`, { method: "POST", body: { userId: member.userId, role: member.role === "dm" ? "player" : "dm" } }));
  }

  protected async removeHero(campaign: Campaign, character: Character): Promise<void> {
    await this.run(() => api(`/api/campaigns/${campaign.id}/characters/${character.id}`, { method: "DELETE" }));
  }

  protected async createCampaign(event: Event): Promise<void> {
    event.preventDefault();
    const t = this.t();
    const name = this.newName().trim();
    if (!name) { this.error.set(t.nameRequired); return; }
    if (await this.run(() => api("/api/campaigns", { method: "POST", body: { name, description: "" } }), t.created(name))) this.newName.set("");
  }

  protected async saveCampaign(event: Event, id: string): Promise<void> {
    event.preventDefault();
    const t = this.t();
    const name = this.editName().trim();
    if (!name) { this.error.set(t.nameRequired); return; }
    if (await this.run(() => api(`/api/campaigns/${id}`, { method: "PATCH", body: { name, description: this.editDescription() } }), t.saved)) this.editingId.set(null);
  }

  protected startEditing(campaign: Campaign): void {
    this.editingId.set(campaign.id);
    this.editName.set(campaign.name);
    this.editDescription.set(campaign.description);
    this.error.set("");
  }

  protected cancelEditing(): void {
    this.editingId.set(null);
    this.error.set("");
  }

  protected openCharacter(id: string): void {
    this.onOpenCharacter()?.(id);
  }

  /** The "bring a character" picker always shows its placeholder: picking a character moves it, then the list goes back. */
  protected addHero(select: HTMLSelectElement, campaign: Campaign, candidates: Character[]): void {
    const character = candidates.find((item) => item.id === select.value);
    select.value = "";
    if (character) void this.moveCharacter(character, campaign.id);
  }

  private moveCharacter(character: Character, campaignId: string | null): Promise<boolean> {
    return this.run(() => api(`/api/characters/${character.id}`, {
      method: "PUT",
      body: {
        name: character.name, level: character.level, className: character.className, species: character.species,
        background: character.background, scores: character.scores, notes: character.notes, build: character.build, campaignId,
      },
    }));
  }
}
