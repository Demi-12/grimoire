/**
 * Shapes the API returns to the browser (the JSON of the data layer in apps/api/src/data). Shared so the Angular
 * client and the NestJS controllers describe a response with the same type. Types only: no runtime code.
 */
import type { AccountStatus, CampaignRole, SiteRole } from "./permissions.js";
import type { AbilityScores } from "./rules.js";
import type { CharacterBuild } from "./character-sheet.js";
import type { HomebrewVisibility } from "./homebrew.js";
import type { MonsterRole, MonsterStatBlock } from "./monster-api.js";

export interface Character {
  id: string;
  ownerId: string;
  ownerName: string;
  campaignId: string | null;
  name: string;
  level: number;
  className: string;
  species: string;
  background: string;
  scores: AbilityScores;
  notes: string;
  /** Present for characters made with the 2024 step-by-step creator. */
  build?: CharacterBuild;
  editable: boolean;
}

export type CharacterDraft = Omit<Character, "id" | "ownerId" | "ownerName" | "editable">;

export interface Campaign {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  myRole: CampaignRole | null;
  isOwner: boolean;
  canManage: boolean;
  members: { userId: string; name: string; role: CampaignRole }[];
}

export interface Invite { id: string; token: string; createdByName: string; createdAt: string; expiresAt: string }
export interface InvitePreview { campaignId: string; campaignName: string; description: string; ownerName: string; alreadyMember: boolean }

export interface Preferences { locale: "en" | "es" | null; theme: "light" | "dark" | null; legacyImported: boolean }
export interface Me { id: string; name: string; email: string; role: SiteRole; status: AccountStatus; preferences?: Preferences }

/** A creature in the account's personal catalog. */
export interface CatalogCreature {
  id: string; name: string; xp: number; source: string;
  monsterSlug?: string; cr?: number; type?: string; roleTags?: string[];
}

/** A homebrew monster as returned by /api/homebrew (mirrors HomebrewView in src/lib/data.ts). */
export interface HomebrewMonster {
  id: string; ownerId: string; ownerName: string; mine: boolean;
  name: string; cr: number; xp: number; type: string; roleTags: MonsterRole[];
  visibility: HomebrewVisibility; locked: boolean; campaignIds: string[];
  statBlock: MonsterStatBlock; updatedAt: string;
}

export type EncounterStatus = "planned" | "played";
export interface EncounterLine { name: string; xp: number; count: number; monsterSlug?: string; cr?: number; type?: string; source?: string }
/** A saved encounter in a campaign's journal (DM-only). */
export interface SavedEncounter {
  id: string; campaignId: string; createdByName: string | null; title: string; notes: string; status: EncounterStatus;
  difficulty: "low" | "moderate" | "high"; budget: number; totalXp: number; partyLevels: number[];
  lines: EncounterLine[]; playedAt: string | null; createdAt: string; updatedAt: string;
}
export type EncounterDraft = Pick<SavedEncounter, "title" | "notes" | "status" | "difficulty" | "budget" | "totalXp" | "partyLevels" | "lines">;
export interface AdminUser {
  id: string; name: string; email: string; role: SiteRole; status: AccountStatus;
  emailVerified: boolean; twoFactorEnabled: boolean; createdAt: string; campaignCount: number; characterCount: number;
}

/** A saved copy of a campaign's battle map, as the DM's list shows it. */
export interface MapSaveSummary {
  id: string; name: string; cols: number; rows: number; tokens: number; walls: number;
  hasBackground: boolean; createdByName: string | null; createdAt: string;
}
