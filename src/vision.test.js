import { describe, it, expect } from "vitest";
import { visionLead } from "./App.jsx";

/* The lead photograph used to be picked with a weak hash of the date, which
   clustered: with six photos the same one led on days 0, 3 and 6 while another
   went a fortnight unseen. These pin the properties that fixes it — every
   photograph shown once per pass, and no photograph twice in a row. */

const addDays = (k, n) => {
  const [y, m, d] = k.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};

const run = (n, days, from = "2026-08-27") =>
  Array.from({ length: days }, (_, i) => visionLead(n, addDays(from, i)));

/* A pass is n days aligned to a round boundary. An arbitrary n-day window
   straddles two rounds and may legitimately hold a repeat, so tests about
   "every photograph once" have to start where a round does. */
const EPOCH = "2020-01-01";
const dayNo = (k) => Math.round((Date.parse(k + "T00:00:00Z") - Date.parse(EPOCH + "T00:00:00Z")) / 86400000);
const alignedStart = (n, from) => addDays(from, (n - (((dayNo(from) % n) + n) % n)) % n);

describe("the vision board deals rather than guesses", () => {
  it("is stable within a day", () => {
    for (const n of [2, 5, 9]) {
      expect(visionLead(n, "2026-08-27")).toBe(visionLead(n, "2026-08-27"));
    }
  });

  it("shows every photograph exactly once before repeating any", () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8, 11, 17]) {
      // three consecutive passes, each of which must be a full permutation
      const seen = run(n, n * 3, alignedStart(n, "2026-08-27"));
      for (let pass = 0; pass < 3; pass++) {
        const slice = seen.slice(pass * n, pass * n + n);
        expect(new Set(slice).size, `n=${n} pass=${pass} gave ${slice}`).toBe(n);
      }
    }
  });

  it("never shows the same photograph two mornings running", () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8, 11]) {
      const seen = run(n, n * 6);
      for (let i = 1; i < seen.length; i++) {
        expect(seen[i], `n=${n} repeated ${seen[i]} at day ${i}`).not.toBe(seen[i - 1]);
      }
    }
  });

  it("does not deal the same order every pass", () => {
    // with five or more there are enough permutations that four passes running
    // identical would mean the round seed is not reaching the shuffle
    for (const n of [5, 6, 7]) {
      const passes = [];
      const from = alignedStart(n, "2026-08-27");
      for (let p = 0; p < 4; p++) passes.push(run(n, n, addDays(from, p * n)).join(","));
      expect(new Set(passes).size, `n=${n} dealt ${passes[0]} every pass`).toBeGreaterThan(1);
    }
  });

  it("holds up either side of the epoch and at the edges", () => {
    expect(visionLead(0, "2026-08-27")).toBe(0);
    expect(visionLead(1, "2026-08-27")).toBe(0);
    for (const n of [3, 5]) {
      // dates before VISION_EPOCH give a negative day count
      const early = run(n, n * 2, alignedStart(n, "2018-03-04"));
      expect(early.every((i) => i >= 0 && i < n)).toBe(true);
      expect(new Set(early.slice(0, n)).size).toBe(n);
    }
  });
});
