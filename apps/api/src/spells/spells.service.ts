/** The text of an SRD spell, fetched from Open5e on demand and kept for a day like the bestiary's stat blocks. */
import { Injectable } from "@nestjs/common";
import { findSpell } from "@grimoire/shared/spells";
import { getJson, UpstreamError } from "../monsters/monster-upstream.js";

/** The text of a spell, which the catalogue in spell-data.ts leaves out. Open5e only serves it in English. */
export interface SpellDetail {
  id: string;
  description: string;
  /** What changes with a higher-level slot, or as a cantrip grows with the character. */
  higherLevel: string;
  /** The material component, when the spell names one. */
  material: string;
  /** What triggers a spell cast as a Reaction. */
  reaction: string;
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

@Injectable()
export class SpellsService {
  /** One SRD 5.2 spell by catalogue id, or null when the id isn't in the catalogue. */
  async fetchSpellDetail(id: string): Promise<SpellDetail | null> {
    if (!findSpell(id)) return null;
    const { status, body } = await getJson(`/spells/srd-2024_${encodeURIComponent(id)}/`);
    if (status === 404) return null;
    if (!body || typeof body !== "object" || typeof (body as { desc?: unknown }).desc !== "string") throw new UpstreamError("The spell API returned an unexpected response.", 502);
    const spell = body as Record<string, unknown>;
    return { id, description: text(spell.desc), higherLevel: text(spell.higher_level), material: text(spell.material_specified), reaction: text(spell.reaction_condition) };
  }
}
