import { describe, expect, it } from "vitest";
import { translateAbility, translateTerms } from "./monster-i18n";

describe("monster stat block vocabulary", () => {
  it("leaves English untouched", () => {
    expect(translateTerms("size", "Large", "en")).toBe("Large");
  });

  it("translates fixed rules terms and keeps unknown words", () => {
    expect(translateTerms("size", "Medium", "es")).toBe("mediana");
    expect(translateTerms("type", "Humanoid (any race)", "es")).toBe("humanoide (de cualquier raza)");
    expect(translateTerms("alignment", "Lawful Evil", "es")).toBe("legal malvado");
    expect(translateTerms("alignment", "unaligned", "es")).toBe("sin alineamiento");
    expect(translateTerms("speed", "fly", "es")).toBe("volar");
    expect(translateTerms("speed", "60 ft.", "es")).toBe("60 pies");
    expect(translateTerms("damage", "bludgeoning, piercing, and slashing from nonmagical attacks", "es")).toBe("contundente, perforante, y cortante de ataques no mágicos");
    expect(translateTerms("condition", "Poisoned, Charmed", "es")).toBe("envenenado, hechizado");
    expect(translateTerms("language", "Common, Draconic", "es")).toBe("común, dracónico");
    expect(translateTerms("language", "Zzyxx", "es")).toBe("Zzyxx");
  });

  it("maps ability abbreviations in saving throws", () => {
    expect(translateAbility("WIS", "es")).toBe("SAB");
    expect(translateAbility("WIS", "en")).toBe("WIS");
  });
});
