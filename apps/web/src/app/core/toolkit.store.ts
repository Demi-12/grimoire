import { computed, effect, inject, Injectable, signal, untracked } from "@angular/core";
import { Router } from "@angular/router";
import { byLastMap, readLastMaps } from "@grimoire/shared/last-map";
import { sampleCreatures, type Creature } from "@grimoire/shared/rules";
import { LEGACY_CHARACTERS_LOCATION, storageLocation } from "@grimoire/shared/storage";
import { authClient } from "./auth-client";
import { api, ApiError, type AdminUser, type Campaign, type CatalogCreature, type Character, type CharacterDraft, type InvitePreview, type Me } from "./api-client";
import { FeedbackService } from "./feedback.service";
import { I18nService } from "./i18n.service";
import { PreferencesService } from "./preferences.service";
import { SessionService } from "./session.service";

export type LocalImport = { characters: unknown[]; campaigns: unknown[]; creatures: unknown[] };

function readSaved<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Characters, campaigns and own-catalog creatures this browser saved before accounts were stored server-side. */
function findLocalData(accountId: string): LocalImport {
  const characters = new Map<string, unknown>();
  for (const key of [storageLocation("characters", accountId), storageLocation("characters"), LEGACY_CHARACTERS_LOCATION]) {
    const saved = readSaved<unknown>(key, []);
    for (const item of Array.isArray(saved) ? saved : []) {
      if (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string") characters.set((item as { id: string }).id, item);
    }
  }
  const campaigns = [storageLocation("campaigns", accountId), storageLocation("campaigns")].flatMap((key) => {
    const saved = readSaved<unknown>(key, []);
    return Array.isArray(saved) ? saved : [];
  });
  const creatures = new Map<string, unknown>();
  for (const key of [storageLocation("creatures", accountId), storageLocation("creatures")]) {
    const saved = readSaved<unknown>(key, []);
    for (const item of Array.isArray(saved) ? saved : []) {
      // Only the user's own entries; samples and bestiary picks are not worth copying.
      if (item && typeof item === "object" && (item as { source?: unknown }).source === "Catálogo propio") {
        const id = (item as { id?: unknown }).id;
        creatures.set(typeof id === "string" ? id : `anon-${creatures.size}`, item);
      }
    }
  }
  return { characters: [...characters.values()], campaigns, creatures: [...creatures.values()] };
}

const inviteKey = "grimoire.invite.v1";

/** Invite token from `?invite=` (kept in sessionStorage so it survives sign-up and approval). */
function takePendingInvite(): string | null {
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("invite");
    if (fromUrl) {
      window.sessionStorage.setItem(inviteKey, fromUrl);
      url.searchParams.delete("invite");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    return window.sessionStorage.getItem(inviteKey);
  } catch {
    return null;
  }
}

function clearPendingInvite() {
  try { window.sessionStorage.removeItem(inviteKey); } catch { /* nothing stored */ }
}

function toCreature(item: CatalogCreature): Creature {
  return { id: item.id, name: item.name, xp: item.xp, source: item.source, roleTags: item.roleTags as Creature["roleTags"], monsterSlug: item.monsterSlug };
}

/**
 * Everything the signed-in toolkit shares between its pages: the account (`me`), its characters, campaigns
 * and creature catalog, a pending campaign invitation, and the one-time import of data an old version saved
 * in the browser. ShellComponent decides what to draw from it; each page reads what it needs and calls its
 * actions. It lives for the whole visit, so moving between pages never reloads or loses this data.
 *
 * The live battle map (/map/:id) is a page of its own and does not use this store.
 */
@Injectable({ providedIn: "root" })
export class ToolkitStore {
  private readonly session = inject(SessionService);
  private readonly preferences = inject(PreferencesService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);
  private readonly t = inject(I18nService).t;

  readonly accountId = this.session.accountId;
  /**
   * better-auth sets `isPending` again on every refetch while signed out (sign-in, 2FA, passkey, tab focus).
   * Only the first check may show the skeleton: removing AuthPanel later would drop its step (e.g. the
   * 2FA code form) and what the person typed.
   */
  readonly sessionChecked = signal(false);

  readonly me = signal<Me | null>(null);
  /** The account id `/api/me` was last answered for ("" once signed out; null before the first answer). */
  readonly meLoadedFor = signal<string | null>(null);
  /** The account id whose characters, campaigns and catalog are loaded. */
  readonly dataLoadedFor = signal("");
  readonly loadError = signal("");

  readonly characters = signal<Character[]>([]);
  readonly campaigns = signal<Campaign[]>([]);
  readonly ownCreatures = signal<Creature[]>([]);
  readonly catalogError = signal("");
  /** Accounts waiting for approval (admins only), for the badge on the admin link. */
  readonly pendingCount = signal(0);

  readonly localImport = signal<LocalImport | null>(null);
  readonly importBusy = signal(false);

  readonly inviteToken = signal<string | null>(takePendingInvite());
  readonly invite = signal<InvitePreview | null>(null);
  readonly inviteBusy = signal(false);
  readonly inviteError = signal("");

  /** The encounters page's "your catalog" panel; kept here so it stays open while visiting other pages. */
  readonly showCatalog = signal(false);

  /** When each campaign's map was last opened here (read once per visit). */
  private readonly lastMaps = readLastMaps();

  readonly approved = computed(() => this.me()?.status === "approved");
  readonly isAdmin = computed(() => this.me()?.role === "admin");
  /** Samples are only a starting point for an empty catalog; they are never stored. */
  readonly creatures = computed(() => this.ownCreatures().length ? this.ownCreatures() : sampleCreatures);
  readonly ownCharacters = computed(() => this.characters().filter((character) => character.editable));
  /** Campaigns the person is a member of. */
  readonly memberCampaigns = computed(() => this.campaigns().filter((campaign) => campaign.myRole));
  /** Tables the person sits at, the one whose map they opened last first. */
  readonly tables = computed(() => byLastMap(this.memberCampaigns(), this.lastMaps));

  constructor() {
    effect(() => { if (!this.session.isPending()) this.sessionChecked.set(true); });

    // Load the account and its data whenever the signed-in account changes.
    effect((onCleanup) => {
      if (this.session.isPending()) return;
      const accountId = this.accountId();
      let cancelled = false;
      onCleanup(() => { cancelled = true; });
      untracked(() => { void this.loadAccount(accountId, () => cancelled); });
    });

    // A pending invitation is looked up once the account is approved.
    effect((onCleanup) => {
      const token = this.inviteToken();
      if (!token || !this.approved()) return;
      let cancelled = false;
      onCleanup(() => { cancelled = true; });
      untracked(() => {
        this.inviteError.set("");
        api<{ invite: InvitePreview }>(`/api/invites/${encodeURIComponent(token)}`)
          .then((data) => { if (!cancelled) this.invite.set(data.invite); })
          .catch(() => {
            if (cancelled) return;
            this.invite.set(null);
            this.inviteError.set(this.t("invite.invalid"));
            clearPendingInvite();
            this.inviteToken.set(null);
          });
      });
    });
  }

  private async loadAccount(accountId: string | undefined, isCancelled: () => boolean): Promise<void> {
    if (!accountId) { this.me.set(null); this.meLoadedFor.set(""); return; }
    this.loadError.set("");
    try {
      const { user } = await api<{ user: Me }>("/api/me");
      if (isCancelled()) return;
      this.me.set(user);
      if (user.preferences?.locale) this.preferences.locale.set(user.preferences.locale);
      if (user.preferences?.theme) this.preferences.theme.set(user.preferences.theme);
      if (user.status === "approved") {
        await this.reloadData();
        try {
          const data = await api<{ creatures: CatalogCreature[] }>("/api/creatures");
          if (!isCancelled()) this.ownCreatures.set(data.creatures.map(toCreature));
        } catch {
          if (!isCancelled()) this.catalogError.set("load");
        }
        if (user.role === "admin") {
          api<{ users: AdminUser[] }>("/api/admin/users")
            .then((data) => { if (!isCancelled()) this.pendingCount.set(data.users.filter((item) => item.status === "pending").length); })
            .catch(() => undefined);
        }
        const done = user.preferences?.legacyImported ?? true;
        const local = done ? null : findLocalData(user.id);
        this.localImport.set(local && (local.characters.length || local.campaigns.length || local.creatures.length) ? local : null);
      }
    } catch (cause) {
      if (isCancelled()) return;
      if (cause instanceof ApiError && cause.status === 401) this.me.set(null);
      else this.loadError.set(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (!isCancelled()) { this.meLoadedFor.set(accountId); this.dataLoadedFor.set(accountId); }
    }
  }

  /** Characters and campaigns again from the server (after any change to either). */
  readonly reloadData = async (): Promise<void> => {
    const [characterData, campaignData] = await Promise.all([
      api<{ characters: Character[] }>("/api/characters"),
      api<{ campaigns: Campaign[] }>("/api/campaigns"),
    ]);
    this.characters.set(characterData.characters);
    this.campaigns.set(campaignData.campaigns);
  };

  /** After restoring a backup: everything, catalog included. */
  readonly reloadAfterRestore = async (): Promise<void> => {
    await this.reloadData();
    const data = await api<{ creatures: CatalogCreature[] }>("/api/creatures");
    this.ownCreatures.set(data.creatures.map(toCreature));
  };

  readonly saveCharacter = async (draft: CharacterDraft, id?: string): Promise<void> => {
    await api(id ? `/api/characters/${id}` : "/api/characters", { method: id ? "PUT" : "POST", body: draft });
    await this.reloadData();
  };

  readonly deleteCharacter = async (id: string): Promise<void> => {
    await api(`/api/characters/${id}`, { method: "DELETE" });
    await this.reloadData();
  };

  readonly acceptInvite = async (): Promise<void> => {
    const token = this.inviteToken();
    if (!token) return;
    this.inviteBusy.set(true);
    this.inviteError.set("");
    try {
      await api(`/api/invites/${encodeURIComponent(token)}`, { method: "POST" });
      const joined = this.invite()?.campaignName;
      clearPendingInvite();
      this.inviteToken.set(null);
      this.invite.set(null);
      await this.reloadData();
      void this.router.navigateByUrl("/campaigns");
      if (joined) this.feedback.toast.success(this.t("invite.joined", { campaign: joined }));
    } catch {
      this.inviteError.set(this.t("invite.error"));
    } finally {
      this.inviteBusy.set(false);
    }
  };

  readonly declineInvite = (): void => {
    clearPendingInvite();
    this.inviteToken.set(null);
    this.invite.set(null);
  };

  /** The browser's old data was imported or declined: don't offer it again. */
  readonly finishImport = (): void => {
    api("/api/me", { method: "PATCH", body: { legacyImported: true } }).catch(() => undefined);
    this.localImport.set(null);
  };

  readonly runImport = async (): Promise<void> => {
    const local = this.localImport();
    if (!local) return;
    this.importBusy.set(true);
    try {
      const { imported } = await api<{ imported: { characters: number; campaigns: number; creatures?: number } }>("/api/import", { method: "POST", body: local });
      this.finishImport();
      this.feedback.toast.success(this.t("import.done", { characters: imported.characters, campaigns: imported.campaigns, creatures: imported.creatures ?? 0 }));
      await this.reloadData();
      await this.loadCreatures();
    } catch {
      this.feedback.toast.error(this.t("import.error"));
    } finally {
      this.importBusy.set(false);
    }
  };

  private async loadCreatures(): Promise<void> {
    try {
      const data = await api<{ creatures: CatalogCreature[] }>("/api/creatures");
      this.ownCreatures.set(data.creatures.map(toCreature));
    } catch { /* keep the current list */ }
  }

  /** Saves a creature server-side (deduplicated by monsterSlug there) and merges the stored copy into the list. */
  readonly saveCreature = async (input: Omit<CatalogCreature, "id">): Promise<boolean> => {
    try {
      const { creature } = await api<{ creature: CatalogCreature }>("/api/creatures", { method: "POST", body: input });
      this.ownCreatures.update((current) => [toCreature(creature), ...current.filter((item) => item.id !== creature.id)]);
      this.feedback.toast.success(this.t("catalog.added", { name: creature.name }));
      return true;
    } catch {
      this.feedback.toast.error(this.t("catalog.error.save"));
      return false;
    }
  };

  readonly removeCreature = async (creature: Creature): Promise<void> => {
    try {
      await api(`/api/creatures/${encodeURIComponent(creature.id)}`, { method: "DELETE" });
      this.ownCreatures.update((current) => current.filter((item) => item.id !== creature.id));
      this.feedback.toast.success(this.t("catalog.removed", { name: creature.name }));
    } catch {
      this.feedback.toast.error(this.t("catalog.error.remove"));
    }
  };

  readonly signOut = async (): Promise<void> => {
    await authClient.signOut();
    window.location.assign("/");
  };
}
