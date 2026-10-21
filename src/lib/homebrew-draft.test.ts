import { describe, expect, it } from "vitest";
import { draftFromMonster, draftToPayload, draftToPreview, emptyDraft } from "./homebrew-draft";
import { parseHomebrewInput } from "./homebrew";

const named = () => ({ ...emptyDraft(), name: "Ash Drake", type: "dragon" });

describe("homebrew draft", () => {
  it("turns the default form with a name into a valid payload", () => {
    const parsed = parseHomebrewInput(draftToPayload(named()));
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.value.statBlock.speed).toEqual({ walk: "30 ft." });
  });

  it("round-trips a stored monster through the form unchanged", () => {
    const draft = {
      ...named(), armorClass: "15", armorType: "natural armor", hitPoints: "52", hitDice: "7d8+21", cr: "3",
      speed: { ...emptyDraft().speed, fly: "60 ft." },
      senses: { ...emptyDraft().senses, darkvision: "60 ft." }, passivePerception: "11", languages: "Draconic",
      resistances: "fire, cold", immunities: "poison", conditionImmunities: "poisoned, charmed", vulnerabilities: "",
      traits: [{ name: "Ember Skin", desc: "Creatures that touch the drake take 2 fire damage." }],
      actions: [{ name: "Bite", desc: "Melee Weapon Attack: +5 to hit. Hit: 9 (2d6+2) piercing damage." }],
      legendary: [{ name: "Tail Swipe", desc: "The drake makes one tail attack." }],
      visibility: "campaign" as const, campaignIds: ["6f1c1e7a-3b5e-4c52-9a7e-0d4f5a1b2c3d"],
    };
    const first = parseHomebrewInput(draftToPayload(draft));
    if (!first.ok) throw new Error(first.error);
    const reopened = draftFromMonster({ statBlock: first.value.statBlock, visibility: first.value.visibility, campaignIds: first.value.campaignIds });
    expect(reopened).toEqual(draft);
    const second = parseHomebrewInput(draftToPayload(reopened));
    expect(second.ok && second.value).toEqual(first.value);
  });

  it("drops empty rows and splits comma lists", () => {
    const payload = draftToPayload({ ...named(), resistances: " fire ,cold;; ", actions: [{ name: "", desc: "" }, { name: "Slam", desc: "" }] });
    expect(payload.statBlock.damage_resistances).toEqual(["fire", "cold"]);
    expect(payload.statBlock.actions).toEqual([{ name: "Slam", desc: "" }]);
  });

  it("only sends campaigns when sharing with campaigns", () => {
    const ids = ["6f1c1e7a-3b5e-4c52-9a7e-0d4f5a1b2c3d"];
    expect(draftToPayload({ ...named(), visibility: "private", campaignIds: ids }).campaignIds).toEqual([]);
    expect(draftToPayload({ ...named(), visibility: "campaign", campaignIds: ids }).campaignIds).toEqual(ids);
  });

  it("leaves blank numbers out so the server reports them", () => {
    const parsed = parseHomebrewInput(draftToPayload({ ...named(), hitPoints: "" }));
    expect(parsed).toEqual({ ok: false, error: "Hit points is required." });
  });

  it("previews with derived XP and tolerates half-typed values", () => {
    const preview = draftToPreview({ ...named(), cr: "0.25", hitPoints: "abc", armorClass: "" });
    expect(preview).toMatchObject({ name: "Ash Drake", challenge_rating: 0.25, xp: 50, proficiency_bonus: 2 });
    expect(preview.hit_points).toBeUndefined();
    expect(preview.armor_class).toBeUndefined();
    expect(draftToPreview({ ...named(), cr: "" }).xp).toBeUndefined();
  });
});
