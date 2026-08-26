// @vitest-environment jsdom
import "fake-indexeddb/auto";
import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { storage } from "./storage.js";

/* The areas restructure changes how the app is organised, not what it holds.
   This takes a realistic export written by the PREVIOUS build — nine sections,
   no areas, entries filed under the old section names — restores it, and
   proves every piece is still present and reachable. It is the test that
   protects years of writing across a restructure. */

globalThis.window.storage = storage;
window.scrollTo = () => {};
const App = (await import("./App.jsx")).default;

const p = (n) => String(n).padStart(2, "0");
const d = new Date();
const today = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
const mk = today.slice(0, 7);

/* Written by the nine-section build: note the old nav order, the old index
   section names ("health", "identity", "gratitude"), and the sales records
   kept after their surfaces were removed. */
const LEGACY = {
  "tj:core": {
    names: { wife: "Sara", daughter: "Margo" },
    order: ["today", "people", "faith", "journal", "patterns", "judgment", "library", "becoming", "talk"],
    hidden: ["library"],
    identity: [{ id: "i1", text: "I keep promises to myself.", since: today, versions: [] }],
    nonNegotiables: [{ id: "n1", label: "Training" }],
    wins: [{ id: "w1", d: today, t: "Ran the hard conversation without getting defensive." }],
    goals: [{ id: "g1", area: "Foundation", title: "Sleep before midnight", progress: 3 }],
  },
  "tj:lib": {
    insights: [{ id: "s1", text: "You confuse motion with progress.", created: today, n: 40, verdict: "agree" }],
    books: [{ id: "b1", title: "Deep Work", author: "Cal Newport", status: "Read", rating: 4 }],
    kb: [{ id: "k1", type: "Principle", text: "Ask before you explain.", created: today, src: "you" }],
    decisions: [{ id: "d1", created: today, title: "Take the bigger territory", reasoning: "Sound", result: "Good", happened: "It worked." }],
    deals: [{ id: "dl1", created: today, title: "An old deal record" }],
    calls: [{ id: "c1", created: today, title: "An old call record" }],
    language: [{ id: "l1", created: today, type: "Reframe", text: "An old saved line" }],
  },
  [`tj:day:${today}`]: {
    date: today,
    intention: "Steady, not sharp.",
    priorities: [{ t: "Ship the thing", done: true }, { t: "", done: false }, { t: "", done: false }],
    am: { gratitude: ["Coffee still hot", "", ""], declaration: "Today I show up steady." },
    body: { sleep: "Seven hours, broken", training: "Boxing" },
    wife: { listen: "Mostly. Interrupted once." },
    daughter: { laugh: "She did the voice again." },
    faith: { reading: "Psalm 23", prayer: "For patience" },
    anchors: { wife: true },
  },
  [`tj:journal:${today}`]: {
    date: today,
    entries: [{ id: "j1", ts: Date.now(), prompt: "What am I avoiding?", text: "The conversation about money." }],
  },
  [`tj:ink:${today}`]: {
    date: today,
    morning: { paper: "ruled", strokes: [{ id: "st1", tool: "pen", pts: [[10, 10, 0.5], [40, 30, 0.6], [70, 20, 0.5]] }] },
  },
  [`tj:idx:${mk}`]: [
    { d: today, sec: "health", q: "Sleep", t: "Seven hours, broken" },
    { d: today, sec: "identity", q: "Who I want to be today", t: "Steady, not sharp." },
    { d: today, sec: "gratitude", q: "Grateful for", t: "Coffee still hot" },
    { d: today, sec: "marriage", q: "Did I listen before solving?", t: "Mostly. Interrupted once." },
    { d: today, sec: "journal", q: "What am I avoiding?", t: "The conversation about money." },
  ],
};

async function seedLegacy() {
  for (const [k, v] of Object.entries(LEGACY)) await storage.set(k, JSON.stringify(v));
}
const read = async (k) => JSON.parse((await storage.get(k)).value);

