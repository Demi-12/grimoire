"use client";

import { useEffect, useState } from "react";
import { api, type HomebrewMonster } from "@/lib/api-client";
import { isMonsterSlug } from "@/lib/battle-map";
import { homebrewSlug } from "@/lib/homebrew";
import { fetchMonster, fetchMonsterCatalog, type MonsterStatBlock } from "@/lib/monster-api";

/**
 * Finding the stat block behind a monster token, so the map can take its speed, initiative bonus and size from it
 * instead of the DM typing them in. Bestiary (Open5e) creatures and the homebrew monsters the DM can see.
 */

/** A creature the DM can link a token to. */
export interface CreatureChoice { slug: string; name: string; source?: string }

const blocks = new Map<string, Promise<MonsterStatBlock | undefined>>();
const found = new Map<string, Promise<string | undefined>>();
let homebrew: { at: number; list: Promise<HomebrewMonster[]> } | null = null;
const HOMEBREW_TTL_MS = 60_000;

/** The name a token was given without the number added to tell copies apart ("Goblin 3" → "Goblin"). */
export const baseName = (label: string) => label.replace(/\s*\d+$/, "").trim();
const key = (name: string) => baseName(name).toLocaleLowerCase("en-US");

function homebrewList(): Promise<HomebrewMonster[]> {
  if (!homebrew || Date.now() - homebrew.at > HOMEBREW_TTL_MS) {
    const list = api<{ monsters: HomebrewMonster[] }>("/api/homebrew").then((data) => data.monsters).catch(() => { homebrew = null; return []; });
    homebrew = { at: Date.now(), list };
  }
  return homebrew.list;
}

/** A stat block by slug, fetched once per page. */
export function loadCreature(slug: string): Promise<MonsterStatBlock | undefined> {
  let block = blocks.get(slug);
  if (!block) {
    block = fetchMonster(slug).catch(() => { blocks.delete(slug); return undefined; });
    blocks.set(slug, block);
  }
  return block;
}

/** Homebrew monsters and bestiary creatures whose name contains `query`; homebrew first. */
export async function searchCreatures(query: string, signal?: AbortSignal, limit = 8): Promise<CreatureChoice[]> {
  const search = query.trim();
  if (search.length < 2) return [];
  const lower = search.toLocaleLowerCase("en-US");
  const [own, catalog] = await Promise.all([
    homebrewList(),
    fetchMonsterCatalog({ search, limit: 50 }, signal).then((data) => data.results).catch((cause) => { if (signal?.aborted) throw cause; return []; }),
  ]);
  const choices: CreatureChoice[] = [
    ...own.filter((monster) => monster.name.toLocaleLowerCase("en-US").includes(lower))
      .map((monster) => ({ slug: homebrewSlug(monster.id), name: monster.name, source: "Homebrew" })),
    ...catalog.filter((entry) => isMonsterSlug(entry.index)).map((entry) => ({ slug: entry.index, name: entry.name, ...(entry.source ? { source: entry.source } : {}) })),
  ];
  // Exact names first, so "Goblin" comes before "Goblin Boss".
  const exact = (choice: CreatureChoice) => choice.name.toLocaleLowerCase("en-US") === lower ? 0 : 1;
  return choices.map((choice, index) => ({ choice, index })).sort((a, b) => exact(a.choice) - exact(b.choice) || a.index - b.index)
    .slice(0, limit).map(({ choice }) => choice);
}

/** Of several books with the same creature, prefer the 2024 rules, then the 2014 SRD. */
const bookRank = (slug: string) => slug.startsWith("homebrew:") ? 0 : slug.startsWith("srd-2024_") ? 1 : slug.startsWith("srd_") ? 2 : 3;

/**
 * The creature a monster typed in by hand most likely is: one whose name is exactly the token's (copy number
 * left out, any case). Undefined when there is none, so a made-up name never picks a random stat block.
 */
export function findCreature(name: string): Promise<string | undefined> {
  const wanted = key(name);
  if (wanted.length < 2) return Promise.resolve(undefined);
  let slug = found.get(wanted);
  if (!slug) {
    slug = searchCreatures(wanted, undefined, 50)
      .then((choices) => choices.filter((choice) => choice.name.toLocaleLowerCase("en-US") === wanted)
        .sort((a, b) => bookRank(a.slug) - bookRank(b.slug))[0]?.slug)
      .catch(() => undefined);
    // Forget misses, so a homebrew monster created a moment later is found.
    void slug.then((value) => { if (value === undefined) found.delete(wanted); });
    found.set(wanted, slug);
  }
  return slug;
}

/** Results for a search box, a moment after the DM stops typing. */
export function useCreatureSearch(query: string): { results: CreatureChoice[] | null; busy: boolean } {
  const [results, setResults] = useState<CreatureChoice[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const search = query.trim();
    if (search.length < 2) { setResults(null); setBusy(false); return; }
    const controller = new AbortController();
    setBusy(true);
    const timer = setTimeout(() => {
      searchCreatures(search, controller.signal)
        .then((choices) => { if (!controller.signal.aborted) setResults(choices); })
        .catch(() => { if (!controller.signal.aborted) setResults([]); })
        .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  return { results, busy };
}
