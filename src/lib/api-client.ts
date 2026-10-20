"use client";

import type { AccountStatus, CampaignRole, SiteRole } from "@/lib/permissions";
import type { AbilityScores } from "@/lib/rules";
import type { CharacterBuild } from "@/lib/character-sheet";

/** Shapes returned by the app's API routes (mirrors src/lib/data.ts). */
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

export interface Me { id: string; name: string; email: string; role: SiteRole; status: AccountStatus }
export interface DirectoryUser { id: string; name: string; role: SiteRole }
export interface AdminUser {
  id: string; name: string; email: string; role: SiteRole; status: AccountStatus;
  emailVerified: boolean; twoFactorEnabled: boolean; createdAt: string; campaignCount: number; characterCount: number;
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** JSON fetch against the app's own API with the session cookie; throws ApiError on failure. */
export async function api<T = void>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? "GET",
    credentials: "same-origin",
    headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = await response.json() as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // Keep the status text when the body isn't JSON.
    }
    throw new ApiError(response.status, message);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}