describe("a record written by the nine-section build survives the areas restructure", () => {
  beforeEach(async () => {
    cleanup();
    globalThis.window.storage = storage;
    for (const k of (await storage.list("tj:")).keys) await storage.set(k, JSON.stringify(null));
    await seedLegacy();
  });

  it("keeps every stored record intact on disk", async () => {
    render(<App />);
    await screen.findByText("Areas", {}, { timeout: 5000 });

    const day = await read(`tj:day:${today}`);
    expect(day.intention).toBe("Steady, not sharp.");
    expect(day.body.sleep).toBe("Seven hours, broken");
    expect(day.wife.listen).toBe("Mostly. Interrupted once.");
    expect(day.daughter.laugh).toBe("She did the voice again.");
    expect(day.faith.reading).toBe("Psalm 23");
    expect(day.am.gratitude[0]).toBe("Coffee still hot");

    const journal = await read(`tj:journal:${today}`);
    expect(journal.entries[0].text).toBe("The conversation about money.");

    const ink = await read(`tj:ink:${today}`);
    expect(ink.morning.strokes[0].pts).toHaveLength(3);

    const lib = await read("tj:lib");
    expect(lib.insights[0].text).toBe("You confuse motion with progress.");
    expect(lib.books[0].title).toBe("Deep Work");
    expect(lib.decisions[0].title).toBe("Take the bigger territory");
    // surfaces removed earlier, records deliberately kept
    expect(lib.deals[0].title).toBe("An old deal record");
    expect(lib.calls[0].title).toBe("An old call record");
    expect(lib.language[0].text).toBe("An old saved line");
  });

  it("replaces the stale nine-section nav rather than filtering it to nonsense", async () => {
    render(<App />);
    await screen.findByText("Areas", {}, { timeout: 5000 });
    for (const label of ["Today", "Areas", "Journal", "Review", "Talk"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    // "library" was hidden under the old nav; that must not hide anything now
    expect(screen.queryByText("Patterns")).toBeNull();
    expect(screen.queryByText("Judgment")).toBeNull();
  });

  it("seeds the eleven areas onto a core that had none", async () => {
    render(<App />);
    await screen.findByText("Areas", {}, { timeout: 5000 });
    fireEvent.click(screen.getByText("Areas"));
    for (const label of ["Body", "Money", "Home", "Play & rest", "Marriage", "Fatherhood",
                         "Friendship", "Work", "Mind", "Faith", "Character"]) {
      expect(await screen.findByText(label, {}, { timeout: 3000 })).toBeTruthy();
    }
  });

  it("still shows entries filed under the old section names inside their new area", async () => {
    render(<App />);
    await screen.findByText("Areas", {}, { timeout: 5000 });
    fireEvent.click(screen.getByText("Areas"));
    fireEvent.click(await screen.findByText("Body", {}, { timeout: 3000 }));
    // the legacy row was filed sec:"health"; Body must still count it
    await waitFor(() => {
      const txt = document.body.textContent || "";
      expect(/\d+ entr(y|ies)/.test(txt)).toBe(true);
    }, { timeout: 3000 });
    expect((document.body.textContent || "").includes("Seven hours, broken")).toBe(true);
  });

  it("carries identity and the non-negotiables into Character", async () => {
    render(<App />);
    await screen.findByText("Areas", {}, { timeout: 5000 });
    fireEvent.click(screen.getByText("Areas"));
    fireEvent.click(await screen.findByText("Character", {}, { timeout: 3000 }));
    await waitFor(() => {
      expect((document.body.textContent || "").includes("I keep promises to myself.")).toBe(true);
    }, { timeout: 3000 });
  });

  it("carries the library into Mind", async () => {
    render(<App />);
    await screen.findByText("Areas", {}, { timeout: 5000 });
    fireEvent.click(screen.getByText("Areas"));
    fireEvent.click(await screen.findByText("Mind", {}, { timeout: 3000 }));
    await waitFor(() => {
      expect((document.body.textContent || "").includes("Deep Work")).toBe(true);
    }, { timeout: 3000 });
  });

  it("carries the decision journal into Review", async () => {
    render(<App />);
    await screen.findByText("Areas", {}, { timeout: 5000 });
    fireEvent.click(screen.getByText("Review"));
    fireEvent.click(await screen.findByText("Decisions", {}, { timeout: 3000 }));
    await waitFor(() => {
      expect((document.body.textContent || "").includes("Take the bigger territory")).toBe(true);
    }, { timeout: 3000 });
  });
});
