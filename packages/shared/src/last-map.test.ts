import { describe, expect, it } from "vitest";
import { byLastMap } from "./last-map.js";

describe("byLastMap", () => {
  const campaigns = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("puts the most recently opened map first and keeps the rest in order", () => {
    expect(byLastMap(campaigns, { c: 20, b: 10 }).map((item) => item.id)).toEqual(["c", "b", "a"]);
    expect(byLastMap(campaigns, { b: 5 }).map((item) => item.id)).toEqual(["b", "a", "c"]);
  });

  it("keeps the campaigns' order when no map was opened yet", () => {
    expect(byLastMap(campaigns, {}).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
});
