import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { storage } from "./storage.js";

/* mirrors the S.get try/catch in App.jsx exactly, so this test checks the
   seam between the shim and the untouched app code, not the shim alone */
async function sGet(key) {
  try {
    const r = await storage.get(key);
    if (!r || r.value == null) return null;
    return typeof r.value === "string" ? JSON.parse(r.value) : r.value;
  } catch (e) {
    return null;
  }
}

describe("storage shim", () => {
  it("throws on a key that was never written", async () => {
    await expect(storage.get("tj:nope-" + Math.random())).rejects.toThrow();
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

  describe("S.get contract (first-launch behavior)", () => {
    it("resolves to null, not a throw, for a missing key", async () => {
      const result = await sGet("tj:lib-" + Math.random());
      expect(result).toBeNull();
    });

    it("resolves to the parsed value for a present key", async () => {
      const key = "tj:talk";
      await storage.set(key, JSON.stringify({ messages: [{ role: "user", content: "hi" }] }));
      const result = await sGet(key);
      expect(result).toEqual({ messages: [{ role: "user", content: "hi" }] });
    });
  });
});
