import { get as idbGet, set as idbSet, keys as idbKeys, createStore } from "idb-keyval";

const store = createStore("tj3", "kv");

async function get(key) {
  const value = await idbGet(key, store);
  if (value === undefined) throw new Error(`No record for key: ${key}`);
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
