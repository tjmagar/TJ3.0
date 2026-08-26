import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { storage, MissingKeyError } from "./storage.js";

/* The real S helper, imported from App.jsx rather than mirrored here — a copy
   of the logic would pass while the shipped code was broken. S reaches the shim
   through window.storage, so stand that up first. */
globalThis.window = globalThis.window || {};
globalThis.window.storage = storage;
const { S } = await import("./App.jsx");

describe("storage shim", () => {
  it("throws on a key that was never written", async () => {
    await expect(storage.get("tj:nope-" + Math.random())).rejects.toThrow();
  });

  it("tags a missing key so callers can tell it from a broken store", async () => {
    const err = await storage.get("tj:nope-" + Math.random()).catch((e) => e);
    expect(err).toBeInstanceOf(MissingKeyError);
    expect(err.missingKey).toBe(true);
  });

  it("round-trips a set/get pair with the exact stored string", async () => {
    const key = "tj:core";
    const raw = JSON.stringify({ names: { wife: "Sara" } });
    await storage.set(key, raw);
    const r = await storage.get(key);
    expect(r).toEqual({ value: raw });
  });

  it("list(prefix) returns only matching keys, as plain strings", async () => {
    await storage.set("tj:day:2026-08-20", '{"date":"2026-08-20"}');
    await storage.set("tj:day:2026-08-21", '{"date":"2026-08-21"}');
    await storage.set("tj:journal:2026-08-20", '{"date":"2026-08-20","entries":[]}');
    const { keys } = await storage.list("tj:day:");
    expect(keys.sort()).toEqual(["tj:day:2026-08-20", "tj:day:2026-08-21"]);
  });
});

/* These are the regressions that would cost real journal entries. */
describe("S.get — absence vs damage", () => {
  afterEach(() => { globalThis.window.storage = storage; });

  it("resolves to null, not a throw, for a missing key", async () => {
    expect(await S.get("tj:lib-" + Math.random())).toBeNull();
  });

  it("resolves to the parsed value for a present key", async () => {
    await storage.set("tj:talk", JSON.stringify({ messages: [{ role: "user", content: "hi" }] }));
    expect(await S.get("tj:talk")).toEqual({ messages: [{ role: "user", content: "hi" }] });
  });

  it("THROWS when the store itself fails, so a real day is never treated as empty", async () => {
    globalThis.window.storage = {
      ...storage,
      get: async () => { throw new Error("InvalidStateError: database is closed"); },
    };
    await expect(S.get("tj:day:2026-08-20")).rejects.toThrow(/database is closed/);
  });

  it("THROWS on a corrupt record rather than reporting it as absent", async () => {
    globalThis.window.storage = { ...storage, get: async () => ({ value: "{not json" }) };
    await expect(S.get("tj:day:2026-08-20")).rejects.toThrow(/Unreadable record/);
  });

  it("still returns null when the shim reports a missing key by throwing", async () => {
    globalThis.window.storage = {
      ...storage,
      get: async (k) => { throw new MissingKeyError(k); },
    };
    expect(await S.get("tj:day:2026-08-20")).toBeNull();
  });
});

describe("S.set", () => {
  afterEach(() => { globalThis.window.storage = storage; });

  it("reports false when the write fails, so callers can surface it", async () => {
    globalThis.window.storage = {
      ...storage,
      set: async () => { throw new Error("QuotaExceededError"); },
    };
    expect(await S.set("tj:day:2026-08-20", { date: "2026-08-20" })).toBe(false);
  });

  it("reports true on a successful write", async () => {
    expect(await S.set("tj:day:2026-08-22", { date: "2026-08-22" })).toBe(true);
  });
});
