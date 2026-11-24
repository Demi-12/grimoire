import { describe, expect, it } from "vitest";
import { dataError, unwrap, type DataError } from "./api-error.js";

const reply = (error: DataError) => {
  const failure = dataError(error);
  return { status: failure.getStatus(), body: failure.getResponse() };
};

describe("dataError", () => {
  it("answers each data-layer failure with its status, message and code", () => {
    expect(reply("not-found")).toEqual({ status: 404, body: { error: "Not found." } });
    expect(reply("forbidden")).toEqual({ status: 403, body: { error: "You don't have permission for that." } });
    expect(reply("invalid")).toEqual({ status: 400, body: { error: "That change isn't valid." } });
    expect(reply("blocked")).toEqual({ status: 409, body: { error: "A wall or a closed door is in the way.", code: "blocked" } });
    expect(reply("turn")).toEqual({ status: 409, body: { error: "It isn't this creature's turn.", code: "turn" } });
    expect(reply("movement")).toEqual({ status: 409, body: { error: "That's further than this creature can move this turn.", code: "movement" } });
    expect(reply("limit")).toEqual({ status: 409, body: { error: "That's the most this campaign can keep." } });
  });
});

describe("unwrap", () => {
  it("returns the value of a success and throws the matching error for a failure", () => {
    expect(unwrap({ ok: true, value: 7 })).toBe(7);
    expect(() => unwrap({ ok: false, error: "not-found" })).toThrow(expect.objectContaining({ response: { error: "Not found." }, status: 404 }));
  });
});
