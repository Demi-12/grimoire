import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MonsterStatBlock } from "@grimoire/shared/monster-api";
import type { AppUser } from "@grimoire/shared/permissions";
import type { HomebrewService } from "../homebrew/homebrew.service.js";
import type { MonstersService } from "../monsters/monsters.service.js";

const rows: unknown[] = [];
vi.mock("../database/db.js", () => ({ pool: { query: vi.fn(async () => ({ rows })) }, transaction: vi.fn() }));

const { CreaturesService } = await import("./creatures.service.js");

const user: AppUser = { id: "u1", name: "Dana", email: "dana@example.test", role: "user", status: "approved" };
const DRAKE_ID = "6f1c1e7a-3b5e-4c52-9a7e-0d4f5a1b2c3d";
const HIDDEN_ID = "0a9b8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d";
const drake: MonsterStatBlock = { name: "Drake", challenge_rating: 3, armor_class: 15, hit_points: 52, speed: { fly: "60 ft." } };
const old = ["frontline", "damage", "support"];
const row = (name: string, monsterSlug: string | null) => ({ id: name, name, xp: 450, source: "Test", monsterSlug, cr: null, type: null, roleTags: old });

describe("CreaturesService role tags", () => {
  const visibleStatBlocks = vi.fn(async (_user: AppUser, ids: string[]) => new Map(ids.filter((id) => id === DRAKE_ID).map((id) => [id, drake])));
  const catalogRoles = vi.fn((slug: string) => (slug === "goblin" ? (["scouting"] as const) : undefined));
  const service = new CreaturesService({ visibleStatBlocks } as unknown as HomebrewService, { catalogRoles } as unknown as MonstersService);

  beforeEach(() => { rows.length = 0; visibleStatBlocks.mockClear(); catalogRoles.mockClear(); });

  it("takes today's roles from the catalog and from homebrew the user may see, and leaves custom tags alone", async () => {
    rows.push(row("Goblin", "goblin"), row("Drake", `homebrew:${DRAKE_ID}`), row("Hidden", `homebrew:${HIDDEN_ID}`), row("Broken", "homebrew:nope"), row("Custom", null));
    const tags = Object.fromEntries((await service.listCreatures(user)).map((creature) => [creature.name, creature.roleTags]));
    expect(tags).toEqual({ Goblin: ["scouting"], Drake: ["scouting"], Hidden: ["frontline", "support"], Broken: ["frontline", "support"], Custom: old });
    expect(visibleStatBlocks).toHaveBeenCalledWith(user, [DRAKE_ID, HIDDEN_ID]);
    expect(catalogRoles.mock.calls.map(([slug]) => slug)).toEqual(["goblin"]);
  });

  it("drops the tags of a creature whose stat block has no role today", async () => {
    catalogRoles.mockReturnValueOnce([] as never);
    rows.push(row("Rat", "srd-2024_rat"));
    expect((await service.listCreatures(user))[0]).not.toHaveProperty("roleTags");
  });
});
