import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const compose = await readFile(new URL("../compose.yaml", import.meta.url), "utf8");
const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");
const gitignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
const dockerignore = await readFile(new URL("../.dockerignore", import.meta.url), "utf8");

describe("secret-handling configuration", () => {
  it("does not publish PostgreSQL on a host port", () => {
    const databaseService = compose.split("\n  db:\n")[1];
    expect(databaseService).toBeTruthy();
    expect(databaseService).not.toMatch(/^\s+ports:/m);
  });

  it("keeps credential values empty in the checked-in environment example", () => {
    const secrets = new Set(["POSTGRES_PASSWORD", "DATABASE_URL", "CLOUDFLARE_TUNNEL_TOKEN"]);
    for (const line of envExample.split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue;
      const [key, value = ""] = line.split("=", 2);
      if (secrets.has(key)) expect(value, `${key} must remain empty`).toBe("");
    }
  });

  it("ignores local environment files in Git", () => {
    expect(gitignore).toMatch(/^\.env\.\*$/m);
    expect(gitignore).toMatch(/^!\.env\.example$/m);
  });

  it("excludes local environment files from Docker build context", () => {
    expect(dockerignore).toMatch(/^\.env\.\*$/m);
    expect(dockerignore).toMatch(/^!\.env\.example$/m);
  });
});
