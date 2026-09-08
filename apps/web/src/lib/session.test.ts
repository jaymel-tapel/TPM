import { describe, expect, it } from "vitest";
import { sessionOutdated } from "./auth";

/**
 * A session is a signed cookie, so resetting a password does not end one on its
 * own. This is what does — and it is the kind of comparison that goes wrong by
 * a factor of a thousand, so it is worth pinning.
 */
describe("a token issued before the password changed", () => {
  const changed = new Date("2026-09-09T12:00:00.000Z");
  const at = (iso: string) => new Date(iso).getTime();

  it("is refused when it predates the change", () => {
    expect(sessionOutdated(at("2026-09-09T11:59:00.000Z"), changed)).toBe(true);
    expect(sessionOutdated(at("2026-09-01T09:00:00.000Z"), changed)).toBe(true);
  });

  it("is kept when it was issued after", () => {
    expect(sessionOutdated(at("2026-09-09T12:00:05.000Z"), changed)).toBe(false);
    expect(sessionOutdated(at("2026-09-10T09:00:00.000Z"), changed)).toBe(false);
  });

  it("survives the rounding in the same second", () => {
    // `iat` is whole seconds; the column is not. A token minted at .000 for a
    // change recorded at .400 must not be thrown away for being 400ms early.
    expect(sessionOutdated(at("2026-09-09T12:00:00.000Z"), new Date("2026-09-09T12:00:00.400Z")))
      .toBe(false);
  });

  it("still refuses one from the second before", () => {
    expect(sessionOutdated(at("2026-09-09T11:59:57.000Z"), changed)).toBe(true);
  });
});
