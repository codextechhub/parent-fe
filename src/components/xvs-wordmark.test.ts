import { describe, expect, it } from "vitest";

import { INK, PEN, WORDMARK_RATIO, WORDMARK_VIEWBOX } from "./xvs-wordmark";

/**
 * The write-on's timeline, which is data rather than code and therefore drifts
 * silently. A stroke retimed by hand, or one added without re-cutting the
 * shares, shows up as a pause in the middle of the writing or as letters
 * arriving out of order - neither of which any other test would notice.
 */
describe("the XVS wordmark", () => {
  it("hands the whole write-on out, with no gap and no overlap", () => {
    let cursor = 0;
    for (const stroke of PEN) {
      expect(stroke.s).toBeCloseTo(cursor, 3);
      cursor += stroke.l;
    }
    expect(cursor).toBeCloseTo(1, 3);
  });

  it("hides every stroke past its own round cap at rest", () => {
    // An offset of exactly 1 still paints the cap half a stroke-width beyond
    // the end of the dash, which shows as a speck of ink before the pen has
    // reached it. Each stroke is pushed back by its own half-cap-over-length,
    // so the short ones need a bigger push than the long ones.
    for (const stroke of PEN) expect(stroke.o).toBeGreaterThan(1);
    const shortest = PEN.reduce((a, b) => (a.l < b.l ? a : b));
    const longest = PEN.reduce((a, b) => (a.l > b.l ? a : b));
    expect(shortest.o).toBeGreaterThan(longest.o);
  });

  it("keeps the box in step with the artwork", () => {
    const [, , w, h] = WORDMARK_VIEWBOX.split(" ").map(Number);
    expect(WORDMARK_RATIO).toBeCloseTo(w / h, 3);
    expect(INK.startsWith("M")).toBe(true);
  });
});
