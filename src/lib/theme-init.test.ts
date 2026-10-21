import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT } from "./theme-init";

function run({ stored = {}, dark = false, language = "en-US", throwing = false }: { stored?: Record<string, string>; dark?: boolean; language?: string; throwing?: boolean }) {
  const root = { dataset: {} as Record<string, string>, lang: "" };
  const env = {
    document: { documentElement: root },
    localStorage: { getItem: (key: string) => { if (throwing) throw new Error("blocked"); return stored[key] ?? null; } },
    matchMedia: () => ({ matches: dark }),
    navigator: { language },
  };
  new Function(...Object.keys(env), THEME_INIT_SCRIPT)(...Object.values(env));
  return root;
}

describe("THEME_INIT_SCRIPT", () => {
  it("applies the saved theme and language", () => {
    const root = run({ stored: { "grimoire.theme.v1": "dark", "grimoire.locale.v1": "es" } });
    expect(root.dataset.theme).toBe("dark");
    expect(root.lang).toBe("es");
  });

  it("falls back to the system colour scheme and browser language", () => {
    const root = run({ dark: true, language: "es-MX" });
    expect(root.dataset.theme).toBe("dark");
    expect(root.lang).toBe("es");
  });

  it("ignores unknown stored values", () => {
    const root = run({ stored: { "grimoire.theme.v1": "sepia", "grimoire.locale.v1": "fr" }, language: "fr-FR" });
    expect(root.dataset.theme).toBe("light");
    expect(root.lang).toBe("en");
  });

  it("does not throw when storage is blocked", () => {
    expect(() => run({ throwing: true })).not.toThrow();
  });
});
