// @vitest-environment jsdom
import "fake-indexeddb/auto";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { storage } from "./storage.js";

/* The bug these cover: the debounced save used to return clearTimeout from its
   effect, so typing and then leaving the record inside the debounce window
   cancelled the write outright and the text was gone. Priority 1 in CLAUDE.md
   is never lose written data — this is the regression that would break it. */

globalThis.window.storage = storage;
window.scrollTo = () => {};

const App = (await import("./App.jsx")).default;

const todayKey = (() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

const readDay = async (key) => {
  try {
    const r = await storage.get("tj:day:" + key);
    return JSON.parse(r.value);
  } catch (e) {
    return null;
  }
};

async function renderReady() {
  const view = render(<App />);
  // the app renders a blank shell until core/day/lib have hydrated
  await screen.findByLabelText("Gratitude 1", {}, { timeout: 3000 });
  return view;
}

describe("autosave never drops written text", () => {
  beforeEach(async () => {
    cleanup();
    for (const k of (await storage.list("tj:")).keys) {
      await storage.set(k, JSON.stringify(null));
    }
  });

  it("flushes a pending write when the day changes inside the debounce window", async () => {
    await renderReady();

    fireEvent.change(screen.getByLabelText("Gratitude 1"), {
      target: { value: "Margo laughing at breakfast" },
    });

    // leave immediately — well inside the 700ms debounce
    fireEvent.click(screen.getByLabelText("Previous day"));

    await waitFor(async () => {
      const saved = await readDay(todayKey);
      expect(saved && saved.am && saved.am.gratitude[0]).toBe("Margo laughing at breakfast");
    }, { timeout: 3000 });
  });

  it("flushes a pending write on unmount", async () => {
    const { unmount } = await renderReady();

    fireEvent.change(screen.getByLabelText("Gratitude 1"), {
      target: { value: "A quiet hour before anyone woke up" },
    });

    unmount();

    await waitFor(async () => {
      const saved = await readDay(todayKey);
      expect(saved && saved.am && saved.am.gratitude[0]).toBe("A quiet hour before anyone woke up");
    }, { timeout: 3000 });
  });

  it("flushes every pending write when the app is backgrounded", async () => {
    await renderReady();

    fireEvent.change(screen.getByLabelText("Gratitude 1"), {
      target: { value: "The drive home with the windows down" },
    });

    // iOS can freeze a standalone PWA here and never come back
    window.dispatchEvent(new Event("pagehide"));

    /* Deadline is well inside the 700ms debounce: if the flush did not happen,
       the ordinary timer cannot have fired yet and this fails. Without it the
       test would pass on the debounce alone and prove nothing. */
    await waitFor(async () => {
      const saved = await readDay(todayKey);
      expect(saved && saved.am && saved.am.gratitude[0]).toBe("The drive home with the windows down");
    }, { timeout: 300, interval: 20 });
  });
});

/* setAm used to spread a stale closure, so two calls in one handler cancelled
   each other out. "Another" set affId and then immediately discarded it. */
describe("sequential updates to the same record compose", () => {
  beforeEach(async () => {
    cleanup();
    globalThis.window.storage = storage;
    for (const k of (await storage.list("tj:")).keys) await storage.set(k, JSON.stringify(null));
  });

  it("'Another' actually swaps the affirmation", async () => {
    /* the affirmation ships switched off now that the sheet does that work, so
       turn it on for this test — the regression it guards is setAm, not the
       default */
    await storage.set("tj:core", JSON.stringify({ freqVersion: 2, freq: { gratitude: "always", affirmation: "always" } }));
    await renderReady();

    // gratitude gates the next step open
    fireEvent.change(screen.getByLabelText("Gratitude 1"), { target: { value: "Coffee, still hot" } });

    const another = await screen.findByText("Another", {}, { timeout: 3000 });
    const shown = () =>
      Array.from(document.querySelectorAll("div")).find((el) => /^I .+\.$/.test(el.textContent || "") && el.children.length === 0)?.textContent;

    const before = shown();
    expect(before).toBeTruthy();

    fireEvent.click(another);

    await waitFor(() => expect(shown()).not.toBe(before), { timeout: 2000 });
  });
});

describe("a record that failed to load is never saved over", () => {
  beforeEach(() => { cleanup(); globalThis.window.storage = storage; });

  it("halts instead of rendering an empty day the autosave would commit", async () => {
    const real = "Something I do not want overwritten";
    await storage.set("tj:day:" + todayKey, JSON.stringify({ date: todayKey, intention: real }));

    // the store starts failing every read
    globalThis.window.storage = {
      ...storage,
      get: async () => { throw new Error("InvalidStateError: database is closed"); },
    };

    render(<App />);
    await screen.findByText(/storage couldn't be read/i, {}, { timeout: 3000 });

    globalThis.window.storage = storage;
    const saved = await readDay(todayKey);
    expect(saved.intention).toBe(real);
  });
});
