import { get as idbGet, set as idbSet, keys as idbKeys, createStore } from "idb-keyval";

const store = createStore("tj3", "kv");

/* A missing key and a broken store must never look alike to a caller.
   The `S` helper in App.jsx treats a missing key as "no record" and a real
   failure as a reason NOT to save — telling them apart is what stops an
   unreadable record from being overwritten by an empty one. */
export class MissingKeyError extends Error {
  constructor(key) {
    super(`No record for key: ${key}`);
    this.name = "MissingKeyError";
    this.key = key;
    // own property, so the tag survives being read across the window boundary
    this.missingKey = true;
  }
}

async function get(key) {
  const value = await idbGet(key, store); // a real IndexedDB failure throws through
  if (value === undefined) throw new MissingKeyError(key);
  return { value };
}

async function set(key, value) {
  await idbSet(key, value, store);
  return { ok: true };
}

async function list(prefix) {
  const all = await idbKeys(store);
  return { keys: all.filter((k) => typeof k === "string" && k.startsWith(prefix)) };
}

export const storage = { get, set, list };

export function installStorage(target = window) {
  target.storage = storage;
}
