import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* ══════════════════════════════════════════════════════════════
   TJ 3.0 — a personal operating system that learns
   Three kinds of knowledge, never blurred:
     · you        — what you wrote
     · counted    — arithmetic on what you wrote
     · generated  — a model's reading of what you wrote
   ══════════════════════════════════════════════════════════════ */

const C = {
  paper: "var(--paper)",
  raise: "var(--raise)",
  ink: "var(--ink)",
  ink70: "var(--ink70)",
  ink45: "var(--ink45)",
  ink28: "var(--ink28)",
  ink16: "var(--ink16)",
  line: "var(--line)",
  lineSoft: "var(--lineSoft)",
  accent: "var(--accent)",
  accentSoft: "var(--accentSoft)",
};

const SERIF = "'Newsreader', ui-serif, Georgia, 'Iowan Old Style', serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif";

/* ── dates ────────────────────────────────────────────────── */
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => {
  const [y, m, d] = String(k).split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (k, n) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return keyOf(d);
};
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MO = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const longDate = (k) => {
  const d = parseKey(k);
  return `${DAYS[d.getDay()]}, ${MO[d.getMonth()]} ${d.getDate()}`;
};
const midDate = (k) => {
  const d = parseKey(k);
  return `${MO[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
};
const monthKey = (k) => k.slice(0, 7);
const monthName = (mk) => `${MO[Number(mk.slice(5, 7)) - 1]} ${mk.slice(0, 4)}`;
const weekKeyOf = (k) => {
  const d = parseKey(k);
  const t = new Date(d.valueOf());
  t.setDate(t.getDate() - ((d.getDay() + 6) % 7) + 3);
  const first = new Date(t.getFullYear(), 0, 4);
  const wk = 1 + Math.round(((t - first) / 86400000 - 3 + ((first.getDay() + 6) % 7)) / 7);
  return `${t.getFullYear()}-W${pad(wk)}`;
};
const mondayOf = (k) => addDays(k, -((parseKey(k).getDay() + 6) % 7));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

/* ── storage ──────────────────────────────────────────────── */
/* get() returns null for a key that was never written, and THROWS for a store
   that could not be read. Those two used to be the same answer, which meant a
   transient IndexedDB failure rendered an empty day and the autosave below then
   wrote that empty day over a real entry. Never again: a record that failed to
   load is never saved over. */
export const S = {
  async get(key) {
    let r;
    try {
      r = await window.storage.get(key);
    } catch (e) {
      if (e && e.missingKey) return null; // no record — the original contract
      throw e; // a real failure must not be mistaken for an empty record
    }
    if (!r || r.value == null) return null;
    if (typeof r.value !== "string") return r.value;
    try {
      return JSON.parse(r.value);
    } catch (e) {
      // a corrupt record is damage, not absence — refuse rather than overwrite
      throw new Error("Unreadable record at " + key);
    }
  },
  async set(key, val) {
    try {
      await window.storage.set(key, JSON.stringify(val));
      return true;
    } catch (e) {
      return false;
    }
  },
  async list(prefix) {
    try {
      const r = await window.storage.list(prefix);
      return ((r && r.keys) || []).map((k) => (typeof k === "string" ? k : k.key || k.name || "")).filter(Boolean);
    } catch (e) {
      return [];
    }
  },
};

/* Every debounced writer registers a flush here. iOS can freeze or reclaim a
   standalone PWA at any moment, so anything still inside a debounce window
   would otherwise die with the page. Flushing writes already-committed state —
   it never touches the canvas, so it cannot interrupt a stroke in progress. */
const flushers = new Set();
const flushAllWrites = () => { for (const f of Array.from(flushers)) f(); };

/* ── themes: a counted layer, no model involved ───────────── */
const THEMES = [
  { id: "patience", label: "Patience", words: ["impatient","impatience","short","snapped","sharp","irritat","frustrat","annoyed","temper","reactive","edge","curt","tone"] },
  { id: "presence", label: "Presence", words: ["present","phone","distracted","half-listening","attention","checked out","rushed","hurried","in the room"] },
  { id: "avoidance", label: "Avoidance", words: ["avoid","procrastinat","putting off","postpone","dodge","later","haven't started","keep meaning","dragging"] },
  { id: "decisions", label: "Decisions", words: ["decide","decision","indecis","hesitat","torn","uncertain","not sure","waffl","second-guess","overthink"] },
  { id: "discipline", label: "Discipline", words: ["discipline","promise","routine","woke","slept in","skipped","consistent","showed up","follow through","non-negotiable"] },
  { id: "confidence", label: "Confidence", words: ["confiden","doubt","imposter","not good enough","nervous","insecure","out of my depth","earned"] },
  { id: "stress", label: "Stress", words: ["stress","overwhelm","anxious","anxiety","tense","pressure","spiral","too much","burn"] },
  { id: "sales", label: "Sales", words: ["deal","prospect","pipeline","call","buyer","demo","outbound","quota","close","discovery","objection","champion"] },
  { id: "relationships", label: "Marriage", words: ["sara","wife","marriage","we argued","she said","listened","connection","date night"] },
  { id: "fatherhood", label: "Fatherhood", words: ["margo","daughter","play","bedtime","laugh","daddy","she asked","little"] },
  { id: "health", label: "Health", words: ["sleep","slept","training","workout","spin","boxing","lift","recovery","whoop","tired","energy","alcohol","drank","ate"] },
  { id: "faith", label: "Faith", words: ["pray","prayer","scripture","god","lord","grace","church","stillness","psalm","faith"] },
  { id: "identity", label: "Identity", words: ["kind of man","who i want","becoming","the man i","character","integrity","vote for"] },
  { id: "ambition", label: "Ambition", words: ["ambition","promotion","president's club","win","prove","bigger","next level","hungry","building"] },
  { id: "money", label: "Money", words: ["money","debt","loan","budget","commission","spend","paid","afford","savings"] },
  { id: "gratitude", label: "Gratitude", words: ["grateful","gratitude","thankful","lucky","appreciate","blessed"] },
  { id: "comparison", label: "Comparison", words: ["compare","comparison","everyone else","behind","should be further","they have","jealous","envy"] },
  { id: "learning", label: "Learning", words: ["learn","reading","book","framework","studied","podcast","notes","practice"] },
];

const countThemes = (entries) => {
  const counts = {};
  for (const t of THEMES) counts[t.id] = { id: t.id, label: t.label, n: 0, days: new Set(), samples: [] };
  for (const e of entries) {
    const hay = ((e.q || "") + " " + (e.t || "")).toLowerCase();
    for (const t of THEMES) {
      if (t.words.some((w) => hay.includes(w))) {
        counts[t.id].n += 1;
        counts[t.id].days.add(e.d);
        if (counts[t.id].samples.length < 4) counts[t.id].samples.push(e);
      }
    }
  }
  return Object.values(counts)
    .map((c) => ({ ...c, days: c.days.size }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);
};

/* ── the index: compact, month-sharded, built for years ───── */
const INDEX_SECTIONS = {
  morning: "morning",
  evening: "evening",
  journal: "journal",
  wife: "marriage",
  daughter: "fatherhood",
  faith: "faith",
  body: "health",
  craft: "sales",
};

function dayToIndexRows(dateKey, day, journal) {
  const rows = [];
  const push = (sec, q, t) => {
    const text = String(t || "").trim();
    if (text.length < 3) return;
    rows.push({ d: dateKey, sec, q: q || "", t: text.slice(0, 600) });
  };
  if (!day && !journal) return rows;
  if (day) {
    if (day.intention) push("identity", "Who I want to be today", day.intention);
    const am = day.am || {};
    (am.gratitude || []).forEach((g) => push("gratitude", "Grateful for", g));
    push("confidence", "What reminds me I'm capable", am.confidence);
    push("morning", "Looking forward to", am.excitement);
    push("marriage", "How I show up for my people today", am.relationship);
    push("morning", "The thing I'm tempted to avoid", am.hard);
    push("identity", "Today's declaration", am.declaration);
    (day.morning || []).forEach((a) => push("morning", a.q, a.a));
    (day.evening || []).forEach((a) => push("evening", a.q, a.a));
    (day.priorities || []).forEach((p) => p.t && push("morning", "What matters today", p.t));
    const nest = [["wife","marriage"],["daughter","fatherhood"],["faith","faith"],["body","health"]];
    for (const [k, sec] of nest) {
      const o = day[k] || {};
      for (const [q, v] of Object.entries(o)) push(sec, q, v);
    }
  }
  if (journal) (journal.entries || []).forEach((e) => push("journal", e.prompt || "Free writing", e.text));
  return rows;
}

/* One shard is read-modify-written, so two overlapping writes to the same month
   would interleave and drop rows. Chain them per shard instead. */
const idxChains = new Map();

function writeIndex(dateKey, day, journal) {
  const key = "tj:idx:" + monthKey(dateKey);
  const prior = idxChains.get(key) || Promise.resolve();
  const next = prior.then(async () => {
    const cur = (await S.get(key)) || []; // a real read failure throws, aborting the write
    const rest = cur.filter((r) => r.d !== dateKey);
    const rows = dayToIndexRows(dateKey, day, journal);
    await S.set(key, [...rest, ...rows].sort((a, b) => (a.d < b.d ? -1 : 1)));
  });
  // keep the chain alive after a failure, but don't leave an unhandled rejection
  idxChains.set(key, next.catch(() => {}));
  return next;
}

async function readIndex(months = 4, endKey) {
  const end = endKey || keyOf(new Date());
  const out = [];
  const d = parseKey(end);
  for (let i = 0; i < months; i++) {
    const mk = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const rows = await S.get("tj:idx:" + mk);
    if (rows) out.push(...rows);
    d.setMonth(d.getMonth() - 1);
  }
  return out.sort((a, b) => (a.d < b.d ? -1 : 1));
}

/* ── model access ─────────────────────────────────────────── */
/* The key lives on this device and goes nowhere but api.anthropic.com. Direct
   browser calls need the dangerous-direct-browser-access header; "bring your
   own key" is the acknowledged use for it, and it is this app's whole posture. */
const MODEL = "claude-sonnet-5";

const VOICE = `You are the reflective layer inside TJ's private journal. TJ is 36, a husband to Sara, father to Margo, works in sales, practices his faith, and is trying to become steadier.

Rules you do not break:
- Work only from the entries given. Never invent an event, person, or quote. If the entries do not support a claim, do not make it.
- Do not flatter. Do not open with praise. Do not be agreeable by default.
- When his own words contradict each other, say so plainly and cite the dates.
- Frame interpretation as hypothesis, not verdict: "I may be reading this wrong, but..."
- Be specific. "You seem stressed" is worthless. Name the situation, the pattern, the trigger.
- Short sentences. No therapy-speak, no wellness clichés, no exclamation marks, no em-dashes.
- You are not his friend and not his fan. You are the part of him that keeps the receipts.`;

async function askModel({ system, messages, maxTokens = 1200 }) {
  let key;
  try {
    key = await S.get("tj:apikey");
  } catch (e) {
    throw new Error("Couldn't read the stored key. Try again.");
  }
  if (!key) throw new Error("No API key set. Add one in Settings → Data.");
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system: system || VOICE,
        messages,
      }),
    });
  } catch (e) {
    throw new Error("No connection. Writing and reading still work offline.");
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error("That key was refused. Check it in Settings → Data.");
    if (res.status === 429) throw new Error("Too many requests just now. Try again in a minute.");
    if (res.status >= 500) throw new Error("The model is unavailable right now. Try again shortly.");
    throw new Error("Model request failed (" + res.status + ")");
  }
  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

async function askJSON(args) {
  const raw = await askModel(args);
  const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();
  const start = clean.search(/[[{]/);
  const end = Math.max(clean.lastIndexOf("]"), clean.lastIndexOf("}"));
  if (start < 0 || end < 0) throw new Error("Unreadable response");
  return JSON.parse(clean.slice(start, end + 1));
}

const digest = (rows, limit = 130) => {
  const use = rows.slice(-limit);
  return use.map((r) => `${r.d} [${r.sec}] ${r.q ? r.q + " — " : ""}${r.t}`).join("\n").slice(0, 22000);
};

/* ── shapes ───────────────────────────────────────────────── */
const ANCHORS = [
  { id: "wife", label: "Sara", line: "Listen before solving." },
  { id: "daughter", label: "Margo", line: "20 minutes fully present." },
  { id: "discipline", label: "Discipline", line: "Keep the promises I made this morning." },
  { id: "faith", label: "Faith", line: "Prayer, scripture, or stillness." },
  { id: "health", label: "Health", line: "Do the boring basics well." },
  { id: "sales", label: "Sales", line: "Improve judgment, not just activity." },
];

const MORNING_POOL = [
  "How do I feel this morning?",
  "What matters most today?",
  "What could derail me?",
  "Who do I want to be today?",
  "What relationship deserves attention today?",
  "What decision am I avoiding?",
  "What am I grateful for?",
  "What am I pretending not to know?",
  "Where am I likely to take the easy path today?",
  "What would make today feel well spent?",
  "What am I carrying that isn't mine?",
  "What would the version of me I respect do first?",
];

const EVENING_POOL = [
  "Did I act like the man I want to be today?",
  "Where did I handle something well?",
  "Where did I make life harder than it needed to be?",
  "What surprised me?",
  "What would I repeat?",
  "What changes tomorrow?",
  "What did I avoid today?",
  "Who got my best attention today?",
  "What did I get wrong, and how quickly did I admit it?",
];

const DEFAULT_IDENTITY = [
  "I can be frustrated without making someone else feel small.",
  "My family gets presence, not leftovers.",
  "I make decisions without needing certainty.",
  "I keep promises to myself.",
  "I can be wrong without becoming defensive.",
];

const SECTIONS = [
  { id: "today", label: "Today", fixed: true },
  { id: "people", label: "People" },
  { id: "faith", label: "Faith" },
  { id: "journal", label: "Journal" },
  { id: "patterns", label: "Patterns" },
  { id: "judgment", label: "Judgment" },
  { id: "library", label: "Library" },
  { id: "becoming", label: "Becoming" },
  { id: "talk", label: "Talk" },
];

const emptyDay = (date) => ({
  date,
  intention: "",
  priorities: [{ t: "", done: false }, { t: "", done: false }, { t: "", done: false }],
  morning: [],
  evening: [],
  am: { energy: "", headspace: "", gratitude: ["", "", ""], affId: "", affAccepted: false, affEvidence: "",
        confidence: "", excitement: "", relationship: "", hard: "", hardMove: "",
        declaration: "", declarationSrc: "", signing: false },
  anchors: {},
  disciplineNote: "",
  wife: { listen: "", understood: "", leak: "", appreciate: "", easier: "" },
  daughter: { present: "", laugh: "", taught: "", memory: "", ritual: "" },
  faith: { reading: "", stood: "", prayer: "", gratitude: "", question: "", action: "" },
  body: { sleep: "", training: "", nutrition: "", energy: "", recovery: "", alcohol: "", stress: "" },
});

const V1_EVENING = { man: "Did I act like the man I want to be today?", well: "What went well?", missed: "Where did I miss?", tomorrow: "What changes tomorrow?", vote: "Did I vote for the person I'm becoming?" };
const V1_WIFE = { need: "listen", easier: "easier", leak: "leak", note: "appreciate" };
const V1_KID = { present: "present", laugh: "laugh", ritual: "ritual", note: "memory" };

/* records written by the first version of this app still open cleanly */
const migrate = (saved) => {
  if (!saved) return saved;
  const out = { ...saved };
  if (out.evening && !Array.isArray(out.evening)) {
    out.evening = Object.entries(out.evening)
      .filter(([, v]) => typeof v === "string" && v.trim())
      .map(([k, v]) => ({ id: uid(), q: V1_EVENING[k] || k, a: v, src: "rotation" }));
  }
  if (out.morning && !Array.isArray(out.morning)) out.morning = [];
  for (const [from, map] of [["wife", V1_WIFE], ["daughter", V1_KID]]) {
    const o = out[from];
    if (!o) continue;
    const moved = { ...o };
    for (const [oldK, newK] of Object.entries(map)) {
      if (moved[oldK] && !moved[newK]) { moved[newK] = moved[oldK]; delete moved[oldK]; }
    }
    out[from] = moved;
  }
  if (out.body && out.body.note && !out.body.energy) { out.body.energy = out.body.note; delete out.body.note; }
  return out;
};

const mergeDay = (date, rawSaved) => {
  const base = emptyDay(date);
  if (!rawSaved) return base;
  const saved = migrate(rawSaved);
  const out = { ...base, ...saved, date };
  for (const k of Object.keys(base)) {
    const b = base[k];
    if (b && typeof b === "object" && !Array.isArray(b)) out[k] = { ...b, ...(saved[k] || {}) };
    if (Array.isArray(b) && !Array.isArray(saved[k])) out[k] = b;
  }
  if (out.priorities.length !== 3) out.priorities = base.priorities;
  if (!Array.isArray(out.am.gratitude) || out.am.gratitude.length !== 3) out.am.gratitude = ["", "", ""];
  return out;
};

const emptyCore = () => ({
  names: { wife: "Sara", daughter: "Margo" },
  anchorLines: ANCHORS.reduce((a, x) => ((a[x.id] = x.line), a), {}),
  identity: DEFAULT_IDENTITY.map((text) => ({ id: uid(), text, since: keyOf(new Date()), versions: [] })),
  goals: [],
  nonNegotiables: [
    { id: uid(), label: "Wake and sleep window" },
    { id: uid(), label: "Training" },
    { id: uid(), label: "Most important task before reactive work" },
  ],
  affirmations: SEED_AFFIRMATIONS.map(([text, cat]) => ({ id: uid(), text, cat })),
  openingFavs: [],
  quoteFavs: [],
  wins: [],
  morningMode: "standard",
  freq: FREQ_KEYS.reduce((a, [k]) => ((a[k] = k === "gratitude" || k === "identity" || k === "affirmation" ? "always" : "often"), a), {}),
  order: SECTIONS.map((s) => s.id),
  hidden: [],
  adaptive: "often", // often | sometimes | never
  ai: true,
  customPrompts: { morning: [], evening: [] },
  retired: [],
});

/* `deals` stays in the shape even though the Deals tab is gone: the records are
   still the owner's, still exported, and dropping them would lose written work. */
const emptyLib = () => ({ insights: [], blindspots: [], experiments: [], books: [], kb: [], decisions: [], deals: [], calls: [], language: [], recs: [], affSuggestions: [] });

/* A persisted `order` from an older build used to win wholesale, so any section
   added later was invisible in the nav forever. Reconcile against SECTIONS. */
const mergeCore = (saved) => {
  const base = emptyCore();
  if (!saved) return base;
  const out = { ...base, ...saved, customPrompts: { ...base.customPrompts, ...(saved.customPrompts || {}) } };
  const known = SECTIONS.map((s) => s.id);
  const kept = (Array.isArray(saved.order) ? saved.order : []).filter((id) => known.includes(id));
  out.order = [...kept, ...known.filter((id) => !kept.includes(id))];
  out.hidden = (Array.isArray(saved.hidden) ? saved.hidden : [])
    .filter((id) => known.includes(id) && !(SECTIONS.find((s) => s.id === id) || {}).fixed);
  return out;
};

/* ── deterministic prompt rotation ────────────────────────── */
const hashStr = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};
function rotate(pool, dateKey, n, salt) {
  if (pool.length === 0) return [];
  const out = [];
  let i = hashStr(dateKey + salt) % pool.length;
  const seen = new Set();
  while (out.length < Math.min(n, pool.length)) {
    if (!seen.has(i)) {
      seen.add(i);
      out.push(pool[i]);
    }
    i = (i + 1 + (hashStr(dateKey + salt + out.length) % 3)) % pool.length;
    if (seen.size >= pool.length) break;
  }
  return out;
}

/* ══════════ primitives ════════════════════════════════════ */
function Eyebrow({ children, style }) {
  return (
    <div style={{ fontFamily: SANS, fontSize: 10.5, letterSpacing: "0.15em", textTransform: "uppercase", color: C.ink28, fontWeight: 500, ...style }}>
      {children}
    </div>
  );
}

function Rule({ soft, style }) {
  return <div style={{ height: 1, background: soft ? C.lineSoft : C.line, width: "100%", ...style }} />;
}

function Title({ children, sub }) {
  return (
    <div style={{ paddingTop: 12, paddingBottom: 24 }}>
      <h1 style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 38, lineHeight: 1.06, letterSpacing: "-0.024em", color: C.ink, margin: 0 }}>
        {children}
      </h1>
      {sub ? (
        <div style={{ fontFamily: SANS, fontSize: 14.5, color: C.ink45, marginTop: 10, lineHeight: 1.5, maxWidth: 440 }}>{sub}</div>
      ) : null}
    </div>
  );
}

function Grow({ value, onChange, placeholder, serif, size = 16.5, color, minH = 26, style, onFocus, onBlur, ariaLabel }) {
  const ref = useRef(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(minH, el.scrollHeight) + "px";
  }, [minH]);
  useEffect(() => { resize(); }, [value, resize]);
  useEffect(() => {
    const f = () => resize();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, [resize]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value || ""}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel || placeholder}
      className="tj-field"
      style={{
        fontFamily: serif ? SERIF : SANS,
        fontSize: size,
        lineHeight: serif ? 1.55 : 1.52,
        color: color || C.ink,
        fontWeight: serif ? 300 : 400,
        letterSpacing: serif ? "-0.006em" : "0",
        ...style,
      }}
    />
  );
}

function Prompt({ q, value, onChange, placeholder, last, small }) {
  return (
    <div style={{ padding: "20px 0 18px" }}>
      <div style={{ fontFamily: SERIF, fontSize: small ? 17 : 18.5, fontWeight: 300, color: C.ink, letterSpacing: "-0.012em", lineHeight: 1.35, marginBottom: 9 }}>
        {q}
      </div>
      <Grow value={value} onChange={onChange} placeholder={placeholder || "…"} ariaLabel={q} />
      {!last && <Rule soft style={{ marginTop: 18 }} />}
    </div>
  );
}

function Section({ label, children, note, top = 34 }) {
  return (
    <section style={{ marginTop: top }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Eyebrow>{label}</Eyebrow>
        {note ? <span style={{ fontFamily: SANS, fontSize: 11.5, color: C.ink16, textAlign: "right" }}>{note}</span> : null}
      </div>
      <Rule style={{ marginTop: 11 }} />
      {children}
    </section>
  );
}

function Tap({ children, onClick, style, aria, disabled }) {
  return (
    <button className="tj-tap" onClick={onClick} aria-label={aria} disabled={disabled} style={style}>
      {children}
    </button>
  );
}

function Segment({ options, value, onChange }) {
  return (
    <div className="tj-seg">
      {options.map((o) => (
        <Tap
          key={o.id}
          onClick={() => onChange(o.id)}
          style={{
            fontFamily: SANS, fontSize: 13, letterSpacing: "0.03em", whiteSpace: "nowrap",
            color: value === o.id ? C.ink : C.ink28, padding: "8px 0", position: "relative", transition: "color .35s ease",
          }}
        >
          {o.label}
          <span style={{ position: "absolute", left: 0, right: 0, bottom: 2, height: 1, background: value === o.id ? C.accent : "transparent", transition: "background .35s ease" }} />
        </Tap>
      ))}
    </div>
  );
}

function Dots({ n = 5, value = 0, onChange, size = 7 }) {
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
      {Array.from({ length: n }).map((_, i) => (
        <Tap key={i} aria={`Set ${i + 1} of ${n}`} onClick={() => onChange(value === i + 1 ? i : i + 1)} style={{ padding: "8px 2px" }}>
          <span style={{ display: "block", width: size, height: size, borderRadius: "50%", background: i < value ? C.accent : "transparent", border: `1px solid ${i < value ? C.accent : C.ink16}`, transition: "all .3s cubic-bezier(.2,.8,.2,1)" }} />
        </Tap>
      ))}
    </div>
  );
}

function Ghost({ children, onClick, disabled }) {
  return (
    <Tap onClick={onClick} disabled={disabled} style={{ fontFamily: SANS, fontSize: 13, color: disabled ? C.ink16 : C.ink45, padding: "16px 0", letterSpacing: "0.01em", textAlign: "left" }}>
      {children}
    </Tap>
  );
}

/* provenance mark — the whole point of the honesty rule */
function Mark({ kind, detail }) {
  const label = kind === "generated" ? "Generated" : kind === "counted" ? "Counted" : "Your words";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: SANS, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.ink16 }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: kind === "generated" ? C.accent : "transparent", border: `1px solid ${kind === "you" ? C.ink16 : C.accent}`, opacity: kind === "counted" ? 0.55 : 1 }} />
      {label}
      {detail ? ` · ${detail}` : ""}
    </span>
  );
}

function Working({ label = "Reading your entries" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "22px 0", fontFamily: SANS, fontSize: 13, color: C.ink45 }}>
      <span className="tj-pulse" />
      {label}
    </div>
  );
}

function Note({ children }) {
  return <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink28, lineHeight: 1.6, padding: "14px 0" }}>{children}</div>;
}

function Empty({ children }) {
  return <div style={{ fontFamily: SERIF, fontSize: 17.5, fontWeight: 300, color: C.ink28, padding: "26px 0 6px", lineHeight: 1.5, maxWidth: 460 }}>{children}</div>;
}

/* ── record list ──────────────────────────────────────────── */
function RecordList({ records, fields, onChange, onAdd, onDelete, addLabel, empty, titleKey, meta, openId, setOpenId }) {
  const [local, setLocal] = useState(null);
  const open = openId !== undefined ? openId : local;
  const setOpen = setOpenId || setLocal;
  return (
    <div>
      {records.length === 0 && <Empty>{empty}</Empty>}
      {records.map((r) => {
        const isOpen = open === r.id;
        return (
          <div key={r.id} style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
            <Tap onClick={() => setOpen(isOpen ? null : r.id)} style={{ display: "flex", width: "100%", gap: 14, alignItems: "baseline", padding: "18px 0", textAlign: "left" }}>
              <span style={{ flex: 1, fontFamily: SERIF, fontSize: 17.5, fontWeight: 300, color: r[titleKey] ? C.ink : C.ink28, lineHeight: 1.4, letterSpacing: "-0.01em" }}>
                {r[titleKey] || "Untitled"}
              </span>
              <span style={{ fontFamily: SANS, fontSize: 10.5, color: C.ink16, whiteSpace: "nowrap", letterSpacing: "0.04em" }}>
                {meta ? meta(r) : midDate(r.created || keyOf(new Date()))}
              </span>
              <span style={{ color: isOpen ? C.accent : C.ink16, fontSize: 15, lineHeight: 1, transform: isOpen ? "rotate(45deg)" : "none", transition: "all .35s cubic-bezier(.2,.8,.2,1)" }}>+</span>
            </Tap>
            <div style={{ maxHeight: isOpen ? 6000 : 0, opacity: isOpen ? 1 : 0, overflow: "hidden", transition: "max-height .6s cubic-bezier(.2,.8,.2,1), opacity .4s ease" }}>
              <div style={{ paddingBottom: 12 }}>
                {fields.map((f, i) => {
                  if (f.when && !f.when(r)) return null;
                  if (f.type === "dots")
                    return (
                      <div key={f.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderTop: `1px solid ${C.lineSoft}` }}>
                        <Eyebrow>{f.q}</Eyebrow>
                        <Dots value={r[f.key] || 0} onChange={(v) => onChange(r.id, f.key, v)} />
                      </div>
                    );
                  if (f.type === "select")
                    return (
                      <div key={f.key} style={{ padding: "16px 0", borderTop: `1px solid ${C.lineSoft}` }}>
                        <Eyebrow style={{ marginBottom: 10 }}>{f.q}</Eyebrow>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
                          {f.options.map((o) => (
                            <Tap key={o} onClick={() => onChange(r.id, f.key, o)} style={{ fontFamily: SANS, fontSize: 12.5, padding: "5px 0", color: r[f.key] === o ? C.accent : C.ink28, transition: "color .3s" }}>
                              {o}
                            </Tap>
                          ))}
                        </div>
                      </div>
                    );
                  if (f.type === "date")
                    return (
                      <div key={f.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderTop: `1px solid ${C.lineSoft}` }}>
                        <Eyebrow>{f.q}</Eyebrow>
                        <input type="date" className="tj-date" value={r[f.key] || ""} onChange={(e) => onChange(r.id, f.key, e.target.value)} aria-label={f.q} />
                      </div>
                    );
                  return (
                    <div key={f.key} style={{ paddingTop: i === 0 ? 4 : 0 }}>
                      <Prompt q={f.q} value={r[f.key]} onChange={(v) => onChange(r.id, f.key, v)} placeholder={f.ph} small={f.small} />
                    </div>
                  );
                })}
                <Tap onClick={() => { setOpen(null); onDelete(r.id); }} style={{ fontFamily: SANS, fontSize: 12, color: C.ink16, padding: "10px 0 20px", letterSpacing: "0.05em" }}>
                  Delete
                </Tap>
              </div>
            </div>
          </div>
        );
      })}
      <Ghost onClick={() => { const id = onAdd(); if (id) setOpen(id); }}>
        <span style={{ color: C.accent, marginRight: 8 }}>+</span>
        {addLabel}
      </Ghost>
    </div>
  );
}

/* ══════════ TODAY — morning light, evening dark ═══════════ */
function Today({ day, core, lib, setD, setC, setLib, date, todayKey, mode, setMode, index, ai, ink, setInk, themes }) {
  const [showBody, setShowBody] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const seeded = useRef("");
  const answers = day.evening || [];

  const pool = [...EVENING_POOL, ...(core.customPrompts.evening || [])].filter((p) => !core.retired.includes(p));

  useEffect(() => {
    if (mode !== "evening") return;
    if (!day || day.date !== date) return;
    const tag = date + "evening";
    if (seeded.current === tag) return;
    seeded.current = tag;
    if ((day.evening || []).length === 0) {
      setD(["evening"], rotate(pool, date, 3, "evening").map((q) => ({ id: uid(), q, a: "", src: "rotation" })));
    }
  }, [date, mode, day, pool, setD]);

  const askForQuestion = async () => {
    setBusy(true); setErr("");
    try {
      if (index.length < 6) throw new Error("Not enough written yet. Keep going for a few days.");
      const out = await askJSON({
        messages: [{ role: "user", content: `My journal entries, oldest first.\n\n${digest(index)}\n\nWrite two evening questions for ${longDate(date)}. They must come from what is actually in these entries: a pattern that repeats, a contradiction, something I keep circling without resolving. Reference the specific thing. Do not ask generic journal questions. Do not be gentle.\n\nReturn only JSON: ["question one","question two"]` }],
        maxTokens: 500,
      });
      const qs = (Array.isArray(out) ? out : []).slice(0, 2).filter((q) => typeof q === "string");
      if (!qs.length) throw new Error("Nothing came back.");
      setD(["evening"], [...answers, ...qs.map((q) => ({ id: uid(), q, a: "", src: "generated" }))]);
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(false);
  };

  const bodyRows = [["sleep", "Sleep"], ["training", "Training"], ["nutrition", "Nutrition"], ["energy", "Energy"], ["recovery", "Recovery"], ["stress", "Stress"], ["alcohol", "Alcohol"]];
  const am = day.am || {};

  return (
    <div>
      <div style={{ paddingTop: 4 }}>
        <Segment options={[{ id: "morning", label: "Morning" }, { id: "evening", label: "Evening" }]} value={mode} onChange={setMode} />
      </div>

      {mode === "morning" ? (
        <Morning day={day} core={core} lib={lib} setD={setD} setC={setC} setLib={setLib} date={date} todayKey={todayKey}
          index={index} ai={ai} ink={ink} setInk={setInk} themes={themes} />
      ) : (
        <>
          <Title>{date === todayKey ? "Evening." : longDate(date)}</Title>

          <div>
            {day.intention ? (
              <>
                <Eyebrow>This morning you said</Eyebrow>
                <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 300, color: C.ink70, lineHeight: 1.35, marginTop: 12, letterSpacing: "-0.018em" }}>{day.intention}</div>
              </>
            ) : (
              <Empty>You didn't write an intention this morning. Start here instead.</Empty>
            )}
            {am.declaration && (
              <div style={{ marginTop: 18, paddingLeft: 14, borderLeft: `1px solid ${C.line}` }}>
                <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 300, fontStyle: "italic", color: C.ink45, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{am.declaration}</div>
              </div>
            )}
            <Rule style={{ marginTop: 20 }} />
          </div>

          <Section label="Tonight">
            {answers.map((a, i) => (
              <div key={a.id}>
                <div style={{ padding: "20px 0 18px" }}>
                  <div style={{ fontFamily: SERIF, fontSize: 18.5, fontWeight: 300, color: C.ink, letterSpacing: "-0.012em", lineHeight: 1.35, marginBottom: 9 }}>{a.q}</div>
                  {a.src === "generated" && <div style={{ marginBottom: 10 }}><Mark kind="generated" detail={`from ${index.length} entries`} /></div>}
                  <Grow value={a.a} ariaLabel={a.q} onChange={(v) => setD(["evening"], answers.map((x) => (x.id === a.id ? { ...x, a: v } : x)))} placeholder="…" />
                </div>
                {i < answers.length - 1 && <Rule soft />}
              </div>
            ))}
            {busy ? <Working /> : (
              <Ghost onClick={askForQuestion} disabled={!ai}>
                <span style={{ color: C.accent, marginRight: 8 }}>+</span>
                {ai ? "Ask me something harder" : "Reflection is switched off in settings"}
              </Ghost>
            )}
            {err && <Note>{err}</Note>}
          </Section>

          <Anchors day={day} core={core} setD={setD} setC={setC} evening />

          <Section label="Discipline" note="the promises you made yourself">
            {(core.nonNegotiables || []).filter((n) => n.label).map((n) => (
              <div key={n.id} style={{ fontFamily: SERIF, fontSize: 17.5, fontWeight: 300, color: C.ink45, padding: "9px 0", lineHeight: 1.5 }}>{n.label}</div>
            ))}
            <div style={{ paddingTop: 12 }}>
              <Grow serif size={18} value={day.disciplineNote} onChange={(v) => setD(["disciplineNote"], v)} placeholder="Did you keep them? One line." ariaLabel="Discipline note" />
            </div>
          </Section>

          <div style={{ marginTop: 30 }}>
            {!showBody ? (
              <Ghost onClick={() => setShowBody(true)}><span style={{ color: C.accent, marginRight: 8 }}>—</span>Log the body</Ghost>
            ) : (
              <div className="tj-reveal">
                <Section label="Body" note="basics first" top={4}>
                  {bodyRows.map(([k, label], i) => (
                    <div key={k} style={{ padding: "16px 0", borderBottom: i < bodyRows.length - 1 ? `1px solid ${C.lineSoft}` : "none" }}>
                      <Eyebrow style={{ marginBottom: 7 }}>{label}</Eyebrow>
                      <Grow value={day.body[k]} onChange={(v) => setD(["body", k], v)} placeholder="…" ariaLabel={label} />
                    </div>
                  ))}
                  <Note>Notes only. Nothing here is medical advice — take health questions to a clinician.</Note>
                </Section>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Anchors({ day, core, setD, setC, evening }) {
  const done = ANCHORS.filter((a) => day.anchors[a.id]).length;
  const names = core.names || {};
  return (
    <Section label="Anchors" note={done > 0 ? `${done} of 6 honored` : evening ? "what held?" : "reminders, not chores"}>
      {ANCHORS.map((a, i) => {
        const on = !!day.anchors[a.id];
        const label = a.id === "wife" ? names.wife || "Sara" : a.id === "daughter" ? names.daughter || "Margo" : a.label;
        return (
          <div key={a.id} className="tj-anchor" style={{ borderBottom: i < ANCHORS.length - 1 ? `1px solid ${C.lineSoft}` : "none", paddingLeft: on ? 14 : 0, borderLeft: `1px solid ${on ? C.accent : "transparent"}` }}>
            <Tap onClick={() => setD(["anchors"], { ...day.anchors, [a.id]: !on })} aria={`Honor ${label}`} style={{ display: "block", width: "100%", textAlign: "left", padding: "17px 0 6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <Eyebrow style={{ color: on ? C.accent : C.ink28, transition: "color .4s" }}>{label}</Eyebrow>
                <span style={{ fontFamily: SANS, fontSize: 11, color: C.accent, opacity: on ? 1 : 0, transition: "opacity .4s" }}>honored</span>
              </div>
            </Tap>
            <div style={{ paddingBottom: 16, opacity: on ? 0.45 : 1, transition: "opacity .45s ease" }}>
              <Grow serif size={18} value={core.anchorLines[a.id] ?? a.line} ariaLabel={label}
                onChange={(v) => setC("anchorLines", { ...core.anchorLines, [a.id]: v })} placeholder={a.line} />
            </div>
          </div>
        );
      })}
    </Section>
  );
}

/* ══════════ PEOPLE ════════════════════════════════════════ */
function People({ day, setD, core, setC, index, lib, setLib, ai }) {
  const [who, setWho] = useState("wife");
  const names = core.names || { wife: "Sara", daughter: "Margo" };
  const [thread, setThread] = useState(null);
  const [busy, setBusy] = useState(false);

  const wifeQs = [
    ["listen", "Did I listen before solving?"],
    ["understood", "Did I make her feel understood?"],
    ["leak", "Where did impatience leak out?"],
    ["appreciate", "What did I appreciate about her today?"],
    ["easier", "What would make her week easier?"],
  ];
  const kidQs = [
    ["present", "Was I fully present?"],
    ["laugh", "What made her laugh?"],
    ["taught", "What did she teach me today?"],
    ["memory", "What memory did we make?"],
    ["ritual", "What is becoming our thing?"],
  ];
  const qs = who === "wife" ? wifeQs : kidQs;
  const sec = who === "wife" ? "marriage" : "fatherhood";

  const recent = useMemo(() => index.filter((r) => r.sec === sec).slice(-40), [index, sec]);

  const readBack = async () => {
    setBusy(true);
    setThread(null);
    try {
      const out = await askModel({
        messages: [{
          role: "user",
          content: `These are my journal entries about ${who === "wife" ? `my wife ${names.wife}` : `my daughter ${names.daughter}`}, oldest first.\n\n${digest(recent, 40)}\n\nIn under 120 words, tell me what you notice across these. Not a summary. A pattern I might not see, or a contradiction. If there isn't enough here to say anything honest, say that instead of reaching. No advice unless I'd be worse off without it.`,
        }],
        maxTokens: 400,
      });
      setThread(out);
    } catch (e) {
      setThread("Couldn't reach the model. " + String(e.message || e));
    }
    setBusy(false);
  };

  return (
    <div>
      <div style={{ paddingTop: 12, paddingBottom: 20 }}>
        <Grow serif size={38} minH={46} value={names[who]} ariaLabel="Name"
          onChange={(v) => setC("names", { ...names, [who]: v })} placeholder="Her name"
          style={{ lineHeight: 1.06, letterSpacing: "-0.024em" }} />
        <div style={{ fontFamily: SANS, fontSize: 14.5, color: C.ink45, marginTop: 10, lineHeight: 1.5, maxWidth: 430 }}>
          {who === "wife" ? "The person who sees the version of you nobody else does." : "She'll remember how it felt, not what you did."}
        </div>
      </div>

      <Segment options={[{ id: "wife", label: "Wife" }, { id: "daughter", label: "Daughter" }]} value={who} onChange={(v) => { setWho(v); setThread(null); }} />
      <Rule style={{ marginTop: 6 }} />

      <div className="tj-reveal" key={who}>
        <Section label="Today" top={24}>
          {qs.map(([k, q], i) => (
            <Prompt key={k} q={q} value={day[who][k]} onChange={(v) => setD([who, k], v)} last={i === qs.length - 1} />
          ))}
        </Section>

        <Section label="Over time" note={`${recent.length} ${recent.length === 1 ? "entry" : "entries"}`}>
          {thread ? (
            <div className="tj-reveal" style={{ paddingTop: 18 }}>
              <Mark kind="generated" detail={`from ${recent.length} entries`} />
              <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 300, color: C.ink, lineHeight: 1.62, marginTop: 14, whiteSpace: "pre-wrap" }}>{thread}</div>
              <div style={{ display: "flex", gap: 22, paddingTop: 18 }}>
                <Tap onClick={() => { setLib("kb", [{ id: uid(), type: "Relationship", text: thread, created: keyOf(new Date()), src: "generated" }, ...lib.kb]); setThread(null); }}
                  style={{ fontFamily: SANS, fontSize: 13, color: C.accent, padding: "6px 0" }}>Keep this</Tap>
                <Tap onClick={() => setThread(null)} style={{ fontFamily: SANS, fontSize: 13, color: C.ink28, padding: "6px 0" }}>Dismiss</Tap>
              </div>
            </div>
          ) : busy ? <Working /> : recent.length < 5 ? (
            <Empty>Write here for a week or so. Then there'll be something to read back to you.</Empty>
          ) : (
            <Ghost onClick={readBack} disabled={!ai}><span style={{ color: C.accent, marginRight: 8 }}>—</span>What do you notice?</Ghost>
          )}
        </Section>
      </div>
    </div>
  );
}

/* ══════════ FAITH ═════════════════════════════════════════ */
function Faith({ day, setD, index, ai, lib, setLib }) {
  const [thread, setThread] = useState(null);
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => index.filter((r) => r.sec === "faith"), [index]);

  const surface = async () => {
    setBusy(true);
    try {
      const out = await askModel({
        messages: [{ role: "user", content: `These are my devotion entries, oldest first.\n\n${digest(rows, 50)}\n\nWhat keeps returning? Name it in under 90 words. Quote my own words back where it helps. Do not preach, do not encourage, do not score anything.` }],
        maxTokens: 350,
      });
      setThread(out);
    } catch (e) {
      setThread("Couldn't reach the model. " + String(e.message || e));
    }
    setBusy(false);
  };

  return (
    <div>
      <div style={{ paddingTop: 28, paddingBottom: 6 }}>
        <h1 style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 40, letterSpacing: "-0.028em", color: C.ink, margin: 0, fontStyle: "italic" }}>Be still.</h1>
      </div>
      <Rule soft style={{ marginBottom: 4 }} />
      <div style={{ paddingTop: 8 }}>
        <Prompt q="Scripture or reading" value={day.faith.reading} onChange={(v) => setD(["faith", "reading"], v)} placeholder="Where you were today." />
        <Prompt q="What stood out" value={day.faith.stood} onChange={(v) => setD(["faith", "stood"], v)} placeholder="Even if you don't know why yet." />
        <Prompt q="Prayer" value={day.faith.prayer} onChange={(v) => setD(["faith", "prayer"], v)} placeholder="For whom, and for what." />
        <Prompt q="Gratitude" value={day.faith.gratitude} onChange={(v) => setD(["faith", "gratitude"], v)} />
        <Prompt q="A question I'm sitting with" value={day.faith.question} onChange={(v) => setD(["faith", "question"], v)} placeholder="Doubt is allowed here." />
        <Prompt q="One thing this should produce today" value={day.faith.action} onChange={(v) => setD(["faith", "action"], v)} placeholder="Something with hands and feet." last />
      </div>

      <Section label="Recurring" note={`${rows.length} ${rows.length === 1 ? "entry" : "entries"}`}>
        {thread ? (
          <div className="tj-reveal" style={{ paddingTop: 18 }}>
            <Mark kind="generated" detail={`from ${rows.length} entries`} />
            <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 300, color: C.ink, lineHeight: 1.62, marginTop: 14, whiteSpace: "pre-wrap" }}>{thread}</div>
            <div style={{ display: "flex", gap: 22, paddingTop: 18 }}>
              <Tap onClick={() => { setLib("kb", [{ id: uid(), type: "Faith", text: thread, created: keyOf(new Date()), src: "generated" }, ...lib.kb]); setThread(null); }} style={{ fontFamily: SANS, fontSize: 13, color: C.accent, padding: "6px 0" }}>Keep this</Tap>
              <Tap onClick={() => setThread(null)} style={{ fontFamily: SANS, fontSize: 13, color: C.ink28, padding: "6px 0" }}>Dismiss</Tap>
            </div>
          </div>
        ) : busy ? <Working /> : rows.length < 5 ? (
          <Empty>Not yet. Come back when there's more here.</Empty>
        ) : (
          <Ghost onClick={surface} disabled={!ai}><span style={{ color: C.accent, marginRight: 8 }}>—</span>What keeps returning?</Ghost>
        )}
      </Section>
    </div>
  );
}

/* ══════════ JOURNAL ═══════════════════════════════════════ */
const JOURNAL_PROMPTS = [
  "What is actually on my mind?",
  "What am I avoiding?",
  "Where am I rationalizing?",
  "What would make me change my mind?",
  "What am I grateful for?",
  "What do I need to let go of?",
  "What am I not admitting yet?",
  "Where am I being unfair to myself?",
  "Where am I giving myself too much credit?",
];

function Journal({ journal, setJournal, date, setDate, dates, focus, setFocus, ink, setInk, index, inkDates, core }) {
  const [text, setText] = useState("");
  const [prompt, setPrompt] = useState(null);
  const [browsing, setBrowsing] = useState(false);
  const [tab, setTab] = useState("type");
  const [full, setFull] = useState(false);
  const entries = (journal && journal.entries) || [];

  useEffect(() => { setText(""); setPrompt(null); }, [date]);

  const save = () => {
    if (!text.trim()) { setFocus(false); return; }
    setJournal({ ...journal, date, entries: [{ id: uid(), ts: Date.now(), prompt, text: text.trim() }, ...entries] });
    setText("");
    setPrompt(null);
    setFocus(false);
  };

  return (
    <div>
      {!focus && (
        <>
          <Title sub={longDate(date)}>Journal</Title>
          <Segment options={[{ id: "type", label: "Type" }, { id: "write", label: "Write" }, { id: "history", label: "History" }]} value={tab} onChange={setTab} />
          <Rule style={{ marginTop: 6, marginBottom: 20 }} />
        </>
      )}

      {tab === "history" && !focus && (
        <div className="tj-reveal">
          <History index={index} inkDates={inkDates} core={core} setDate={setDate} date={date} />
        </div>
      )}

      {tab === "write" && !focus && (
        <div className="tj-reveal">
          <Ink value={ink.journal} onChange={(v) => setInk("journal", v)} height={430} full={full} onToggleFull={() => setFull((f) => !f)} label="Journal notebook" />
          <Note>Handwriting is kept as written. Nothing is converted to text.</Note>
        </div>
      )}

      {tab === "type" && !focus && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 18px", paddingBottom: 16 }}>
            {JOURNAL_PROMPTS.map((p) => (
              <Tap key={p} onClick={() => { setPrompt(p); setFocus(true); }}
                style={{ fontFamily: SANS, fontSize: 12.5, color: prompt === p ? C.accent : C.ink45, padding: "7px 0", textAlign: "left", lineHeight: 1.4 }}>
                {p}
              </Tap>
            ))}
          </div>
          <Rule />
        </>
      )}

      {(tab === "type" || focus) && (
      <div style={{ paddingTop: focus ? 4 : 22 }}>
        {focus && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 20 }}>
            <Eyebrow>{longDate(date)}</Eyebrow>
            <Tap onClick={save} style={{ fontFamily: SANS, fontSize: 14, color: text.trim() ? C.accent : C.ink45, padding: "6px 0 6px 12px" }}>
              {text.trim() ? "Save entry" : "Done"}
            </Tap>
          </div>
        )}
        {prompt && (
          <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 300, fontStyle: "italic", color: C.ink70, marginBottom: 14, letterSpacing: "-0.016em" }}>{prompt}</div>
        )}
        <Grow serif size={19} minH={focus ? 320 : 110} value={text} onChange={setText} onFocus={() => setFocus(true)}
          placeholder="Start anywhere." ariaLabel="Journal entry" style={{ lineHeight: 1.72 }} />
        {!focus && text.trim() && (
          <Tap onClick={save} style={{ fontFamily: SANS, fontSize: 13, color: C.accent, padding: "12px 0" }}>Save entry</Tap>
        )}
      </div>
      )}

      {!focus && tab === "type" && (
        <>
          {entries.length > 0 && (
            <Section label="Today's entries">
              {entries.map((e) => (
                <div key={e.id} style={{ padding: "20px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
                  {e.prompt && <Eyebrow style={{ marginBottom: 8 }}>{e.prompt}</Eyebrow>}
                  <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 300, color: C.ink70, lineHeight: 1.68, whiteSpace: "pre-wrap" }}>{e.text}</div>
                  <Tap onClick={() => setJournal({ ...journal, entries: entries.filter((x) => x.id !== e.id) })}
                    style={{ fontFamily: SANS, fontSize: 11.5, color: C.ink16, padding: "12px 0 0", letterSpacing: "0.05em" }}>Delete</Tap>
                </div>
              ))}
            </Section>
          )}
          <Section label="Earlier">
            {!browsing ? (
              <Ghost onClick={() => setBrowsing(true)}><span style={{ color: C.accent, marginRight: 8 }}>—</span>Browse past entries</Ghost>
            ) : (
              <div className="tj-reveal" style={{ paddingTop: 6 }}>
                {dates.filter((d) => d !== date).length === 0 && <Empty>Nothing earlier yet.</Empty>}
                {dates.filter((d) => d !== date).map((d) => (
                  <Tap key={d} onClick={() => { setDate(d); setBrowsing(false); }}
                    style={{ display: "flex", width: "100%", justifyContent: "space-between", padding: "16px 0", borderBottom: `1px solid ${C.lineSoft}`, fontFamily: SERIF, fontSize: 17.5, fontWeight: 300, color: C.ink70 }}>
                    <span>{longDate(d)}</span>
                    <span style={{ color: C.ink16, fontSize: 14 }}>›</span>
                  </Tap>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

/* ══════════ PATTERNS — insights, blind spots, experiments, synthesis ══ */
function Patterns({ lib, setLib, index, core, date, ai, week, setWeek, month, setMonth }) {
  const [tab, setTab] = useState("insights");
  const themes = useMemo(() => countThemes(index), [index]);
  const opts = [
    { id: "insights", label: "Insights" },
    { id: "blind", label: "Blind spots" },
    { id: "experiments", label: "Experiments" },
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
  ];
  return (
    <div>
      <Title sub="What the record says, as opposed to what you remember.">Patterns</Title>
      <Segment options={opts} value={tab} onChange={setTab} />
      <Rule style={{ marginTop: 6 }} />
      <div key={tab} className="tj-reveal">
        {tab === "insights" && <Insights lib={lib} setLib={setLib} index={index} themes={themes} ai={ai} />}
        {tab === "blind" && <BlindSpots lib={lib} setLib={setLib} index={index} ai={ai} />}
        {tab === "experiments" && <Experiments lib={lib} setLib={setLib} index={index} ai={ai} date={date} />}
        {tab === "week" && <Synthesis scope="week" record={week} setRecord={setWeek} index={index} date={date} ai={ai} lib={lib} setLib={setLib} />}
        {tab === "month" && <Synthesis scope="month" record={month} setRecord={setMonth} index={index} date={date} ai={ai} lib={lib} setLib={setLib} />}
      </div>
    </div>
  );
}

function Verdict({ item, onSet, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      {editing ? (
        <div style={{ paddingTop: 12 }}>
          <Grow serif size={18} value={item.text} onChange={onEdit} ariaLabel="Edit insight" />
          <Tap onClick={() => setEditing(false)} style={{ fontFamily: SANS, fontSize: 13, color: C.accent, padding: "12px 0 0" }}>Done</Tap>
        </div>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0 20px", paddingTop: 14, alignItems: "center" }}>
        {[["agree", "That's true"], ["partly", "Partly"], ["disagree", "You're wrong"]].map(([v, label]) => (
          <Tap key={v} onClick={() => onSet(item.verdict === v ? null : v)}
            style={{ fontFamily: SANS, fontSize: 12.5, padding: "8px 0", color: item.verdict === v ? C.accent : C.ink28, transition: "color .3s" }}>
            {label}
          </Tap>
        ))}
        <Tap onClick={() => setEditing((e) => !e)} style={{ fontFamily: SANS, fontSize: 12.5, padding: "8px 0", color: C.ink28 }}>Edit</Tap>
        <Tap onClick={onDelete} style={{ fontFamily: SANS, fontSize: 12.5, padding: "8px 0", color: C.ink28 }}>Dismiss</Tap>
      </div>
      {item.verdict && (
        <div style={{ paddingTop: 4 }}>
          <Grow value={item.note} onChange={(v) => onSet(item.verdict, v)} size={16} placeholder="Add context, so it reads you better next time." ariaLabel="Context" />
        </div>
      )}
    </>
  );
}

function Insights({ lib, setLib, index, themes, ai }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const live = lib.insights;

  const generate = async () => {
    setBusy(true); setErr("");
    try {
      if (index.length < 12) throw new Error("There isn't enough here yet. Around two weeks of entries is where this starts working.");
      const prior = live.filter((i) => i.verdict).map((i) => `- "${i.text}" → I said: ${i.verdict}${i.note ? ". " + i.note : ""}`).join("\n");
      const out = await askJSON({
        messages: [{ role: "user", content: `My journal entries, oldest first:\n\n${digest(index)}\n\n${prior ? `Previously you offered these readings and I responded:\n${prior}\nTake my corrections seriously. Do not repeat a reading I rejected.\n\n` : ""}Give me three or four hypotheses about how I actually operate. Each must be grounded in specific entries, and each should tell me something I have not already said outright about myself. Prefer the uncomfortable one. Include at least one that connects two areas of my life I treat as separate.\n\nReturn only JSON: [{"text":"the hypothesis, 1-2 sentences, opening with 'I may be reading this wrong, but' only where you are genuinely unsure","evidence":"the dates and specifics it rests on, one sentence"}]` }],
      });
      const items = (Array.isArray(out) ? out : []).map((o) => ({ id: uid(), text: String(o.text || ""), evidence: String(o.evidence || ""), created: keyOf(new Date()), n: index.length, verdict: null, note: "" }));
      setLib("insights", [...items, ...live]);
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(false);
  };

  const set = (id, verdict, note) => setLib("insights", live.map((i) => (i.id === id ? { ...i, verdict, note: note !== undefined ? note : i.note } : i)));

  return (
    <div>
      <Section label="Themes" note="counted, not interpreted" top={24}>
        {themes.length === 0 ? <Empty>Nothing counted yet. These appear as you write.</Empty> : (
          <div style={{ paddingTop: 16 }}>
            <div style={{ paddingBottom: 12 }}><Mark kind="counted" detail={`${index.length} entries`} /></div>
            {themes.slice(0, 8).map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: `1px solid ${C.lineSoft}` }}>
                <span style={{ fontFamily: SANS, fontSize: 14, color: C.ink70 }}>{t.label}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontFamily: SANS, fontSize: 11.5, color: C.ink28 }}>{t.days} {t.days === 1 ? "day" : "days"}</span>
                  <span className="tj-bar"><span style={{ display: "block", height: "100%", width: `${Math.min(100, (t.n / themes[0].n) * 100)}%`, background: C.accent, opacity: 0.6 }} /></span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section label="What I'm learning about you" note={live.length ? `${live.length} ${live.length === 1 ? "reading" : "readings"}` : ""}>
        {live.length === 0 && !busy && <Empty>Nothing offered yet. These are hypotheses drawn from your entries, and you get to tell each one it's wrong.</Empty>}
        {live.map((i) => (
          <div key={i.id} style={{ padding: "26px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
            <Mark kind="generated" detail={`${midDate(i.created)} · from ${i.n} entries`} />
            <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 300, color: C.ink, lineHeight: 1.55, marginTop: 12, letterSpacing: "-0.012em" }}>{i.text}</div>
            {i.evidence && <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink28, lineHeight: 1.6, marginTop: 10 }}>{i.evidence}</div>}
            <Verdict item={i} onSet={(v, n) => set(i.id, v, n)} onEdit={(v) => setLib("insights", live.map((x) => (x.id === i.id ? { ...x, text: v, edited: true } : x)))} onDelete={() => setLib("insights", live.filter((x) => x.id !== i.id))} />
          </div>
        ))}
        {busy ? <Working label="Reading everything you've written" /> : (
          <Ghost onClick={generate} disabled={!ai}>
            <span style={{ color: C.accent, marginRight: 8 }}>—</span>
            {ai ? (live.length ? "Read me again" : "Read what I've written") : "Reflection is switched off in settings"}
          </Ghost>
        )}
        {err && <Note>{err}</Note>}
      </Section>
    </div>
  );
}

function BlindSpots({ lib, setLib, index, ai }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const live = lib.blindspots;

  const generate = async () => {
    setBusy(true); setErr("");
    try {
      if (index.length < 15) throw new Error("Not enough yet. This one needs a few weeks of material to be worth anything.");
      const out = await askJSON({
        messages: [{ role: "user", content: `My journal entries, oldest first:\n\n${digest(index)}\n\nFind what I am not seeing. Look specifically for: things I keep saying but never act on; contradictions between entries; goals I keep postponing; beliefs my own evidence does not support; places I sound defensive; a rationalization I reuse.\n\nThree items maximum. Each must quote or cite what I actually wrote and when. Be intellectually challenging, not accusatory. If you can only find one honest item, return one.\n\nReturn only JSON: [{"text":"the observation","evidence":"what in my entries supports it, with dates"}]` }],
      });
      const items = (Array.isArray(out) ? out : []).map((o) => ({ id: uid(), text: String(o.text || ""), evidence: String(o.evidence || ""), created: keyOf(new Date()), n: index.length, verdict: null, note: "" }));
      setLib("blindspots", [...items, ...live]);
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(false);
  };

  const set = (id, verdict, note) => setLib("blindspots", live.map((i) => (i.id === id ? { ...i, verdict, note: note !== undefined ? note : i.note } : i)));

  return (
    <Section label="Blind spots" note="the ones you'd argue with" top={24}>
      {live.length === 0 && !busy && <Empty>These are meant to be uncomfortable. Argue back — the disagreement is stored and used next time.</Empty>}
      {live.map((i) => (
        <div key={i.id} style={{ padding: "26px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
          <Mark kind="generated" detail={`${midDate(i.created)} · from ${i.n} entries`} />
          <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 300, color: C.ink, lineHeight: 1.55, marginTop: 12, letterSpacing: "-0.012em" }}>{i.text}</div>
          {i.evidence && <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink28, lineHeight: 1.6, marginTop: 10 }}>{i.evidence}</div>}
          <Verdict item={i} onSet={(v, n) => set(i.id, v, n)} onEdit={(v) => setLib("blindspots", live.map((x) => (x.id === i.id ? { ...x, text: v } : x)))} onDelete={() => setLib("blindspots", live.filter((x) => x.id !== i.id))} />
        </div>
      ))}
      {busy ? <Working label="Looking for what you keep stepping around" /> : (
        <Ghost onClick={generate} disabled={!ai}><span style={{ color: C.accent, marginRight: 8 }}>—</span>{ai ? "Show me what I'm missing" : "Reflection is switched off in settings"}</Ghost>
      )}
      {err && <Note>{err}</Note>}
    </Section>
  );
}

function Experiments({ lib, setLib, index, ai, date }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const live = lib.experiments;
  const fields = [
    { key: "title", q: "The experiment", ph: "One line." },
    { key: "hypothesis", q: "Hypothesis", ph: "If I do this, I expect…" },
    { key: "action", q: "The specific action", ph: "Small enough that you can't talk yourself out of it." },
    { key: "status", q: "Status", type: "select", options: ["Proposed", "Running", "Done", "Abandoned"] },
    { key: "outcome", q: "What actually happened?", when: (r) => r.status === "Done" || r.status === "Abandoned" },
    { key: "learned", q: "What did I learn?", when: (r) => r.status === "Done" || r.status === "Abandoned" },
  ];

  const suggest = async () => {
    setBusy(true); setErr("");
    try {
      if (index.length < 12) throw new Error("Not enough entries yet to suggest anything honest.");
      const out = await askJSON({
        messages: [{ role: "user", content: `My journal entries, oldest first:\n\n${digest(index)}\n\nSuggest two small behavioral experiments, seven days each, aimed at something my entries show I actually struggle with. Not advice, not a habit. A testable change with an observable result. Concrete and slightly awkward to do.\n\nReturn only JSON: [{"title":"short name","hypothesis":"if I do X I expect Y","action":"the exact instruction, one sentence, second person"}]` }],
        maxTokens: 600,
      });
      const items = (Array.isArray(out) ? out : []).map((o) => ({ id: uid(), created: date, title: String(o.title || ""), hypothesis: String(o.hypothesis || ""), action: String(o.action || ""), status: "Proposed", days: 7, started: date, src: "generated", n: index.length }));
      setLib("experiments", [...items, ...live]);
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(false);
  };

  return (
    <Section label="Experiments" note="hypothesis, not advice" top={24}>
      <div style={{ paddingTop: 6 }}>
        <RecordList
          records={live}
          titleKey="title"
          fields={fields}
          empty="An experiment is a claim you can be wrong about in seven days. Better than a resolution."
          addLabel="Design one yourself"
          meta={(r) => r.status || "Proposed"}
          onAdd={() => { const id = uid(); setLib("experiments", [{ id, created: date, started: date, days: 7, title: "", status: "Proposed" }, ...live]); return id; }}
          onChange={(id, k, v) => setLib("experiments", live.map((x) => (x.id === id ? { ...x, [k]: v, ...(k === "status" && v === "Running" ? { started: date } : {}) } : x)))}
          onDelete={(id) => setLib("experiments", live.filter((x) => x.id !== id))}
        />
      </div>
      {busy ? <Working label="Looking for something worth testing" /> : (
        <Ghost onClick={suggest} disabled={!ai}><span style={{ color: C.accent, marginRight: 8 }}>—</span>{ai ? "Suggest one from my patterns" : "Reflection is switched off in settings"}</Ghost>
      )}
      {err && <Note>{err}</Note>}
    </Section>
  );
}

function Synthesis({ scope, record, setRecord, index, date, ai, lib, setLib }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const isWeek = scope === "week";
  const start = isWeek ? mondayOf(date) : date.slice(0, 8) + "01";
  const rows = useMemo(() => index.filter((r) => r.d >= start && r.d <= date), [index, start, date]);
  const priorRows = useMemo(() => {
    const from = isWeek ? addDays(start, -7) : addDays(start, -31);
    return index.filter((r) => r.d >= from && r.d < start);
  }, [index, start, isWeek]);

  const run = async () => {
    setBusy(true); setErr("");
    try {
      if (rows.length < 5) throw new Error(`Not enough entries this ${scope} to interpret.`);
      const ask = isWeek
        ? `This week's entries (${longDate(start)} to ${longDate(date)}), oldest first:\n\n${digest(rows)}\n\nWrite my weekly synthesis. Interpret, do not summarize. Use these headings exactly, each one to three sentences, and skip any heading the entries say nothing real about:\n\nWhat mattered\nPatterns\nWins\nFriction\nRelationships\nDiscipline\nWork\nHealth\nFaith\nDecisions\nOne thing worth changing\n\nPlain text, no markdown symbols.`
        : `This month's entries, oldest first:\n\n${digest(rows)}\n\n${priorRows.length ? `And the month before, for comparison:\n\n${digest(priorRows, 60)}\n\n` : ""}Write my monthly reflection. Interpret, do not summarize. Use these headings exactly, one to three sentences each:\n\nWhat changed\nWhat I learned about myself\nStill unresolved\nImproved\nGot worse\nWhat I avoided\nA belief that shifted\n${priorRows.length ? "Then vs now — what I seemed to believe a month ago against what I seem to believe now, using my own words from both periods\n" : ""}What deserves attention next month\n\nPlain text, no markdown symbols. Be direct. If something got worse, say it got worse.`;
      const out = await askModel({ messages: [{ role: "user", content: ask }], maxTokens: 1000 });
      setRecord({ ...record, text: out, generated: new Date().toISOString(), n: rows.length });
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(false);
  };

  return (
    <div>
      <Section label={isWeek ? `Week of ${midDate(start)}` : monthName(monthKey(date))} note={`${rows.length} ${rows.length === 1 ? "entry" : "entries"}`} top={24}>
        {record && record.text ? (
          <div style={{ paddingTop: 20 }}>
            <Mark kind="generated" detail={`from ${record.n} entries`} />
            <div style={{ fontFamily: SERIF, fontSize: 18.5, fontWeight: 300, color: C.ink, lineHeight: 1.68, marginTop: 14, whiteSpace: "pre-wrap" }}>{record.text}</div>
            <div style={{ display: "flex", gap: 22, paddingTop: 18 }}>
              <Tap onClick={run} disabled={!ai} style={{ fontFamily: SANS, fontSize: 13, color: C.ink28, padding: "6px 0" }}>Run it again</Tap>
              <Tap onClick={() => setLib("kb", [{ id: uid(), type: "Lesson", text: record.text.slice(0, 600), created: date, src: "generated" }, ...lib.kb])} style={{ fontFamily: SANS, fontSize: 13, color: C.accent, padding: "6px 0" }}>Keep this</Tap>
            </div>
          </div>
        ) : busy ? <Working label={`Reading the ${scope}`} /> : (
          <>
            <Empty>{rows.length < 5 ? `Not enough written this ${scope} yet.` : `Ready when you are. ${rows.length} entries to read.`}</Empty>
            <Ghost onClick={run} disabled={!ai || rows.length < 5}><span style={{ color: C.accent, marginRight: 8 }}>—</span>Write the {scope === "week" ? "weekly" : "monthly"} synthesis</Ghost>
          </>
        )}
        {err && <Note>{err}</Note>}
      </Section>

      <Section label="Your own answer" note="before or after, doesn't matter">
        {(isWeek
          ? [["worked", "What worked?"], ["didnt", "What didn't?"], ["short", "Where did I fall short?"], ["next", "What matters next week?"], ["stop", "What should I stop doing?"]]
          : [["changed", "What changed?"], ["unresolved", "What recurring problem is still unresolved?"], ["avoided", "What did I avoid?"], ["belief", "What belief changed?"], ["attention", "What deserves more attention?"]]
        ).map(([k, q], i, arr) => (
          <Prompt key={k} q={q} value={(record && record[k]) || ""} onChange={(v) => setRecord({ ...record, [k]: v })} last={i === arr.length - 1} />
        ))}
      </Section>
    </div>
  );
}

/* ══════════ JUDGMENT ══════════════════════════════════════ */
function Judgment({ lib, setLib, index, ai, date }) {
  const [tab, setTab] = useState("decisions");
  const decFields = [
    { key: "title", q: "The decision", ph: "Say it in one line." },
    { key: "choice", q: "Current best choice" },
    { key: "why", q: "Why", ph: "The reasoning, not the feeling." },
    { key: "assumptions", q: "What am I assuming?", ph: "The things that must be true for this to work." },
    { key: "fears", q: "What am I afraid of here?", ph: "Name it, even if it's small." },
    { key: "change", q: "What evidence would change my mind?" },
    { key: "expected", q: "What I expect to happen", ph: "Specific enough to be wrong about." },
    { key: "review", q: "Review on", type: "date" },
    { key: "happened", q: "What actually happened?", when: (r) => r.review && r.review <= date },
    { key: "reasoning", q: "Was the reasoning sound?", type: "select", options: ["Sound", "Flawed"], when: (r) => r.happened },
    { key: "result", q: "Was the outcome good?", type: "select", options: ["Good", "Bad"], when: (r) => r.happened },
    { key: "learned", q: "What did I learn?", when: (r) => r.happened },
  ];
  const verdictOf = (d) => {
    if (!d.reasoning || !d.result) return "";
    if (d.reasoning === "Sound" && d.result === "Good") return "Good decision, good outcome";
    if (d.reasoning === "Sound" && d.result === "Bad") return "Good decision, bad outcome";
    if (d.reasoning === "Flawed" && d.result === "Good") return "Bad decision, lucky outcome";
    return "Bad decision, bad outcome";
  };

  /* Deals was a sales-job surface, not a TJ 3.0 one, and is gone. Any records
     already written stay in storage and in the JSON export — removing a tab is
     not a reason to destroy what was written into it. */
  const callFields = [
    { key: "title", q: "The call" },
    { key: "believed", q: "What did I think was happening?" },
    { key: "actual", q: "What was actually happening?" },
    { key: "question", q: "What question would have exposed that earlier?" },
    { key: "over", q: "Where did I over-explain?" },
    { key: "dots", q: "Where should I have let the buyer connect the dots?" },
    { key: "lesson", q: "The lesson, in one line" },
  ];

  const [langDraft, setLangDraft] = useState({ type: "Reframe", text: "" });
  const LANG = ["Reframe", "Question", "Cold email", "Objection", "Negotiation", "Close", "Buyer psychology"];
  const [busy, setBusy] = useState(false);
  const [read, setRead] = useState(null);

  const readJudgment = async () => {
    setBusy(true);
    try {
      const material = lib.calls.slice(0, 25)
        .map((c) => Object.entries(c).filter(([k, v]) => typeof v === "string" && v && !["id", "created"].includes(k)).map(([k, v]) => `${k}: ${v}`).join(" | "))
        .join("\n");
      if (material.length < 200) throw new Error("Log a few more calls first.");
      const out = await askModel({
        messages: [{ role: "user", content: `My call reviews:\n\n${material}\n\nWhat recurring judgment error shows up across these? Name one or two, in under 110 words, citing the specific reviews. If I keep making the same misread, say exactly what the misread is. No encouragement.` }],
        maxTokens: 350,
      });
      setRead(out);
    } catch (e) { setRead(String(e.message || e)); }
    setBusy(false);
  };

  return (
    <div>
      <Title sub="Not a CRM. A record of how you think when it counts.">Judgment</Title>
      <Segment options={[{ id: "decisions", label: "Decisions" }, { id: "calls", label: "Calls" }, { id: "language", label: "Language" }]} value={tab} onChange={setTab} />
      <Rule style={{ marginTop: 6 }} />

      <div key={tab} className="tj-reveal">
        {tab === "decisions" && (
          <Section label="Decision journal" note="separate the call from the result" top={24}>
            <div style={{ paddingTop: 6 }}>
              <RecordList
                records={lib.decisions} titleKey="title" fields={decFields}
                empty="A decision written down before the outcome is the only honest record you'll get."
                addLabel="Log a decision"
                meta={(d) => verdictOf(d) ? (d.reasoning === "Sound" ? "Sound call" : "Flawed call") : d.review && d.review <= date ? "Review due" : d.review ? midDate(d.review) : ""}
                onAdd={() => { const id = uid(); setLib("decisions", [{ id, created: date, title: "" }, ...lib.decisions]); return id; }}
                onChange={(id, k, v) => setLib("decisions", lib.decisions.map((x) => (x.id === id ? { ...x, [k]: v } : x)))}
                onDelete={(id) => setLib("decisions", lib.decisions.filter((x) => x.id !== id))}
              />
            </div>
            {lib.decisions.some((d) => verdictOf(d)) && (
              <div style={{ paddingTop: 26 }}>
                <Mark kind="counted" />
                <div style={{ paddingTop: 12 }}>
                  {lib.decisions.filter((d) => verdictOf(d)).map((d) => (
                    <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "11px 0", borderTop: `1px solid ${C.lineSoft}` }}>
                      <span style={{ fontFamily: SANS, fontSize: 13.5, color: C.ink70, flex: 1 }}>{d.title}</span>
                      <span style={{ fontFamily: SANS, fontSize: 11.5, color: d.reasoning === "Sound" ? C.accent : C.ink28, textAlign: "right" }}>{verdictOf(d)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {tab === "calls" && (
          <>
            <Section label="Call review" note="believed vs actual" top={24}>
              <div style={{ paddingTop: 6 }}>
                <RecordList records={lib.calls} titleKey="title" fields={callFields}
                  empty="The gap between what you believed and what was true is where the skill is."
                  addLabel="Review a call"
                  onAdd={() => { const id = uid(); setLib("calls", [{ id, created: date, title: "" }, ...lib.calls]); return id; }}
                  onChange={(id, k, v) => setLib("calls", lib.calls.map((x) => (x.id === id ? { ...x, [k]: v } : x)))}
                  onDelete={(id) => setLib("calls", lib.calls.filter((x) => x.id !== id))} />
              </div>
            </Section>
            <Section label="Across your reviews" note={`${lib.calls.length} logged`}>
              {read ? (
                <div className="tj-reveal" style={{ paddingTop: 18 }}>
                  <Mark kind="generated" detail={`from ${lib.calls.length} reviews`} />
                  <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 300, color: C.ink, lineHeight: 1.62, marginTop: 14, whiteSpace: "pre-wrap" }}>{read}</div>
                  <Tap onClick={() => setRead(null)} style={{ fontFamily: SANS, fontSize: 13, color: C.ink28, padding: "16px 0 0" }}>Dismiss</Tap>
                </div>
              ) : busy ? <Working /> : (
                <Ghost onClick={readJudgment} disabled={!ai}><span style={{ color: C.accent, marginRight: 8 }}>—</span>What do I keep getting wrong?</Ghost>
              )}
            </Section>
          </>
        )}

        {tab === "language" && (
          <Section label="Language" note={lib.language.length ? `${lib.language.length} saved` : ""} top={24}>
            <div style={{ padding: "18px 0 10px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 12 }}>
                {LANG.map((t) => (
                  <Tap key={t} onClick={() => setLangDraft((d) => ({ ...d, type: t }))}
                    style={{ fontFamily: SANS, fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase", color: langDraft.type === t ? C.accent : C.ink16, padding: "6px 0", transition: "color .3s" }}>{t}</Tap>
                ))}
              </div>
              <Grow serif size={18} value={langDraft.text} onChange={(v) => setLangDraft((d) => ({ ...d, text: v }))} placeholder="Write the line exactly as you'd say it." ariaLabel="New line" />
              {langDraft.text.trim() && (
                <Tap onClick={() => { setLib("language", [{ id: uid(), created: date, ...langDraft }, ...lib.language]); setLangDraft({ type: langDraft.type, text: "" }); }}
                  style={{ fontFamily: SANS, fontSize: 13, color: C.accent, padding: "14px 0 4px" }}>Save it</Tap>
              )}
            </div>
            <Rule />
            {lib.language.length === 0 && <Empty>The lines that worked are easy to lose. Keep them here.</Empty>}
            {LANG.filter((t) => lib.language.some((l) => l.type === t)).map((t) => (
              <div key={t} style={{ paddingTop: 22 }}>
                <Eyebrow style={{ color: C.ink16 }}>{t}</Eyebrow>
                {lib.language.filter((l) => l.type === t).map((l) => (
                  <div key={l.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
                    <span style={{ color: C.accent, fontSize: 14, lineHeight: "26px", opacity: 0.6 }}>—</span>
                    <div style={{ flex: 1, fontFamily: SERIF, fontSize: 18, fontWeight: 300, color: C.ink, lineHeight: 1.5 }}>{l.text}</div>
                    <Tap onClick={() => setLib("language", lib.language.filter((x) => x.id !== l.id))} style={{ color: C.ink16, fontSize: 13, padding: "4px 0 4px 8px" }} aria="Remove">×</Tap>
                  </div>
                ))}
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

/* ══════════ LIBRARY — books tied to outcomes, plus your own principles ══ */
const OUTCOMES = ["Decision-making","Relationships","Patience","Discipline","Negotiation","Sales judgment","Psychology","Faith","Health","Leadership","Happiness","Identity"];
const KB_TYPES = ["Principle","Lesson","Quote","Rule","Sales","Relationship","Faith","Health"];

function Library({ lib, setLib, index, ai, date }) {
  const [tab, setTab] = useState("books");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState({ type: "Principle", text: "" });

  const bookFields = [
    { key: "title", q: "Title" },
    { key: "author", q: "Author", small: true },
    { key: "outcome", q: "What it's for", type: "select", options: OUTCOMES },
    { key: "status", q: "Status", type: "select", options: ["Want to read", "Reading", "Read", "Abandoned", "Archived"] },
    { key: "why", q: "Why I want to read it" },
    { key: "trait", q: "What skill or trait it develops", small: true },
    { key: "relevance", q: "Why it's relevant right now", small: true },
    { key: "takeaways", q: "Key takeaways", when: (r) => r.status === "Reading" || r.status === "Read" },
    { key: "quotes", q: "Lines worth keeping", when: (r) => r.status === "Reading" || r.status === "Read" },
    { key: "helped", q: "Did this actually help?", type: "select", options: ["Yes", "Somewhat", "No", "Too early"], when: (r) => r.status === "Read" },
    { key: "rating", q: "Rating", type: "dots", when: (r) => r.status === "Read" },
  ];

  const recommend = async () => {
    setBusy(true); setErr("");
    try {
      if (index.length < 12) throw new Error("Not enough entries yet to recommend anything specific to you.");
      const have = lib.books.map((b) => b.title).filter(Boolean).join("; ");
      const out = await askJSON({
        messages: [{ role: "user", content: `My journal entries, oldest first:\n\n${digest(index, 90)}\n\n${have ? `Already in my library: ${have}. Do not repeat these.\n\n` : ""}Recommend three books. Each must connect to something specific in my entries, and the reason must name that thing. Real books only. No generic bestseller lists.\n\nReturn only JSON: [{"title":"","author":"","outcome":"one of: ${OUTCOMES.join(", ")}","why":"the reason, naming what in my entries prompted it, one or two sentences","trait":"the skill it develops, a few words"}]` }],
        maxTokens: 800,
      });
      setLib("recs", (Array.isArray(out) ? out : []).map((o) => ({ id: uid(), created: date, n: index.length, ...o })));
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(false);
  };

  const byStatus = (s) => lib.books.filter((b) => (b.status || "Want to read") === s);

  return (
    <div>
      <Title sub="The point isn't to collect books. It's to connect reading to an outcome.">Library</Title>
      <Segment options={[{ id: "books", label: "Books" }, { id: "kb", label: "Principles" }]} value={tab} onChange={setTab} />
      <Rule style={{ marginTop: 6 }} />

      <div key={tab} className="tj-reveal">
        {tab === "books" && (
          <>
            {lib.recs.length > 0 && (
              <Section label="Suggested for you" top={24}>
                {lib.recs.map((r) => (
                  <div key={r.id} style={{ padding: "22px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
                    <Mark kind="generated" detail={`from ${r.n} entries`} />
                    <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 300, color: C.ink, lineHeight: 1.3, marginTop: 10, letterSpacing: "-0.015em" }}>{r.title}</div>
                    <div style={{ fontFamily: SANS, fontSize: 13, color: C.ink45, marginTop: 5 }}>{r.author}{r.outcome ? ` · ${r.outcome}` : ""}</div>
                    <div style={{ fontFamily: SERIF, fontSize: 17.5, fontWeight: 300, color: C.ink70, lineHeight: 1.6, marginTop: 12 }}>{r.why}</div>
                    <div style={{ display: "flex", gap: 22, paddingTop: 14 }}>
                      <Tap onClick={() => { setLib("books", [{ id: uid(), created: date, title: r.title, author: r.author, outcome: r.outcome, why: r.why, trait: r.trait, status: "Want to read", src: "generated" }, ...lib.books]); setLib("recs", lib.recs.filter((x) => x.id !== r.id)); }}
                        style={{ fontFamily: SANS, fontSize: 13, color: C.accent, padding: "6px 0" }}>Add to library</Tap>
                      <Tap onClick={() => setLib("recs", lib.recs.filter((x) => x.id !== r.id))} style={{ fontFamily: SANS, fontSize: 13, color: C.ink28, padding: "6px 0" }}>Not for me</Tap>
                    </div>
                  </div>
                ))}
              </Section>
            )}

            {["Want to read", "Reading", "Read", "Abandoned", "Archived"].filter((s) => byStatus(s).length).map((s) => (
              <Section key={s} label={s} note={String(byStatus(s).length)} top={26}>
                <div style={{ paddingTop: 6 }}>
                  <RecordList records={byStatus(s)} titleKey="title" fields={bookFields} empty=""
                    addLabel="Add a book" meta={(b) => b.outcome || ""}
                    onAdd={() => { const id = uid(); setLib("books", [{ id, created: date, title: "", status: s }, ...lib.books]); return id; }}
                    onChange={(id, k, v) => setLib("books", lib.books.map((x) => (x.id === id ? { ...x, [k]: v } : x)))}
                    onDelete={(id) => setLib("books", lib.books.filter((x) => x.id !== id))} />
                </div>
              </Section>
            ))}

            {lib.books.length === 0 && (
              <Section label="Want to read" top={26}>
                <div style={{ paddingTop: 6 }}>
                  <RecordList records={[]} titleKey="title" fields={bookFields}
                    empty="Every book here should answer a question you're actually stuck on."
                    addLabel="Add a book"
                    onAdd={() => { const id = uid(); setLib("books", [{ id, created: date, title: "", status: "Want to read" }]); return id; }}
                    onChange={() => {}} onDelete={() => {}} />
                </div>
              </Section>
            )}

            <div style={{ marginTop: 10 }}>
              {busy ? <Working label="Matching books to what you keep writing about" /> : (
                <Ghost onClick={recommend} disabled={!ai}><span style={{ color: C.accent, marginRight: 8 }}>—</span>{ai ? "Recommend from my patterns" : "Reflection is switched off in settings"}</Ghost>
              )}
              {err && <Note>{err}</Note>}
            </div>
          </>
        )}

        {tab === "kb" && (
          <Section label="Principles and lessons" note={lib.kb.length ? `${lib.kb.length} kept` : "surfaced back to you later"} top={24}>
            <div style={{ padding: "18px 0 10px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 12 }}>
                {KB_TYPES.map((t) => (
                  <Tap key={t} onClick={() => setDraft((d) => ({ ...d, type: t }))}
                    style={{ fontFamily: SANS, fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase", color: draft.type === t ? C.accent : C.ink16, padding: "6px 0", transition: "color .3s" }}>{t}</Tap>
                ))}
              </div>
              <Grow serif size={18.5} value={draft.text} onChange={(v) => setDraft((d) => ({ ...d, text: v }))} placeholder="Something you want to still believe in five years." ariaLabel="New principle" />
              {draft.text.trim() && (
                <Tap onClick={() => { setLib("kb", [{ id: uid(), created: date, src: "you", ...draft }, ...lib.kb]); setDraft({ type: draft.type, text: "" }); }}
                  style={{ fontFamily: SANS, fontSize: 13, color: C.accent, padding: "14px 0 4px" }}>Keep it</Tap>
              )}
            </div>
            <Rule />
            {lib.kb.length === 0 && <Empty>When you write about something these touch on, the relevant one comes back to you in the morning.</Empty>}
            {lib.kb.map((k) => (
              <div key={k.id} style={{ padding: "20px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <Eyebrow style={{ color: C.ink16 }}>{k.type}</Eyebrow>
                  <Mark kind={k.src === "generated" ? "generated" : "you"} detail={midDate(k.created)} />
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 18.5, fontWeight: 300, color: C.ink, lineHeight: 1.6, marginTop: 10, whiteSpace: "pre-wrap" }}>{k.text}</div>
                <Tap onClick={() => setLib("kb", lib.kb.filter((x) => x.id !== k.id))} style={{ fontFamily: SANS, fontSize: 11.5, color: C.ink16, padding: "12px 0 0", letterSpacing: "0.05em" }}>Delete</Tap>
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

/* ══════════ BECOMING ══════════════════════════════════════ */
const AREAS = ["Relationships", "Performance", "Foundation", "Identity"];

function Becoming({ core, setC, index, ai, date }) {
  const [tab, setTab] = useState("identity");
  const [checking, setChecking] = useState(null);
  const [moments, setMoments] = useState({});
  const focusRef = useRef("");

  const goalFields = [
    { key: "title", q: "The outcome", ph: "What is true when this is done?" },
    { key: "why", q: "Why it matters", ph: "The reason that survives a bad week." },
    { key: "next", q: "Next action", ph: "The very next physical move." },
    { key: "target", q: "Target date", type: "date" },
    { key: "progress", q: "Progress", type: "dots" },
  ];

  const findMoments = async (s) => {
    setChecking(s.id);
    try {
      const out = await askJSON({
        messages: [{ role: "user", content: `My journal entries, oldest first:\n\n${digest(index, 110)}\n\nThis is one of my identity statements: "${s.text}"\n\nFind where my entries support it and where they contradict it. Quote my own words, short, with the date. Two of each at most. If there is no real evidence either way, return empty arrays rather than reaching.\n\nReturn only JSON: {"supports":[{"d":"YYYY-MM-DD","q":"my words"}],"contradicts":[{"d":"YYYY-MM-DD","q":"my words"}]}` }],
        maxTokens: 600,
      });
      setMoments((m) => ({ ...m, [s.id]: out }));
    } catch (e) {
      setMoments((m) => ({ ...m, [s.id]: { error: String(e.message || e) } }));
    }
    setChecking(null);
  };

  const reviseStatement = (s, v) => {
    setC("identity", core.identity.map((x) => (x.id === s.id ? { ...x, text: v } : x)));
  };
  const commitVersion = (s) => {
    const was = focusRef.current;
    if (!was || was === s.text) return;
    setC("identity", core.identity.map((x) => (x.id === s.id ? { ...x, versions: [...(x.versions || []), { text: was, at: date }] } : x)));
  };

  return (
    <div>
      <Title sub={tab === "identity" ? "Not scored. Checked against the record." : tab === "goals" ? "Four areas. No more." : "Three things you don't negotiate."}>
        {tab === "identity" ? "Who I'm becoming" : tab === "goals" ? "Goals" : "Discipline"}
      </Title>
      <Segment options={[{ id: "identity", label: "Identity" }, { id: "goals", label: "Goals" }, { id: "discipline", label: "Discipline" }]} value={tab} onChange={setTab} />
      <Rule style={{ marginTop: 6 }} />

      <div key={tab} className="tj-reveal">
        {tab === "identity" && (
          <Section label="Statements" top={24}>
            {core.identity.map((s) => {
              const m = moments[s.id];
              return (
                <div key={s.id} style={{ padding: "22px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <span style={{ color: C.accent, fontSize: 15, lineHeight: "30px", opacity: 0.5 }}>—</span>
                    <div style={{ flex: 1 }}>
                      <Grow serif size={19.5} value={s.text} ariaLabel="Identity statement"
                        onFocus={() => { focusRef.current = s.text; }}
                        onBlur={() => commitVersion(s)}
                        onChange={(v) => reviseStatement(s, v)}
                        placeholder="I am the kind of person who…" style={{ lineHeight: 1.45 }} />
                    </div>
                    <Tap onClick={() => setC("identity", core.identity.filter((x) => x.id !== s.id))} style={{ color: C.ink16, fontSize: 13, padding: "8px 0 8px 8px" }} aria="Remove">×</Tap>
                  </div>

                  {(s.versions || []).length > 0 && (
                    <div style={{ paddingLeft: 29, paddingTop: 10 }}>
                      <Eyebrow style={{ color: C.ink16 }}>Earlier wording</Eyebrow>
                      {(s.versions || []).slice(-2).map((v, i) => (
                        <div key={i} style={{ fontFamily: SERIF, fontSize: 15.5, fontWeight: 300, fontStyle: "italic", color: C.ink28, lineHeight: 1.5, paddingTop: 6 }}>
                          {v.text} <span style={{ fontFamily: SANS, fontSize: 10.5, letterSpacing: "0.08em" }}>· until {midDate(v.at)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {m && !m.error && (
                    <div className="tj-reveal" style={{ paddingLeft: 29, paddingTop: 16 }}>
                      <Mark kind="generated" detail="from your entries" />
                      {["supports", "contradicts"].map((k) => (
                        (m[k] || []).length > 0 && (
                          <div key={k} style={{ paddingTop: 12 }}>
                            <Eyebrow style={{ color: k === "supports" ? C.accent : C.ink28 }}>{k === "supports" ? "Evidence for" : "Evidence against"}</Eyebrow>
                            {(m[k] || []).map((q, i) => (
                              <div key={i} style={{ fontFamily: SERIF, fontSize: 16.5, fontWeight: 300, color: C.ink70, lineHeight: 1.55, paddingTop: 8 }}>
                                “{q.q}” <span style={{ fontFamily: SANS, fontSize: 10.5, color: C.ink16, letterSpacing: "0.06em" }}>{q.d ? midDate(q.d) : ""}</span>
                              </div>
                            ))}
                          </div>
                        )
                      ))}
                      {!(m.supports || []).length && !(m.contradicts || []).length && <Note>Nothing in your entries speaks to this yet.</Note>}
                    </div>
                  )}
                  {m && m.error && <div style={{ paddingLeft: 29 }}><Note>{m.error}</Note></div>}

                  {checking === s.id ? (
                    <div style={{ paddingLeft: 29 }}><Working label="Looking for moments" /></div>
                  ) : !m && ai && index.length > 10 && (
                    <div style={{ paddingLeft: 29 }}>
                      <Tap onClick={() => findMoments(s)} style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink28, padding: "12px 0 0" }}>Check this against what I've written</Tap>
                    </div>
                  )}
                </div>
              );
            })}
            <Ghost onClick={() => setC("identity", [...core.identity, { id: uid(), text: "", since: date, versions: [] }])}>
              <span style={{ color: C.accent, marginRight: 8 }}>+</span>Add a statement
            </Ghost>
          </Section>
        )}

        {tab === "goals" && AREAS.map((area) => {
          const list = core.goals.filter((g) => g.area === area);
          return (
            <Section key={area} label={area} top={24} note={list.length ? String(list.length) : ""}>
              <div style={{ paddingTop: 6 }}>
                <RecordList records={list} titleKey="title" fields={goalFields} empty="Nothing here yet."
                  addLabel={`Add a ${area.toLowerCase()} goal`} meta={(r) => (r.target ? midDate(r.target) : "")}
                  onAdd={() => { const id = uid(); setC("goals", [...core.goals, { id, area, created: date, title: "", progress: 0 }]); return id; }}
                  onChange={(id, k, v) => setC("goals", core.goals.map((g) => (g.id === id ? { ...g, [k]: v } : g)))}
                  onDelete={(id) => setC("goals", core.goals.filter((g) => g.id !== id))} />
              </div>
            </Section>
          );
        })}

        {tab === "discipline" && (
          <Section label="Non-negotiables" note="three, no more" top={24}>
            {(core.nonNegotiables || []).map((n, i) => (
              <div key={n.id} style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "20px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
                <span style={{ fontFamily: SANS, fontSize: 11, color: C.ink16, marginTop: 7, letterSpacing: "0.1em" }}>{pad(i + 1)}</span>
                <div style={{ flex: 1 }}>
                  <Grow serif size={19} value={n.label} ariaLabel="Non-negotiable"
                    onChange={(v) => setC("nonNegotiables", core.nonNegotiables.map((x) => (x.id === n.id ? { ...x, label: v } : x)))}
                    placeholder="What you don't negotiate with yourself about." />
                </div>
                <Tap onClick={() => setC("nonNegotiables", core.nonNegotiables.filter((x) => x.id !== n.id))} style={{ color: C.ink16, fontSize: 13, padding: "8px 0 8px 8px" }} aria="Remove">×</Tap>
              </div>
            ))}
            {(core.nonNegotiables || []).length < 3 && (
              <Ghost onClick={() => setC("nonNegotiables", [...core.nonNegotiables, { id: uid(), label: "" }])}>
                <span style={{ color: C.accent, marginRight: 8 }}>+</span>Add one
              </Ghost>
            )}
            <Note>You mark these each evening. They show up in the weekly synthesis, not as a streak.</Note>
          </Section>
        )}
      </div>
    </div>
  );
}

/* ══════════ TALK ══════════════════════════════════════════ */
function Talk({ talk, setTalk, index, ai }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const msgs = (talk && talk.messages) || [];

  useEffect(() => {
    const el = endRef.current;
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs.length, busy]);

  const send = async (override) => {
    const content = (override || text).trim();
    if (!content || busy) return;
    const next = [...msgs, { role: "user", content, ts: Date.now() }];
    /* functional throughout: `talk` was captured at call time and spread again
       after the await, discarding anything written during the request */
    setTalk((t) => ({ ...t, messages: next }));
    setText("");
    setBusy(true);
    try {
      const out = await askModel({
        system: `${VOICE}\n\nYou are in conversation with TJ. Keep replies short — three or four sentences unless he asks for more. Ask one question at a time. If it is not clear what he wants, ask whether he wants advice, a question, or space to think, and then do that one thing. When something he says contradicts an earlier entry, say so and name the date.\n\nHis entries, oldest first:\n${digest(index, 110)}`,
        messages: next.map((m) => ({ role: m.role, content: m.content })),
        maxTokens: 700,
      });
      setTalk((t) => ({ ...t, messages: [...next, { role: "assistant", content: out, ts: Date.now() }] }));
    } catch (e) {
      setTalk((t) => ({ ...t, messages: [...next, { role: "assistant", content: "Couldn't reach the model just now. " + String(e.message || e), ts: Date.now(), error: true }] }));
    }
    setBusy(false);
  };

  const openers = ["What's been on your mind?", "Tell me what I keep missing about you.", "I want to think out loud."];

  return (
    <div>
      <div style={{ paddingTop: 12, paddingBottom: 18 }}>
        <h1 style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 38, lineHeight: 1.06, letterSpacing: "-0.024em", color: C.ink, margin: 0 }}>Talk</h1>
        <div style={{ fontFamily: SANS, fontSize: 14, color: C.ink45, marginTop: 10, lineHeight: 1.5 }}>
          Reads everything you've written here. {index.length} entries so far.
        </div>
      </div>
      <Rule />

      {msgs.length === 0 && (
        <div style={{ paddingTop: 30 }}>
          <Empty>Not a chatbot with a memory of this conversation only. It has the whole record, and it will use it.</Empty>
          <div style={{ paddingTop: 18 }}>
            {openers.map((o) => (
              <Tap key={o} onClick={() => send(o)} disabled={!ai}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "15px 0", borderBottom: `1px solid ${C.lineSoft}`, fontFamily: SERIF, fontSize: 18, fontWeight: 300, color: C.ink70 }}>
                {o}
              </Tap>
            ))}
          </div>
        </div>
      )}

      <div style={{ paddingTop: 20 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ padding: "16px 0" }}>
            {m.role === "user" ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div className="tj-bubble">{m.content}</div>
              </div>
            ) : (
              <div>
                <div style={{ paddingBottom: 10 }}><Mark kind="generated" /></div>
                <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 300, color: C.ink, lineHeight: 1.66, whiteSpace: "pre-wrap" }}>{m.content}</div>
              </div>
            )}
          </div>
        ))}
        {busy && <Working label="Thinking" />}
        <div ref={endRef} />
      </div>

      <div className="tj-composer">
        <Grow value={text} onChange={setText} placeholder={ai ? "Say it plainly." : "Reflection is switched off in settings"} ariaLabel="Message" size={17} minH={30} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10 }}>
          {msgs.length > 0 ? (
            <Tap onClick={() => setTalk({ ...talk, messages: [] })} style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink28, padding: "6px 0" }}>Start fresh</Tap>
          ) : <span />}
          <Tap onClick={() => send()} disabled={!ai || !text.trim() || busy} style={{ fontFamily: SANS, fontSize: 14, color: text.trim() && ai ? C.accent : C.ink16, padding: "6px 0 6px 12px" }}>Send</Tap>
        </div>
      </div>
    </div>
  );
}

/* ══════════ SETTINGS ══════════════════════════════════════ */
function ApiKeyField({ apiKey, onChange }) {
  const [draft, setDraft] = useState("");
  if (apiKey) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontFamily: SANS, fontSize: 15, color: C.ink70, letterSpacing: "0.04em" }}>
          •••• {apiKey.slice(-4)}
        </span>
        <Tap onClick={() => onChange("")} style={{ fontFamily: SANS, fontSize: 13, color: C.ink28, padding: "6px 0" }}>Remove</Tap>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <input
        type="password"
        className="tj-date"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="sk-ant-…"
        aria-label="Anthropic API key"
        style={{ flex: 1 }}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <Tap onClick={() => { if (draft.trim()) { onChange(draft.trim()); setDraft(""); } }}
        style={{ fontFamily: SANS, fontSize: 13, color: draft.trim() ? C.accent : C.ink16, padding: "6px 0" }}>
        Save
      </Tap>
    </div>
  );
}

function Settings({ core, setC, apiKey, onApiKeyChange, onExport, onImport, close }) {
  const [tab, setTab] = useState("morning");
  const [newPrompt, setNewPrompt] = useState("");
  const [which, setWhich] = useState("morning");
  const order = core.order.filter((id) => SECTIONS.some((s) => s.id === id));
  const move = (id, dir) => {
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    next.splice(j, 0, next.splice(i, 1)[0]);
    setC("order", next);
  };
  const pool = which === "morning" ? MORNING_POOL : EVENING_POOL;
  const custom = core.customPrompts[which] || [];

  return (
    <div className="tj-sheet" onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 16 }}>
        <Eyebrow>Settings</Eyebrow>
        <Tap onClick={close} style={{ fontFamily: SANS, fontSize: 14, color: C.ink45, padding: "4px 0 4px 12px" }}>Close</Tap>
      </div>
      <Segment options={[{ id: "morning", label: "Morning" }, { id: "sections", label: "Sections" }, { id: "prompts", label: "Questions" }, { id: "data", label: "Data" }]} value={tab} onChange={setTab} />
      <Rule style={{ marginTop: 6 }} />
      <div className="tj-sheet-body" key={tab}>
        {tab === "morning" && (
          <div style={{ paddingTop: 14 }}>
            <Eyebrow style={{ marginBottom: 12 }}>How long the morning takes</Eyebrow>
            <div style={{ display: "flex", gap: 20, paddingBottom: 4 }}>
              {[["quick", "Quick", "2–3 min"], ["standard", "Standard", "5–8 min"], ["deep", "Deep", "10–15 min"]].map(([v, l, t]) => (
                <Tap key={v} onClick={() => setC("morningMode", v)} style={{ textAlign: "left", padding: "8px 0" }}>
                  <div style={{ fontFamily: SANS, fontSize: 14, color: (core.morningMode || "standard") === v ? C.accent : C.ink45 }}>{l}</div>
                  <div style={{ fontFamily: SANS, fontSize: 11, color: C.ink16, marginTop: 3 }}>{t}</div>
                </Tap>
              ))}
            </div>
            <Rule style={{ marginTop: 12 }} />
            <Eyebrow style={{ margin: "20px 0 4px" }}>How often each part appears</Eyebrow>
            {FREQ_KEYS.map(([k, label]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
                <span style={{ fontFamily: SANS, fontSize: 14.5, color: C.ink70 }}>{label}</span>
                <div style={{ display: "flex", gap: 13 }}>
                  {["always", "often", "sometimes", "off"].map((v) => (
                    <Tap key={v} onClick={() => setC("freq", { ...(core.freq || {}), [k]: v })}
                      style={{ fontFamily: SANS, fontSize: 11.5, padding: "6px 0", color: ((core.freq || {})[k] || "often") === v ? C.accent : C.ink16 }}>{v}</Tap>
                  ))}
                </div>
              </div>
            ))}
            <Note>Gratitude, affirmation and identity carry the morning. The rest rotate so it never becomes the same form twice.</Note>
          </div>
        )}
        {tab === "sections" && (
          <div style={{ paddingTop: 8 }}>
            {order.map((id) => {
              const s = SECTIONS.find((x) => x.id === id);
              const hidden = core.hidden.includes(id);
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
                  <span style={{ flex: 1, fontFamily: SANS, fontSize: 15.5, color: hidden ? C.ink28 : C.ink }}>{s.label}</span>
                  <Tap onClick={() => move(id, -1)} aria="Move up" style={{ color: C.ink28, padding: "6px 8px", fontSize: 14 }}>↑</Tap>
                  <Tap onClick={() => move(id, 1)} aria="Move down" style={{ color: C.ink28, padding: "6px 8px", fontSize: 14 }}>↓</Tap>
                  <Tap disabled={s.fixed} onClick={() => setC("hidden", hidden ? core.hidden.filter((x) => x !== id) : [...core.hidden, id])}
                    style={{ fontFamily: SANS, fontSize: 12.5, color: s.fixed ? C.ink16 : hidden ? C.accent : C.ink28, padding: "6px 0 6px 10px", minWidth: 44, textAlign: "right" }}>
                    {s.fixed ? "always" : hidden ? "show" : "hide"}
                  </Tap>
                </div>
              );
            })}
          </div>
        )}

        {tab === "prompts" && (
          <div style={{ paddingTop: 14 }}>
            <Eyebrow style={{ marginBottom: 12 }}>Reflection</Eyebrow>
            <div style={{ display: "flex", gap: 18, paddingBottom: 6 }}>
              {[["often", "Offer often"], ["never", "Never offer"]].map(([v, l]) => (
                <Tap key={v} onClick={() => setC("adaptive", v)} style={{ fontFamily: SANS, fontSize: 13, color: core.adaptive === v ? C.accent : C.ink28, padding: "8px 0" }}>{l}</Tap>
              ))}
            </div>
            <Note>Questions written from your entries require a model. Turning this off leaves every counted and hand-written part of the app working.</Note>
            <Rule />
            <div style={{ display: "flex", gap: 18, padding: "16px 0 4px" }}>
              {[["morning", "Morning"], ["evening", "Evening"]].map(([v, l]) => (
                <Tap key={v} onClick={() => setWhich(v)} style={{ fontFamily: SANS, fontSize: 13, color: which === v ? C.ink : C.ink28, padding: "6px 0" }}>{l}</Tap>
              ))}
            </div>
            {[...pool, ...custom].map((p) => {
              const off = core.retired.includes(p);
              return (
                <div key={p} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
                  <span style={{ flex: 1, fontFamily: SERIF, fontSize: 16.5, fontWeight: 300, color: off ? C.ink16 : C.ink70, lineHeight: 1.45 }}>{p}</span>
                  <Tap onClick={() => setC("retired", off ? core.retired.filter((x) => x !== p) : [...core.retired, p])}
                    style={{ fontFamily: SANS, fontSize: 12, color: off ? C.accent : C.ink28, padding: "4px 0", whiteSpace: "nowrap" }}>{off ? "use" : "retire"}</Tap>
                </div>
              );
            })}
            <div style={{ paddingTop: 16 }}>
              <Grow value={newPrompt} onChange={setNewPrompt} placeholder="Write your own question" ariaLabel="New question" size={16.5} />
              {newPrompt.trim() && (
                <Tap onClick={() => { setC("customPrompts", { ...core.customPrompts, [which]: [...custom, newPrompt.trim()] }); setNewPrompt(""); }}
                  style={{ fontFamily: SANS, fontSize: 13, color: C.accent, padding: "12px 0" }}>Add to {which}</Tap>
              )}
            </div>
          </div>
        )}

        {tab === "data" && (
          <div style={{ paddingTop: 8 }}>
            <div style={{ padding: "18px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
              <Eyebrow style={{ marginBottom: 12 }}>Anthropic API key</Eyebrow>
              <ApiKeyField apiKey={apiKey} onChange={onApiKeyChange} />
              <Note>Stored on this device only, sent to no one but api.anthropic.com. Without it, every counted and hand-written part of the app still works — the AI features just say so.</Note>
            </div>
            <Tap onClick={onExport} style={{ display: "block", width: "100%", textAlign: "left", padding: "20px 0", fontFamily: SANS, fontSize: 16, color: C.ink, borderBottom: `1px solid ${C.lineSoft}` }}>
              Export everything as JSON
            </Tap>
            <label className="tj-import">
              Import from a backup
              <input type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => e.target.files && e.target.files[0] && onImport(e.target.files[0])} />
            </label>
            <Note>
              Everything stays on this device. The export is a plain JSON file holding every entry, insight, decision, and book, keyed by date — readable by anything, including a future version of this app.
            </Note>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════ SHELL ═════════════════════════════════════════ */
export default function App() {
  const todayKey = keyOf(new Date());
  const [date, setDate] = useState(todayKey);
  const [view, setView] = useState("today");
  const [mode, setMode] = useState(new Date().getHours() >= 17 ? "evening" : "morning");
  const [core, setCore] = useState(null);
  const [lib, setLibState] = useState(null);
  const [day, setDay] = useState(null);
  const [journal, setJournal] = useState(null);
  const [week, setWeek] = useState(null);
  const [month, setMonth] = useState(null);
  const [talk, setTalk] = useState(null);
  const [index, setIndex] = useState([]);
  const [ink, setInkState] = useState({});
  const [inkDates, setInkDates] = useState([]);
  const [apiKey, setApiKey] = useState("");
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [settings, setSettings] = useState(false);
  const [focus, setFocus] = useState(false);
  const [toast, setToast] = useState("");
  const [journalDates, setJournalDates] = useState([]);

  const wkKey = weekKeyOf(date);
  const moKey = monthKey(date);
  const dusk = (view === "today" && mode === "evening") || view === "talk";
  const dawn = view === "today" && mode === "morning";

  const flash = useCallback((m) => { setToast(m); setTimeout(() => setToast(""), 2400); }, []);

  useEffect(() => {
    (async () => {
      try {
        setCore(mergeCore(await S.get("tj:core")));
        const l = await S.get("tj:lib");
        setLibState(l ? { ...emptyLib(), ...l } : emptyLib());
        const t = await S.get("tj:talk");
        setTalk(t || { messages: [] });
        setApiKey((await S.get("tj:apikey")) || "");
        setIndex(await readIndex(4));
        setReady(true);
      } catch (e) {
        setStorageError(true);
      }
    })();
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await S.get("tj:day:" + date);
        if (!alive) return;
        setDay(mergeDay(date, d));
        const j = await S.get("tj:journal:" + date);
        if (!alive) return;
        setJournal(j && j.date === date ? j : { date, entries: (j && j.entries) || [] });
        const k = await S.get("tj:ink:" + date);
        if (!alive) return;
        setInkState(k && k.date === date ? k : { date });
      } catch (e) {
        /* A day that could not be read must never be saved over. Halt instead
           of rendering an empty one the autosave would then commit. */
        if (alive) setStorageError(true);
      }
    })();
    return () => { alive = false; };
  }, [date]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const w = await S.get("tj:week:" + wkKey);
        if (alive) setWeek(w && w.id === wkKey ? w : { id: wkKey });
        const m = await S.get("tj:month:" + moKey);
        if (alive) setMonth(m && m.id === moKey ? m : { id: moKey });
      } catch (e) {
        if (alive) setStorageError(true);
      }
    })();
    return () => { alive = false; };
  }, [wkKey, moKey]);

  /* Debounce while one record is being edited, but flush — never drop — when
     the record changes identity or the component goes away. The old cleanup
     cancelled the pending write, so typing and then tapping to another date
     inside 700ms lost the text outright. */
  const useSave = (key, val, ok) => {
    const first = useRef(true);
    const pending = useRef(null);

    const flush = useCallback(() => {
      const p = pending.current;
      if (!p) return;
      pending.current = null;
      S.set(p.key, p.val).then((wrote) => { if (!wrote) flash("Couldn't save to this device"); });
    }, [flash]);

    useEffect(() => {
      if (!val || ok === false) return;
      if (first.current) { first.current = false; return; }
      pending.current = { key, val };
      const t = setTimeout(flush, 700);
      return () => clearTimeout(t);
    }, [key, val, ok, flush]);

    // key change or unmount: flush what is still pending for the old key
    useEffect(() => () => flush(), [key, flush]);

    // and let a backgrounding app flush every writer at once
    useEffect(() => { flushers.add(flush); return () => { flushers.delete(flush); }; }, [flush]);
  };
  const canSave = !storageError;
  useSave("tj:core", core, canSave);
  useSave("tj:lib", lib, canSave);
  useSave("tj:talk", talk, canSave);
  useSave("tj:day:" + date, day, canSave && !!day && day.date === date);
  useSave("tj:journal:" + date, journal, canSave && !!journal && journal.date === date);
  useSave("tj:week:" + wkKey, week, canSave && !!week && week.id === wkKey);
  useSave("tj:month:" + moKey, month, canSave && !!month && month.id === moKey);
  useSave("tj:ink:" + date, ink, canSave && !!ink && ink.date === date);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") flushAllWrites(); };
    window.addEventListener("pagehide", flushAllWrites);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flushAllWrites);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  /* keep the index in step — this is what everything else reads */
  const idxFirst = useRef(true);
  const idxPending = useRef(null);
  const flushIndex = useCallback(() => {
    const p = idxPending.current;
    if (!p) return;
    idxPending.current = null;
    writeIndex(p.date, p.day, p.journal).then(() => {
      const rows = dayToIndexRows(p.date, p.day, p.journal);
      setIndex((cur) => [...cur.filter((r) => r.d !== p.date), ...rows].sort((a, b) => (a.d < b.d ? -1 : 1)));
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!canSave || !day || !journal || day.date !== date || journal.date !== date) return;
    if (idxFirst.current) { idxFirst.current = false; return; }
    idxPending.current = { date, day, journal };
    const t = setTimeout(flushIndex, 1400);
    return () => clearTimeout(t);
  }, [day, journal, date, canSave, flushIndex]);
  useEffect(() => () => flushIndex(), [date, flushIndex]);
  useEffect(() => { flushers.add(flushIndex); return () => { flushers.delete(flushIndex); }; }, [flushIndex]);

  /* `journal` is a new object on every keystroke, so this used to rescan the
     whole store per character typed. Entry count only moves when one is saved. */
  const journalCount = journal ? (journal.entries || []).length : 0;
  useEffect(() => {
    if (view !== "journal") return;
    (async () => {
      const keys = await S.list("tj:journal:");
      setJournalDates(keys.map((k) => k.replace("tj:journal:", "")).sort().reverse());
      const ik = await S.list("tj:ink:");
      setInkDates(ik.map((k) => k.replace("tj:ink:", "")));
    })();
  }, [view, date, journalCount]);

  useEffect(() => { setFocus(false); window.scrollTo({ top: 0 }); }, [view]);

  const setD = (path, value) => setDay((d) => {
    if (!d) return d;
    if (path.length === 1) return { ...d, [path[0]]: value };
    return { ...d, [path[0]]: { ...d[path[0]], [path[1]]: value } };
  });
  const setC = (k, v) => setCore((c) => ({ ...c, [k]: v }));
  const setLib = (k, v) => setLibState((l) => ({ ...l, [k]: v }));
  const setInk = (slot, v) => setInkState((i) => ({ ...i, date, [slot]: v }));
  const themes = useMemo(() => countThemes(index), [index]);

  const changeApiKey = (v) => { setApiKey(v); S.set("tj:apikey", v); };

  const exportAll = async () => {
    const keys = await S.list("tj:");
    const bundle = { app: "TJ 3.0", version: 2, exported: new Date().toISOString(), data: {} };
    for (const k of keys) {
      if (k === "tj:apikey") continue;
      bundle.data[k] = await S.get(k);
    }
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tj3-${todayKey}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSettings(false);
    flash("Exported");
  };

  const importAll = (file) => {
    const r = new FileReader();
    r.onload = async () => {
      try {
        const parsed = JSON.parse(String(r.result));
        const data = parsed.data || parsed;
        /* A write that silently failed used to still report "Imported", so the
           owner believed a backup had restored when it had not. Count them. */
        let wrote = 0;
        let failed = 0;
        for (const [k, v] of Object.entries(data)) {
          if (!k.startsWith("tj:") || k === "tj:apikey" || v == null) continue;
          if (await S.set(k, v)) wrote += 1; else failed += 1;
        }
        setCore(mergeCore(await S.get("tj:core")));
        const l = await S.get("tj:lib");
        setLibState(l ? { ...emptyLib(), ...l } : emptyLib());
        const t = await S.get("tj:talk");
        setTalk(t || { messages: [] });
        setDay(mergeDay(date, await S.get("tj:day:" + date)));
        const j = await S.get("tj:journal:" + date);
        setJournal(j && j.date === date ? j : { date, entries: [] });
        const w = await S.get("tj:week:" + wkKey);
        setWeek(w && w.id === wkKey ? w : { id: wkKey });
        const m = await S.get("tj:month:" + moKey);
        setMonth(m && m.id === moKey ? m : { id: moKey });
        setIndex(await readIndex(4));
        const k = await S.get("tj:ink:" + date);
        setInkState(k && k.date === date ? k : { date });
        const jk = await S.list("tj:journal:");
        setJournalDates(jk.map((x) => x.replace("tj:journal:", "")).sort().reverse());
        const ik = await S.list("tj:ink:");
        setInkDates(ik.map((x) => x.replace("tj:ink:", "")));
        setSettings(false);
        flash(failed ? `Imported ${wrote}, ${failed} couldn't be written` : "Imported");
      } catch (e) {
        setSettings(false);
        flash("That file couldn't be read");
      }
    };
    r.readAsText(file);
  };

  const navRef = useRef(null);
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const a = el.querySelector('[data-active="1"]');
    if (a && typeof a.scrollIntoView === "function") a.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [view]);

  /* A storage failure stops here rather than rendering an empty day the
     autosave would then write over a real one. Say so plainly — silence would
     look like a slow load, and the owner might start typing into nothing. */
  if (storageError) {
    return (
      <div className="tj-root">
        <style>{CSS}</style>
        <main className="tj-main" style={{ paddingTop: 90 }}>
          <Eyebrow>Storage</Eyebrow>
          <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 300, color: C.ink, lineHeight: 1.6, marginTop: 14 }}>
            This device's storage couldn't be read, so nothing has been loaded — and nothing will be written over.
          </div>
          <Note>Close the app and open it again. Your writing is still on the device. Do not clear website data.</Note>
        </main>
      </div>
    );
  }

  if (!ready || !core || !day || !lib) {
    return <div style={{ background: "#F5F2EA", minHeight: "100dvh" }}><style>{CSS}</style></div>;
  }

  const nav = core.order.filter((id) => !core.hidden.includes(id) && SECTIONS.some((s) => s.id === id));
  const aiOn = core.ai !== false && core.adaptive !== "never" && !!apiKey;

  const screens = {
    today: <Today day={day} core={core} lib={lib} setD={setD} setC={setC} setLib={setLib} date={date} todayKey={todayKey} mode={mode} setMode={setMode} index={index} ai={aiOn} ink={ink} setInk={setInk} themes={themes} />,
    people: <People day={day} setD={setD} core={core} setC={setC} index={index} lib={lib} setLib={setLib} ai={aiOn} />,
    faith: <Faith day={day} setD={setD} index={index} ai={aiOn} lib={lib} setLib={setLib} />,
    journal: <Journal journal={journal} setJournal={setJournal} date={date} setDate={setDate} dates={journalDates} focus={focus} setFocus={setFocus} ink={ink} setInk={setInk} index={index} inkDates={inkDates} core={core} />,
    patterns: <Patterns lib={lib} setLib={setLib} index={index} core={core} date={date} ai={aiOn} week={week} setWeek={setWeek} month={month} setMonth={setMonth} />,
    judgment: <Judgment lib={lib} setLib={setLib} index={index} ai={aiOn} date={date} />,
    library: <Library lib={lib} setLib={setLib} index={index} ai={aiOn} date={date} />,
    becoming: <Becoming core={core} setC={setC} index={index} ai={aiOn} date={date} />,
    talk: <Talk talk={talk} setTalk={setTalk} index={index} ai={aiOn} />,
  };

  return (
    <div className={"tj-root" + (dusk ? " tj-dusk" : "") + (dawn ? " tj-dawn" : "")}>
      <style>{CSS}</style>
      <div className="tj-wash" />

      <header className={"tj-head" + (focus ? " tj-gone" : "")}>
        <div className="tj-head-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Tap onClick={() => setDate(addDays(date, -1))} aria="Previous day" style={{ padding: "10px 8px 10px 0", color: C.ink28, fontSize: 15 }}>‹</Tap>
            <span style={{ fontFamily: SANS, fontSize: 12.5, letterSpacing: "0.015em", color: C.ink70 }}>{longDate(date)}</span>
            <Tap onClick={() => setDate(addDays(date, 1))} aria="Next day" style={{ padding: "10px 8px", color: C.ink28, fontSize: 15 }}>›</Tap>
            {date !== todayKey && (
              <Tap onClick={() => setDate(todayKey)} style={{ fontFamily: SANS, fontSize: 12, color: C.accent, padding: "10px 4px" }}>Today</Tap>
            )}
          </div>
          <Tap onClick={() => setSettings(true)} aria="Settings" style={{ color: C.ink28, padding: "10px 0 10px 12px", fontSize: 16, letterSpacing: "0.1em" }}>···</Tap>
        </div>
      </header>

      <main className="tj-main" style={{ paddingTop: focus ? 26 : 72 }}>
        <div key={view + (dusk ? "d" : dawn ? "m" : "l")} className="tj-view">{screens[view]}</div>
        <div style={{ height: 150 }} />
      </main>

      <nav className={"tj-nav" + (focus ? " tj-gone" : "")} ref={navRef}>
        <div className="tj-nav-scroll">
          {nav.map((id) => {
            const s = SECTIONS.find((x) => x.id === id);
            return (
              <button key={id} data-active={view === id ? "1" : "0"} onClick={() => setView(id)} className="tj-navitem" style={{ color: view === id ? C.ink : C.ink28 }}>
                {s.label}
                <span className="tj-navdot" style={{ background: view === id ? C.accent : "transparent" }} />
              </button>
            );
          })}
        </div>
      </nav>

      {settings && (
        <div className="tj-sheet-wrap" onClick={() => setSettings(false)}>
          <Settings core={core} setC={setC} apiKey={apiKey} onApiKeyChange={changeApiKey} onExport={exportAll} onImport={importAll} close={() => setSettings(false)} />
        </div>
      )}
      {toast && <div className="tj-toast">{toast}</div>}
    </div>
  );
}

/* ══════════ CSS ═══════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,200;0,6..72,300;0,6..72,400;1,6..72,300&display=swap');

*, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body, #root { margin: 0; padding: 0; background: #F5F2EA; }
body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; overscroll-behavior-y: none; }

.tj-root {
  --paper:#F5F2EA; --raise:#FBFAF5; --ink:#1D1C19;
  --ink70:rgba(29,28,25,0.66); --ink45:rgba(29,28,25,0.45);
  --ink28:rgba(29,28,25,0.30); --ink16:rgba(29,28,25,0.17);
  --line:rgba(29,28,25,0.11); --lineSoft:rgba(29,28,25,0.065);
  --accent:#4F6353; --accentSoft:rgba(79,99,83,0.16);
  --head:rgba(245,242,234,0.92); --headFade:rgba(245,242,234,0);
  --nav:rgba(245,242,234,0.78);
  background: var(--paper); min-height: 100vh; position: relative;
  transition: background-color .85s cubic-bezier(.4,0,.2,1);
}
.tj-root.tj-dusk {
  --paper:#191714; --raise:#221F1A; --ink:#EFE9DD;
  --ink70:rgba(239,233,221,0.64); --ink45:rgba(239,233,221,0.44);
  --ink28:rgba(239,233,221,0.28); --ink16:rgba(239,233,221,0.16);
  --line:rgba(239,233,221,0.11); --lineSoft:rgba(239,233,221,0.065);
  --accent:#9BAE90; --accentSoft:rgba(155,174,144,0.18);
  --head:rgba(25,23,20,0.92); --headFade:rgba(25,23,20,0);
  --nav:rgba(25,23,20,0.78);
}

.tj-wash {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background: radial-gradient(115% 60% at 50% -8%, var(--accentSoft), transparent 62%);
  opacity: .5; transition: opacity .8s ease;
}

.tj-head {
  position: fixed; top: 0; left: 0; right: 0; z-index: 40;
  padding-top: env(safe-area-inset-top);
  background: linear-gradient(to bottom, var(--head) 58%, var(--headFade));
  backdrop-filter: blur(18px) saturate(115%); -webkit-backdrop-filter: blur(18px) saturate(115%);
  transition: opacity .4s ease, background .85s cubic-bezier(.4,0,.2,1);
}
.tj-head-inner { max-width: 640px; margin: 0 auto; padding: 6px 22px 14px; display: flex; align-items: center; justify-content: space-between; }
.tj-main { position: relative; z-index: 1; max-width: 640px; margin: 0 auto; padding: 0 22px; }

.tj-nav {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--nav);
  backdrop-filter: blur(24px) saturate(140%); -webkit-backdrop-filter: blur(24px) saturate(140%);
  border-top: 1px solid var(--lineSoft);
  transition: opacity .4s ease, background .85s cubic-bezier(.4,0,.2,1);
}
.tj-nav-scroll {
  display: flex; gap: 24px; overflow-x: auto; scroll-behavior: smooth;
  padding: 13px 22px 11px; max-width: 640px; margin: 0 auto;
  scrollbar-width: none; -ms-overflow-style: none;
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%);
  mask-image: linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%);
}
.tj-nav-scroll::-webkit-scrollbar { display: none; }
.tj-navitem {
  position: relative; flex: 0 0 auto; background: none; border: none; cursor: pointer;
  font-family: ${SANS}; font-size: 13.5px; letter-spacing: 0.015em; padding: 6px 0 10px; transition: color .35s ease;
}
.tj-navdot { position: absolute; left: 50%; bottom: 2px; width: 3px; height: 3px; margin-left: -1.5px; border-radius: 50%; transition: background .35s ease; }
.tj-gone { opacity: 0; pointer-events: none; }

.tj-seg { display: flex; gap: 22px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
.tj-seg::-webkit-scrollbar { display: none; }

.tj-field {
  width: 100%; background: transparent; border: none; outline: none; resize: none;
  padding: 0; margin: 0; overflow: hidden; display: block; caret-color: var(--accent);
  transition: color .85s cubic-bezier(.4,0,.2,1);
}
.tj-field::placeholder { color: var(--ink16); }

.tj-date {
  font-family: ${SANS}; font-size: 16px; color: var(--ink); background: transparent;
  border: none; border-bottom: 1px solid var(--line); padding: 4px 0; outline: none;
}
.tj-date:focus { border-bottom-color: var(--accent); }

.tj-tap { background: none; border: none; padding: 0; margin: 0; cursor: pointer; font: inherit; color: inherit; transition: opacity .2s ease, transform .2s ease; }
.tj-tap:active { opacity: .55; transform: scale(.985); }
.tj-tap:disabled { cursor: default; }
.tj-tap:focus-visible, .tj-field:focus-visible, .tj-navitem:focus-visible, .tj-date:focus-visible {
  outline: 1px solid var(--accent); outline-offset: 4px; border-radius: 2px;
}

.tj-anchor { transition: padding-left .45s cubic-bezier(.2,.8,.2,1), border-color .45s ease; }
.tj-bar { display: block; width: 54px; height: 1px; background: var(--lineSoft); overflow: hidden; }

.tj-view { animation: tjIn .55s cubic-bezier(.2,.8,.2,1); }
.tj-reveal { animation: tjIn .45s cubic-bezier(.2,.8,.2,1); }
@keyframes tjIn { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }

.tj-pulse { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: tjPulse 1.5s ease-in-out infinite; }
@keyframes tjPulse { 0%,100% { opacity: .25; transform: scale(.8); } 50% { opacity: 1; transform: scale(1); } }

.tj-bubble {
  max-width: 84%; background: var(--accentSoft); color: var(--ink);
  font-family: ${SANS}; font-size: 16.5px; line-height: 1.5;
  padding: 13px 17px; border-radius: 18px 18px 4px 18px; white-space: pre-wrap;
}
.tj-composer {
  position: sticky; bottom: calc(64px + env(safe-area-inset-bottom)); z-index: 20;
  background: var(--paper); border-top: 1px solid var(--line);
  padding: 16px 0 14px; margin-top: 24px;
  transition: background-color .85s cubic-bezier(.4,0,.2,1);
}

.tj-sheet-wrap {
  position: fixed; inset: 0; z-index: 60; background: rgba(20,18,15,0.42);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  display: flex; align-items: flex-end; animation: tjFade .3s ease;
}
@keyframes tjFade { from { opacity: 0 } to { opacity: 1 } }
.tj-sheet {
  width: 100%; max-width: 640px; margin: 0 auto; background: var(--raise);
  border-top: 1px solid var(--line); border-radius: 20px 20px 0 0;
  padding: 24px 22px calc(20px + env(safe-area-inset-bottom));
  max-height: 84vh; display: flex; flex-direction: column;
  animation: tjUp .42s cubic-bezier(.2,.8,.2,1);
}
@keyframes tjUp { from { transform: translateY(100%) } to { transform: none } }
.tj-sheet-body { overflow-y: auto; -webkit-overflow-scrolling: touch; }
.tj-import { display: block; width: 100%; padding: 20px 0; font-family: ${SANS}; font-size: 16px; color: var(--ink); border-bottom: 1px solid var(--lineSoft); cursor: pointer; }

.tj-toast {
  position: fixed; left: 50%; transform: translateX(-50%);
  bottom: calc(84px + env(safe-area-inset-bottom)); z-index: 70;
  background: var(--raise); color: var(--ink); font-family: ${SANS}; font-size: 13px;
  padding: 11px 20px; border-radius: 40px; border: 1px solid var(--line);
  box-shadow: 0 8px 30px rgba(20,18,15,0.10); animation: tjIn .35s cubic-bezier(.2,.8,.2,1);
}

.tj-root.tj-dawn {
  --paper:#FBF9F4; --raise:#FFFEFA; --ink:#1A1917;
  --ink70:rgba(26,25,23,0.68); --ink45:rgba(26,25,23,0.46);
  --ink28:rgba(26,25,23,0.30); --ink16:rgba(26,25,23,0.16);
  --line:rgba(26,25,23,0.09); --lineSoft:rgba(26,25,23,0.055);
  --accent:#4C6B55; --accentSoft:rgba(76,107,85,0.13);
  --head:rgba(251,249,244,0.93); --headFade:rgba(251,249,244,0);
  --nav:rgba(251,249,244,0.80);
}
.tj-root.tj-dawn .tj-wash { opacity: .75; }

.tj-quote {
  margin-top: 26px; padding: 22px 22px 20px; border-radius: 3px;
  background: var(--accentSoft); border-left: 2px solid var(--accent);
  animation: tjIn .5s cubic-bezier(.2,.8,.2,1);
  transition: background .6s ease;
}

.tj-inkbar {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding-bottom: 10px; border-bottom: 1px solid var(--lineSoft);
}
.tj-inkwrap {
  margin-top: 10px; border: 1px solid var(--line); border-radius: 4px;
  background: var(--raise); overflow: hidden; position: relative;
  transition: background .6s ease;
}
.tj-canvas {
  color: var(--ink); border-color: var(--line);
  display: block; touch-action: none; cursor: crosshair;
}
.tj-inkfull {
  position: fixed; inset: 0; z-index: 70; background: var(--paper);
  height: 100vh; height: 100dvh;
  padding: calc(env(safe-area-inset-top) + 14px) 18px calc(env(safe-area-inset-bottom) + 14px);
  display: flex; flex-direction: column; animation: tjIn .3s ease;
}
.tj-inkfull .tj-inkwrap { flex: 1; min-height: 0; margin-top: 10px; }

.tj-finish {
  margin-top: 46px; padding: 40px 0 10px; border-top: 1px solid var(--line);
  text-align: center; animation: tjRise .7s cubic-bezier(.2,.8,.2,1);
}
@keyframes tjRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

@media (min-width: 820px) {
  .tj-inkwrap { min-height: 420px; }
}

@media (hover: hover) {
  .tj-tap:hover:not(:disabled) { opacity: .72; }
  .tj-navitem:hover { color: var(--ink70) !important; }
}
@media (prefers-reduced-motion: reduce) {
  *, .tj-view, .tj-reveal, .tj-sheet { animation: none !important; transition-duration: .01ms !important; }
}
`;

/* ══════════════════════════════════════════════════════════
   MORNING — orientation, not documentation
   ══════════════════════════════════════════════════════════ */

/* one quote a day, chosen against the tone you arrive with */
const QUOTES = [
  { w: "The way to get started is to quit talking and begin doing.", a: "Walt Disney", t: ["action", "heavy"], n: "Move before you overthink." },
  { w: "All our dreams can come true, if we have the courage to pursue them.", a: "Walt Disney", t: ["possibility"], n: "" },
  { w: "You have power over your mind, not outside events.", a: "Marcus Aurelius", t: ["steady", "heavy"], n: "The day gets a vote. It doesn't get the last word." },
  { w: "Waste no more time arguing what a good man should be. Be one.", a: "Marcus Aurelius", t: ["identity"], n: "" },
  { w: "What stands in the way becomes the way.", a: "Marcus Aurelius", t: ["adversity", "heavy"], n: "" },
  { w: "Very little is needed to make a happy life.", a: "Marcus Aurelius", t: ["gratitude"], n: "" },
  { w: "Live as if you were to die tomorrow.", a: "Mahatma Gandhi", t: ["presence"], n: "" },
  { w: "Strength does not come from physical capacity. It comes from an indomitable will.", a: "Mahatma Gandhi", t: ["adversity", "low"], n: "" },
  { w: "Nothing great was ever achieved without enthusiasm.", a: "Ralph Waldo Emerson", t: ["energy", "fired"], n: "" },
  { w: "The only person you are destined to become is the person you decide to be.", a: "Ralph Waldo Emerson", t: ["identity"], n: "" },
  { w: "Nothing will work unless you do.", a: "Maya Angelou", t: ["action"], n: "" },
  { w: "We may encounter many defeats but we must not be defeated.", a: "Maya Angelou", t: ["adversity", "heavy"], n: "" },
  { w: "Do what you can, with what you have, where you are.", a: "Theodore Roosevelt", t: ["action", "low"], n: "Today's version counts. Not the ideal one." },
  { w: "Comparison is the thief of joy.", a: "Theodore Roosevelt", t: ["gratitude"], n: "" },
  { w: "Believe you can and you're halfway there.", a: "Theodore Roosevelt", t: ["confidence", "low"], n: "" },
  { w: "Success is not final, failure is not fatal.", a: "Winston Churchill", t: ["steady", "adversity"], n: "" },
  { w: "Attitude is a little thing that makes a big difference.", a: "Winston Churchill", t: ["energy"], n: "" },
  { w: "Hardships often prepare ordinary people for an extraordinary destiny.", a: "C.S. Lewis", t: ["adversity", "heavy"], n: "" },
  { w: "We are what we believe we are.", a: "C.S. Lewis", t: ["identity"], n: "" },
  { w: "Go confidently in the direction of your dreams.", a: "Henry David Thoreau", t: ["possibility", "confidence"], n: "" },
  { w: "It's not what you look at that matters, it's what you see.", a: "Henry David Thoreau", t: ["presence", "gratitude"], n: "" },
  { w: "Simplify, simplify.", a: "Henry David Thoreau", t: ["simplicity", "heavy"], n: "Cut the day down to what actually matters." },
  { w: "It always seems impossible until it's done.", a: "Nelson Mandela", t: ["adversity", "possibility"], n: "" },
  { w: "Courage is not the absence of fear, but the triumph over it.", a: "Nelson Mandela", t: ["courage"], n: "" },
  { w: "The only way to do great work is to love what you do.", a: "Steve Jobs", t: ["energy", "fired"], n: "" },
  { w: "Your time is limited. Don't waste it living someone else's life.", a: "Steve Jobs", t: ["identity", "presence"], n: "" },
  { w: "A busy calendar and a busy mind will destroy your ability to create.", a: "Naval Ravikant", t: ["simplicity", "heavy"], n: "" },
  { w: "Play long-term games with long-term people.", a: "Naval Ravikant", t: ["steady", "possibility"], n: "" },
];

const OPENERS = [
  "You get another shot at today.",
  "Start with what's good.",
  "Be where your feet are today.",
  "Today doesn't need to be perfect. It needs to be intentional.",
  "You already have a lot worth protecting.",
  "Slow is fine. Absent isn't.",
  "The people at home get the first version of you, not the leftover one.",
  "Nothing here is urgent. Some of it is important.",
  "You've done harder days than this one.",
  "Do the boring things well and the day mostly takes care of itself.",
];

const SIGNOFFS = [
  "Go have a good day.",
  "That's enough thinking. Go live it.",
  "You know what matters. Get after it.",
  "Be good to your people today.",
  "Close it and go.",
  "That'll do. Move.",
];

const GRATITUDE_FRAMES = [
  "What are three things that are already good?",
  "What do you have today that a past version of you would have wanted?",
  "Who are you grateful is in your life right now?",
  "What ordinary thing would you badly miss if it disappeared?",
  "What happened recently that deserves more appreciation than you gave it?",
  "What part of your life are you lucky to call normal?",
  "What went right yesterday that you barely noticed?",
];
const CONFIDENCE_FRAMES = [
  "What have you handled before that reminds you you're capable today?",
  "What are you better at now than you were a year ago?",
  "What's something difficult you've already proven you can do?",
  "Where have you earned the right to trust yourself?",
  "What strength do you want to bring into today?",
];
const EXCITEMENT_FRAMES = [
  "What are you genuinely looking forward to today?",
  "What could be fun today?",
  "What moment do you want to be fully present for?",
  "What's one small thing you're looking forward to?",
  "What would make you want to get moving?",
];
const IDENTITY_FRAMES = [
  "Who do you want to be today?",
  "What version of you needs to show up today?",
  "How do you want people to feel after talking to you today?",
  "What quality do you want to practice today?",
  "What would the man you're becoming do differently today?",
];
const RELATIONSHIP_FRAMES = [
  "What would being a good husband look like today?",
  "How can you be fully present with your daughter today?",
  "Who could use encouragement from you today?",
  "Is there someone you want to appreciate out loud today?",
  "How can you make someone's day slightly better?",
  "Who have you been short with lately that deserves better today?",
];

const AFFIRMATION_CATS = ["Confidence","Marriage","Fatherhood","Discipline","Sales","Faith","Health","Patience","Decisions","Identity"];
const SEED_AFFIRMATIONS = [
  ["I can handle difficult conversations without becoming reactive.", "Patience"],
  ["I make good decisions without needing perfect certainty.", "Decisions"],
  ["I am capable of doing hard things without making them dramatic.", "Discipline"],
  ["I am becoming more patient with the people I love.", "Marriage"],
  ["I keep promises to myself.", "Discipline"],
  ["I can be ambitious without rushing through my life.", "Identity"],
  ["I bring energy into rooms instead of taking it from them.", "Confidence"],
  ["I can be wrong without becoming defensive.", "Identity"],
  ["My daughter gets my attention, not my distraction.", "Fatherhood"],
  ["I ask before I explain.", "Sales"],
];

const ENERGY = ["Low", "Steady", "High"];
const HEADSPACE = ["Heavy", "Neutral", "Good", "Fired up"];

function pickQuote(dateKey, energy, headspace, themes) {
  const want = [];
  if (energy === "Low") want.push("low", "action", "steady");
  if (energy === "High") want.push("energy", "fired", "possibility");
  if (headspace === "Heavy") want.push("heavy", "adversity", "steady", "simplicity");
  if (headspace === "Fired up") want.push("fired", "possibility", "energy");
  if (headspace === "Good") want.push("gratitude", "presence");
  const top = (themes[0] || {}).id;
  if (top === "patience") want.push("steady", "identity");
  if (top === "avoidance") want.push("action", "courage");
  if (top === "comparison") want.push("gratitude");
  if (top === "confidence") want.push("confidence", "courage");
  if (top === "decisions") want.push("courage", "action");
  const pool = want.length ? QUOTES.filter((q) => q.t.some((t) => want.includes(t))) : QUOTES;
  const use = pool.length ? pool : QUOTES;
  return use[hashStr(dateKey + (energy || "") + (headspace || "")) % use.length];
}

/* ── ink: a real writing surface, pressure and all ────────── */
const INK_TOOLS = [
  { id: "pen", label: "Pen", w: 2.6, alpha: 1 },
  { id: "pencil", label: "Pencil", w: 2.0, alpha: 0.62 },
  { id: "marker", label: "Marker", w: 15, alpha: 0.24 },
  { id: "eraser", label: "Eraser", w: 14, alpha: 1 },
  { id: "lasso", label: "Lasso", w: 1, alpha: 1 },
];

function Ink({ value, onChange, height = 300, full, onToggleFull, label }) {
  const wrapRef = useRef(null);
  const cvsRef = useRef(null);
  const [tool, setTool] = useState("pen");
  const [redo, setRedo] = useState([]);
  const [sel, setSel] = useState(null);
  const draw = useRef(null);
  const sawPen = useRef(false);
  const strokes = (value && value.strokes) || [];
  const paper = (value && value.paper) || "ruled";
  const size = useRef({ w: 0, h: 0 });

  const commit = (next, clearRedo = true) => {
    onChange({ strokes: next, paper });
    if (clearRedo) setRedo([]);
  };

  const paint = useCallback(() => {
    const cvs = cvsRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const { w, h } = size.current;
    ctx.clearRect(0, 0, w, h);
    const ink = getComputedStyle(cvs).color || "#1D1C19";
    const guide = getComputedStyle(cvs).borderColor || "rgba(0,0,0,.1)";
    if (paper === "ruled") {
      ctx.strokeStyle = guide; ctx.lineWidth = 1;
      for (let y = 34; y < h; y += 34) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    } else if (paper === "dot") {
      ctx.fillStyle = guide;
      for (let y = 22; y < h; y += 22) for (let x = 22; x < w; x += 22) { ctx.beginPath(); ctx.arc(x, y, 1, 0, 7); ctx.fill(); }
    }
    const all = draw.current && draw.current.live ? [...strokes, draw.current.live] : strokes;
    for (const s of all) {
      if (!s || !s.pts || s.pts.length === 0) continue;
      const spec = INK_TOOLS.find((t) => t.id === s.tool) || INK_TOOLS[0];
      const selected = sel && sel.ids.includes(s.id);
      const dx = selected ? sel.dx : 0, dy = selected ? sel.dy : 0;
      ctx.globalAlpha = spec.alpha;
      ctx.strokeStyle = s.tool === "marker" ? "rgba(199,154,94,1)" : ink;
      ctx.lineCap = s.tool === "marker" ? "butt" : "round";
      ctx.lineJoin = "round";
      if (s.pts.length === 1) {
        ctx.beginPath(); ctx.arc(s.pts[0][0] + dx, s.pts[0][1] + dy, spec.w / 2, 0, 7);
        ctx.fillStyle = ctx.strokeStyle; ctx.fill();
      } else {
        for (let i = 1; i < s.pts.length; i++) {
          const p0 = s.pts[i - 1], p1 = s.pts[i];
          ctx.lineWidth = s.tool === "marker" ? spec.w : Math.max(0.7, spec.w * (0.45 + (p1[2] || 0.5) * 1.15));
          ctx.beginPath(); ctx.moveTo(p0[0] + dx, p0[1] + dy); ctx.lineTo(p1[0] + dx, p1[1] + dy); ctx.stroke();
        }
      }
      if (selected) {
        ctx.globalAlpha = 1; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(120,140,120,.8)"; ctx.setLineDash([]);
      }
    }
    if (draw.current && draw.current.lasso) {
      ctx.globalAlpha = 1; ctx.setLineDash([5, 5]); ctx.lineWidth = 1; ctx.strokeStyle = ink;
      const L = draw.current.lasso;
      ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
      for (const p of L) ctx.lineTo(p[0], p[1]);
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }, [strokes, paper, sel]);

  /* `paint` changes identity on every committed stroke, and this effect used to
     depend on it — so each stroke reassigned canvas.width/height, which wipes
     and reallocates the whole bitmap. Size on real geometry changes only, and
     reach the current paint through a ref. */
  const paintRef = useRef(paint);
  useEffect(() => { paintRef.current = paint; });

  useEffect(() => {
    const cvs = cvsRef.current, wrap = wrapRef.current;
    if (!cvs || !wrap) return;
    const fit = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      size.current = { w: r.width, h: r.height };
      cvs.width = Math.max(1, Math.round(r.width * dpr));
      cvs.height = Math.max(1, Math.round(r.height * dpr));
      cvs.style.width = r.width + "px";
      cvs.style.height = r.height + "px";
      const ctx = cvs.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintRef.current();
    };
    fit();
    window.addEventListener("resize", fit);
    /* orientation change and the standalone toolbar settling both resize the
       wrapper without a window resize event */
    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(fit);
      ro.observe(wrap);
    }
    return () => {
      window.removeEventListener("resize", fit);
      if (ro) ro.disconnect();
    };
  }, [full, height]);

  useEffect(() => { paint(); }, [paint]);

  const pos = (e) => {
    const r = cvsRef.current.getBoundingClientRect();
    return [Math.round((e.clientX - r.left) * 10) / 10, Math.round((e.clientY - r.top) * 10) / 10, e.pressure > 0 ? e.pressure : 0.5];
  };
  const inPoly = (pt, poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  const down = (e) => {
    if (e.pointerType === "pen") sawPen.current = true;
    if (e.pointerType === "touch" && sawPen.current) return; // palm rejection
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pos(e);
    if (tool === "lasso") {
      if (sel && inPoly(p, sel.poly)) { draw.current = { moving: true, from: p }; return; }
      setSel(null);
      draw.current = { lasso: [p] };
    } else if (tool === "eraser") {
      draw.current = { erasing: true, hit: new Set() };
      eraseAt(p);
    } else {
      draw.current = { live: { id: uid(), tool, pts: [p] } };
    }
    paint();
  };
  const eraseAt = (p) => {
    const near = strokes.filter((s) => s.pts.some((q) => Math.abs(q[0] - p[0]) < 12 && Math.abs(q[1] - p[1]) < 12));
    if (near.length) commit(strokes.filter((s) => !near.includes(s)));
  };
  const move = (e) => {
    const d = draw.current;
    if (!d) return;
    if (e.pointerType === "touch" && sawPen.current) return;
    const p = pos(e);
    if (d.lasso) { d.lasso.push(p); paint(); return; }
    if (d.moving) { setSel((s) => s && { ...s, dx: p[0] - d.from[0], dy: p[1] - d.from[1] }); return; }
    if (d.erasing) { eraseAt(p); return; }
    if (d.live) {
      const last = d.live.pts[d.live.pts.length - 1];
      if (Math.abs(last[0] - p[0]) + Math.abs(last[1] - p[1]) < 0.8) return;
      d.live.pts.push(p);
      paint();
    }
  };
  const up = () => {
    const d = draw.current;
    draw.current = null;
    if (!d) return;
    if (d.lasso && d.lasso.length > 4) {
      const ids = strokes.filter((s) => s.pts.some((q) => inPoly(q, d.lasso))).map((s) => s.id);
      setSel(ids.length ? { ids, poly: d.lasso, dx: 0, dy: 0 } : null);
      paint();
      return;
    }
    if (d.moving && sel) {
      commit(strokes.map((s) => (sel.ids.includes(s.id) ? { ...s, pts: s.pts.map((q) => [Math.round((q[0] + sel.dx) * 10) / 10, Math.round((q[1] + sel.dy) * 10) / 10, q[2]]) } : s)));
      setSel(null);
      return;
    }
    if (d.live && d.live.pts.length) commit([...strokes, d.live]);
    paint();
  };

  const undo = () => {
    if (!strokes.length) return;
    setRedo((r) => [strokes[strokes.length - 1], ...r].slice(0, 30));
    onChange({ strokes: strokes.slice(0, -1), paper });
  };
  const redoIt = () => {
    if (!redo.length) return;
    onChange({ strokes: [...strokes, redo[0]], paper });
    setRedo((r) => r.slice(1));
  };

  const body = (
    <>
      <div className="tj-inkbar">
        <div style={{ display: "flex", gap: 16, overflowX: "auto" }} className="tj-seg">
          {INK_TOOLS.map((t) => (
            <Tap key={t.id} onClick={() => { setTool(t.id); setSel(null); }}
              style={{ fontFamily: SANS, fontSize: 12, letterSpacing: "0.05em", padding: "8px 0", whiteSpace: "nowrap", color: tool === t.id ? C.accent : C.ink28, transition: "color .3s" }}>
              {t.label}
            </Tap>
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Tap onClick={undo} aria="Undo" style={{ padding: "8px 2px", color: strokes.length ? C.ink45 : C.ink16, fontSize: 15 }}>↺</Tap>
          <Tap onClick={redoIt} aria="Redo" style={{ padding: "8px 2px", color: redo.length ? C.ink45 : C.ink16, fontSize: 15 }}>↻</Tap>
          {onToggleFull && (
            <Tap onClick={onToggleFull} aria={full ? "Close notebook" : "Full page"} style={{ padding: "8px 0 8px 4px", color: C.ink45, fontFamily: SANS, fontSize: 12 }}>
              {full ? "Close" : "Full page"}
            </Tap>
          )}
        </div>
      </div>
      {/* full page lets the flex column own the height — calc(100vh - 210px)
          was wrong in standalone, where 100vh is not the usable viewport */}
      <div ref={wrapRef} className="tj-inkwrap" style={full ? undefined : { height }}>
        <canvas ref={cvsRef} className="tj-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} aria-label={label || "Handwriting canvas"} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10 }}>
        <div style={{ display: "flex", gap: 16 }}>
          {["blank", "ruled", "dot"].map((p) => (
            <Tap key={p} onClick={() => onChange({ strokes, paper: p })}
              style={{ fontFamily: SANS, fontSize: 11.5, letterSpacing: "0.06em", padding: "6px 0", color: paper === p ? C.accent : C.ink16, textTransform: "capitalize" }}>{p}</Tap>
          ))}
        </div>
        {strokes.length > 0 && (
          <Tap onClick={() => { if (sel) { commit(strokes.filter((s) => !sel.ids.includes(s.id))); setSel(null); } else commit([]); }}
            style={{ fontFamily: SANS, fontSize: 11.5, color: C.ink16, padding: "6px 0", letterSpacing: "0.05em" }}>
            {sel ? "Delete selection" : "Clear"}
          </Tap>
        )}
      </div>
    </>
  );

  if (full) return <div className="tj-inkfull">{body}</div>;
  return <div>{body}</div>;
}

/* read-only replay of handwriting, for the archive */
function InkThumb({ value, height = 76 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cvs = ref.current;
    if (!cvs || !value || !value.strokes || !value.strokes.length) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const r = cvs.getBoundingClientRect();
    cvs.width = Math.round(r.width * dpr); cvs.height = Math.round(height * dpr);
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const s of value.strokes) for (const p of s.pts) {
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    }
    const sc = Math.min(r.width / Math.max(1, maxX - minX + 20), height / Math.max(1, maxY - minY + 20), 1);
    ctx.translate(-minX * sc + 10, -minY * sc + 8);
    ctx.strokeStyle = getComputedStyle(cvs).color; ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const s of value.strokes) {
      const spec = INK_TOOLS.find((t) => t.id === s.tool) || INK_TOOLS[0];
      ctx.globalAlpha = spec.alpha;
      for (let i = 1; i < s.pts.length; i++) {
        ctx.lineWidth = Math.max(0.5, spec.w * sc * 0.9);
        ctx.beginPath();
        ctx.moveTo(s.pts[i - 1][0] * sc, s.pts[i - 1][1] * sc);
        ctx.lineTo(s.pts[i][0] * sc, s.pts[i][1] * sc);
        ctx.stroke();
      }
    }
  }, [value, height]);
  if (!value || !value.strokes || !value.strokes.length) return null;
  return <canvas ref={ref} className="tj-canvas" style={{ width: "100%", height, display: "block" }} />;
}

const FREQ_KEYS = [
  ["gratitude", "Gratitude"], ["affirmation", "Affirmation"], ["confidence", "Confidence"],
  ["excitement", "Anticipation"], ["identity", "Identity"], ["relationships", "Relationships"],
  ["hard", "One hard thing"], ["declaration", "Declaration"],
];
const shows = (freq, dateKey, key) => {
  const v = (freq || {})[key] || "often";
  if (v === "off") return false;
  if (v === "always") return true;
  const h = hashStr(dateKey + key);
  return v === "often" ? h % 4 !== 0 : h % 3 === 0;
};

function Morning({ day, core, lib, setD, setC, setLib, date, todayKey, index, ai, ink, setInk, themes }) {
  const am = day.am || {};
  /* Was `setD(["am"], { ...am, [k]: v })`, which spread a stale closure: two
     calls in one handler both built from the same `am`, so the second silently
     discarded the first. That killed "Write it in my voice" and "Another".
     The two-segment path merges against current state, so calls compose. */
  const setAm = (k, v) => setD(["am", k], v);
  const [openAll, setOpenAll] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [writeMode, setWriteMode] = useState(false);
  const [full, setFull] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const mode = core.morningMode || "standard";
  const freq = core.freq || {};

  const opener = useMemo(() => {
    const favs = (core.openingFavs || []).filter(Boolean);
    const pool = favs.length && hashStr(date + "op") % 2 === 0 ? favs : OPENERS;
    return pool[hashStr(date + "opener") % pool.length];
  }, [date, core.openingFavs]);

  const quote = useMemo(() => pickQuote(date, am.energy, am.headspace, themes), [date, am.energy, am.headspace, themes]);

  const affirmations = (core.affirmations || []).filter((a) => !a.archived);
  const todaysAff = useMemo(() => {
    if (!affirmations.length) return null;
    if (am.affId) { const found = affirmations.find((a) => a.id === am.affId); if (found) return found; }
    const favs = affirmations.filter((a) => a.fav);
    const pool = favs.length ? favs : affirmations;
    return pool[hashStr(date + "aff") % pool.length];
  }, [affirmations, am.affId, date]);

  /* counted: something you were grateful for a few weeks ago */
  const gratMemory = useMemo(() => {
    if (mode === "quick") return null;
    if (mode !== "deep" && hashStr(date + "gm") % 3 !== 0) return null;
    const rows = index.filter((r) => r.sec === "gratitude" && daysBetween(r.d, date) >= 12 && daysBetween(r.d, date) <= 60);
    if (!rows.length) return null;
    return rows[hashStr(date + "gmpick") % rows.length];
  }, [index, date, mode]);

  const pastWin = useMemo(() => {
    const wins = core.wins || [];
    if (!wins.length || hashStr(date + "win") % 2 === 0) return null;
    return wins[hashStr(date + "winpick") % wins.length];
  }, [core.wins, date]);

  const frames = {
    gratitude: GRATITUDE_FRAMES[hashStr(date + "g") % GRATITUDE_FRAMES.length],
    confidence: CONFIDENCE_FRAMES[hashStr(date + "c") % CONFIDENCE_FRAMES.length],
    excitement: EXCITEMENT_FRAMES[hashStr(date + "e") % EXCITEMENT_FRAMES.length],
    identity: IDENTITY_FRAMES[hashStr(date + "i") % IDENTITY_FRAMES.length],
    relationships: RELATIONSHIP_FRAMES[hashStr(date + "r") % RELATIONSHIP_FRAMES.length],
  };

  const grat = am.gratitude || ["", "", ""];
  const has = (v) => typeof v === "string" ? v.trim().length > 0 : !!v;

  const steps = [];
  if (shows(freq, date, "gratitude")) steps.push({ id: "gratitude", done: () => grat.some(has) });
  if (shows(freq, date, "affirmation") && todaysAff) steps.push({ id: "affirmation", done: () => am.affAccepted });
  if (mode !== "quick" && shows(freq, date, "confidence")) steps.push({ id: "confidence", done: () => has(am.confidence) });
  if (mode !== "quick" && shows(freq, date, "excitement")) steps.push({ id: "excitement", done: () => has(am.excitement) });
  if (shows(freq, date, "identity")) steps.push({ id: "identity", done: () => has(day.intention) });
  if (mode !== "quick" && shows(freq, date, "relationships")) steps.push({ id: "relationships", done: () => has(am.relationship) });
  steps.push({ id: "three", done: () => day.priorities.some((p) => has(p.t)) });
  if (mode !== "quick" && shows(freq, date, "hard")) steps.push({ id: "hard", done: () => has(am.hard) });
  if (mode === "deep") steps.push({ id: "deeper", done: () => (day.morning || []).some((q) => has(q.a)) });
  if (shows(freq, date, "declaration")) steps.push({ id: "declaration", done: () => has(am.declaration) });

  const firstOpen = steps.findIndex((s) => !s.done());
  const visible = openAll || firstOpen === -1 ? steps.length : firstOpen + 1;
  const on = (id) => { const i = steps.findIndex((s) => s.id === id); return i > -1 && i < visible; };
  const required = steps.filter((x) => x.id !== "deeper");
  const complete = required.length > 2 && required.every((x) => x.done());
  const signoff = SIGNOFFS[hashStr(date + "so") % SIGNOFFS.length];

  const findEvidence = async () => {
    if (!todaysAff) return;
    setBusy("evidence"); setErr("");
    try {
      const out = await askModel({
        messages: [{ role: "user", content: `My journal entries, oldest first:\n\n${digest(index, 110)}\n\nThis is something I'm telling myself this morning: "${todaysAff.text}"\n\nFind one moment in my own entries where I actually did this. One sentence, starting with the date in plain language, quoting my words. If there is genuinely nothing, reply exactly: NONE` }],
        maxTokens: 220,
      });
      setAm("affEvidence", /^NONE/i.test(out.trim()) ? "" : out.trim());
    } catch (e) { setErr(String(e.message || e)); }
    setBusy("");
  };

  const suggestAffirmations = async () => {
    setBusy("affsuggest"); setErr("");
    try {
      const out = await askJSON({
        messages: [{ role: "user", content: `My journal entries, oldest first:\n\n${digest(index, 100)}\n\nWrite three affirmations for me. Rules: tied to identity and behavior, not outcomes or abundance. Each must be something my entries show I am actually working on. Plain, masculine, first person, present tense. Nothing mystical. Nothing I could not say out loud to a friend.\n\nReturn only JSON: [{"text":"","cat":"one of: ${AFFIRMATION_CATS.join(", ")}"}]` }],
        maxTokens: 400,
      });
      setLib("affSuggestions", (Array.isArray(out) ? out : []).map((o) => ({ id: uid(), ...o })));
      setLibOpen(true);
    } catch (e) { setErr(String(e.message || e)); }
    setBusy("");
  };

  const assemble = () => {
    const g = grat.filter(has);
    const bits = [];
    if (g.length) bits.push(`I'm grateful for ${g.map((x) => x.trim().replace(/\.$/, "")).join(g.length > 2 ? ", " : " and ").replace(/, ([^,]*)$/, " and $1")}.`);
    if (has(day.intention)) bits.push(`Today I show up as ${day.intention.trim().replace(/^I (want to |will )?/i, "").replace(/\.$/, "")}.`);
    if (todaysAff && am.affAccepted) bits.push(todaysAff.text.trim());
    if (has(am.relationship)) bits.push(am.relationship.trim().replace(/\.$/, "") + ".");
    if (has(am.hard)) bits.push(`The hard thing is ${am.hard.trim().replace(/\.$/, "")}. It doesn't need to go perfectly. I just need to start it.`);
    const three = day.priorities.filter((p) => has(p.t)).map((p) => p.t.trim().replace(/\.$/, ""));
    if (three.length) bits.push(`If ${three.join(", ")} go well, today counted.`);
    setAm("declaration", bits.join("\n"));
  };

  const rewrite = async () => {
    setBusy("rewrite"); setErr("");
    try {
      const out = await askModel({
        messages: [{ role: "user", content: `Here is what I wrote this morning:\n\nGrateful for: ${grat.filter(has).join("; ")}\nWho I want to be: ${day.intention}\nAffirmation: ${todaysAff ? todaysAff.text : ""}\nRelationships: ${am.relationship || ""}\nHard thing: ${am.hard || ""}\nFirst move: ${am.hardMove || ""}\nToday's three: ${day.priorities.filter((p) => has(p.t)).map((p) => p.t).join("; ")}\n\nTurn this into a short declaration in my own voice. Three or four lines. Use my words wherever possible. Present tense, first person, plain and steady. No motivational-poster language, no exclamation marks, no metaphors. It should sound like a man talking to himself before he opens the door, not like a coach.` }],
        maxTokens: 350,
      });
      setAm("declaration", out.trim());
      setAm("declarationSrc", "generated");
    } catch (e) { setErr(String(e.message || e)); }
    setBusy("");
  };

  /* one suggestion, maximum */
  const suggestion = useMemo(() => {
    const running = lib.experiments.find((e) => e.status === "Running");
    if (running) return { k: "you", t: `Experiment running: ${running.action || running.title}` };
    const due = lib.decisions.find((d) => d.review && d.review <= todayKey && !d.happened);
    if (due) return { k: "you", t: `A decision is due for review: ${due.title}` };
    const hay = (grat.join(" ") + " " + (day.intention || "")).toLowerCase();
    if (hay.trim().length > 20 && lib.kb.length) {
      const active = THEMES.filter((t) => t.words.some((w) => hay.includes(w))).map((t) => t.id);
      const hit = lib.kb.find((k) => THEMES.filter((t) => t.words.some((w) => (k.text || "").toLowerCase().includes(w))).some((t) => active.includes(t.id)));
      if (hit) return { k: "you", t: hit.text };
    }
    return null;
  }, [lib, grat, day.intention, todayKey]);

  if (writeMode) {
    return (
      <div>
        <MorningHead date={date} todayKey={todayKey} opener={opener} />
        <div style={{ paddingTop: 8 }}>
          <Segment options={[{ id: "type", label: "Type" }, { id: "write", label: "Write" }]} value="write" onChange={(v) => v === "type" && setWriteMode(false)} />
          <Rule style={{ marginTop: 6, marginBottom: 18 }} />
        </div>
        <Quote quote={quote} core={core} setC={setC} />
        <div style={{ marginTop: 24 }}>
          <Ink value={ink.morning} onChange={(v) => setInk("morning", v)} height={460} full={full} onToggleFull={() => setFull((f) => !f)} label="Morning notebook" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <MorningHead date={date} todayKey={todayKey} opener={opener} core={core} setC={setC} />

      <div style={{ paddingTop: 6 }}>
        <Segment options={[{ id: "type", label: "Type" }, { id: "write", label: "Write" }]} value="type" onChange={(v) => v === "write" && setWriteMode(true)} />
        <Rule style={{ marginTop: 6 }} />
      </div>

      {/* mood, two taps, then the quote lands on it */}
      <div style={{ paddingTop: 24 }}>
        {[["energy", "Energy", ENERGY], ["headspace", "Headspace", HEADSPACE]].map(([k, label, opts]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "10px 0" }}>
            <Eyebrow>{label}</Eyebrow>
            <div style={{ display: "flex", gap: 16 }}>
              {opts.map((o) => (
                <Tap key={o} onClick={() => setAm(k, am[k] === o ? "" : o)}
                  style={{ fontFamily: SANS, fontSize: 13, padding: "6px 0", color: am[k] === o ? C.accent : C.ink28, transition: "color .3s" }}>{o}</Tap>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Quote quote={quote} core={core} setC={setC} />

      {on("gratitude") && (
        <div className="tj-reveal">
          <Section label="Gratitude" note="be specific">
            <div style={{ fontFamily: SERIF, fontSize: 19.5, fontWeight: 300, color: C.ink, lineHeight: 1.4, letterSpacing: "-0.014em", padding: "20px 0 4px" }}>
              {frames.gratitude}
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 0", borderBottom: i < 2 ? `1px solid ${C.lineSoft}` : "none" }}>
                <span style={{ color: C.accent, fontSize: 14, lineHeight: "26px", opacity: 0.45 }}>—</span>
                <div style={{ flex: 1 }}>
                  <Grow serif size={18.5} value={grat[i]} ariaLabel={`Gratitude ${i + 1}`}
                    onChange={(v) => setAm("gratitude", grat.map((x, j) => (j === i ? v : x)))}
                    placeholder={i === 0 ? "Something small and actual, not a category." : "…"} />
                </div>
              </div>
            ))}
            {gratMemory && (
              <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.line}` }}>
                <Mark kind="you" detail={`${Math.round(daysBetween(gratMemory.d, date) / 7)} weeks ago`} />
                <div style={{ fontFamily: SERIF, fontSize: 17.5, fontWeight: 300, fontStyle: "italic", color: C.ink70, lineHeight: 1.55, marginTop: 10 }}>
                  {gratMemory.t}
                </div>
                <div style={{ fontFamily: SANS, fontSize: 13, color: C.ink45, marginTop: 10 }}>Anything like that worth protecting today?</div>
              </div>
            )}
          </Section>
        </div>
      )}

      {on("affirmation") && todaysAff && (
        <div className="tj-reveal">
          <Section label="Affirmation" note={am.affAccepted ? "" : "say it, then move on"}>
            <div style={{ padding: "22px 0 6px" }}>
              <div style={{ fontFamily: SERIF, fontSize: 23, fontWeight: 300, color: C.ink, lineHeight: 1.4, letterSpacing: "-0.018em" }}>
                {todaysAff.text}
              </div>
              {am.affEvidence && (
                <div className="tj-reveal" style={{ marginTop: 16, paddingLeft: 14, borderLeft: `1px solid ${C.accent}` }}>
                  <Mark kind="generated" detail="from your entries" />
                  <div style={{ fontFamily: SANS, fontSize: 14, color: C.ink70, lineHeight: 1.6, marginTop: 8 }}>{am.affEvidence}</div>
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0 20px", paddingTop: 18, alignItems: "center" }}>
                <Tap onClick={() => setAm("affAccepted", !am.affAccepted)}
                  style={{ fontFamily: SANS, fontSize: 13, color: am.affAccepted ? C.accent : C.ink45, padding: "8px 0" }}>
                  {am.affAccepted ? "Taken" : "Take it"}
                </Tap>
                <Tap onClick={() => { const i = affirmations.findIndex((a) => a.id === todaysAff.id); setAm("affId", affirmations[(i + 1) % affirmations.length].id); setAm("affEvidence", ""); }}
                  style={{ fontFamily: SANS, fontSize: 13, color: C.ink28, padding: "8px 0" }}>Another</Tap>
                <Tap onClick={() => setC("affirmations", core.affirmations.map((a) => (a.id === todaysAff.id ? { ...a, fav: !a.fav } : a)))}
                  style={{ fontFamily: SANS, fontSize: 13, color: todaysAff.fav ? C.accent : C.ink28, padding: "8px 0" }}>{todaysAff.fav ? "Favorite" : "Favorite it"}</Tap>
                {busy === "evidence" ? <span style={{ fontFamily: SANS, fontSize: 13, color: C.ink28, padding: "8px 0" }}>Looking…</span> : (
                  !am.affEvidence && ai && index.length > 10 && (
                    <Tap onClick={findEvidence} style={{ fontFamily: SANS, fontSize: 13, color: C.ink28, padding: "8px 0" }}>Find the evidence</Tap>
                  )
                )}
                <Tap onClick={() => setLibOpen((o) => !o)} style={{ fontFamily: SANS, fontSize: 13, color: C.ink28, padding: "8px 0" }}>Library</Tap>
              </div>
            </div>
            {libOpen && <AffirmationLibrary core={core} setC={setC} lib={lib} setLib={setLib} ai={ai} onSuggest={suggestAffirmations} busy={busy === "affsuggest"} />}
          </Section>
        </div>
      )}

      {on("confidence") && (
        <div className="tj-reveal">
          <Section label="Capability">
            {pastWin && (
              <div style={{ paddingTop: 18 }}>
                <Mark kind="you" detail={midDate(pastWin.d)} />
                <div style={{ fontFamily: SERIF, fontSize: 17.5, fontWeight: 300, fontStyle: "italic", color: C.ink70, lineHeight: 1.55, marginTop: 8 }}>{pastWin.t}</div>
              </div>
            )}
            <Prompt q={frames.confidence} value={am.confidence} onChange={(v) => setAm("confidence", v)} last />
            {has(am.confidence) && !(core.wins || []).some((w) => w.t === am.confidence.trim()) && (
              <Tap onClick={() => setC("wins", [{ id: uid(), d: date, t: am.confidence.trim() }, ...(core.wins || [])])}
                style={{ fontFamily: SANS, fontSize: 12.5, color: C.accent, padding: "4px 0 12px" }}>Keep this as a win</Tap>
            )}
          </Section>
        </div>
      )}

      {on("excitement") && (
        <div className="tj-reveal">
          <Section label="Looking forward">
            <Prompt q={frames.excitement} value={am.excitement} onChange={(v) => setAm("excitement", v)} placeholder="It doesn't have to be productive." last />
          </Section>
        </div>
      )}

      {on("identity") && (
        <div className="tj-reveal">
          <Section label="Who you're being">
            <div style={{ fontFamily: SERIF, fontSize: 19.5, fontWeight: 300, color: C.ink, lineHeight: 1.4, letterSpacing: "-0.014em", padding: "20px 0 10px" }}>
              {frames.identity}
            </div>
            <Grow serif size={22} minH={34} value={day.intention} onChange={(v) => setD(["intention"], v)}
              placeholder="the kind of man who…" ariaLabel="Intention" style={{ letterSpacing: "-0.018em", lineHeight: 1.32 }} />
          </Section>
        </div>
      )}

      {on("relationships") && (
        <div className="tj-reveal">
          <Section label="Your people">
            <Prompt q={frames.relationships} value={am.relationship} onChange={(v) => setAm("relationship", v)} placeholder="Something you'll actually do, not a feeling." last />
          </Section>
        </div>
      )}

      {on("three") && (
        <div className="tj-reveal">
          <Section label="Today's three" note="intention, not a task list">
            <div style={{ fontFamily: SERIF, fontSize: 19.5, fontWeight: 300, color: C.ink, lineHeight: 1.4, letterSpacing: "-0.014em", padding: "20px 0 6px" }}>
              If only three things went well today, what would make it count?
            </div>
            {day.priorities.map((p, i) => (
              <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 0", borderBottom: i < 2 ? `1px solid ${C.lineSoft}` : "none" }}>
                <Tap aria={`Mark ${i + 1}`} onClick={() => setD(["priorities"], day.priorities.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} style={{ padding: "4px 0", marginTop: 4 }}>
                  <span style={{ display: "block", width: 14, height: 1, background: p.done ? C.accent : C.ink16, transition: "background .4s" }} />
                </Tap>
                <div style={{ flex: 1, opacity: p.done ? 0.4 : 1, transition: "opacity .4s" }}>
                  <Grow value={p.t} size={17.5} ariaLabel={`Priority ${i + 1}`}
                    onChange={(v) => setD(["priorities"], day.priorities.map((x, j) => (j === i ? { ...x, t: v } : x)))}
                    placeholder={i === 0 ? "Work, family, health, a conversation, a decision, rest." : "…"} />
                </div>
              </div>
            ))}
          </Section>
        </div>
      )}

      {on("hard") && (
        <div className="tj-reveal">
          <Section label="One hard thing">
            <Prompt q="What are you most tempted to avoid today?" value={am.hard} onChange={(v) => setAm("hard", v)} />
            <Prompt q="What's the first tiny move?" value={am.hardMove} onChange={(v) => setAm("hardMove", v)} placeholder="Small enough to do in two minutes." last />
          </Section>
        </div>
      )}

      {on("deeper") && (
        <div className="tj-reveal">
          <DeeperQuestion day={day} setD={setD} date={date} index={index} ai={ai} />
        </div>
      )}

      {on("declaration") && (
        <div className="tj-reveal">
          <Section label="Today" note={am.declarationSrc === "generated" ? "" : "assembled from what you wrote"}>
            {!has(am.declaration) ? (
              <div style={{ paddingTop: 18 }}>
                <Empty>Pull the morning together into something you'd actually say to yourself.</Empty>
                <div style={{ display: "flex", gap: 22, paddingTop: 8 }}>
                  <Tap onClick={assemble} style={{ fontFamily: SANS, fontSize: 13, color: C.accent, padding: "10px 0" }}>Assemble it</Tap>
                  {ai && <Tap onClick={rewrite} style={{ fontFamily: SANS, fontSize: 13, color: C.ink28, padding: "10px 0" }}>{busy === "rewrite" ? "Writing…" : "Write it in my voice"}</Tap>}
                </div>
              </div>
            ) : (
              <div style={{ paddingTop: 18 }}>
                <Mark kind={am.declarationSrc === "generated" ? "generated" : "you"} />
                <div style={{ marginTop: 12 }}>
                  <Grow serif size={20} value={am.declaration} onChange={(v) => { setAm("declaration", v); }} ariaLabel="Declaration" style={{ lineHeight: 1.62 }} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0 20px", paddingTop: 16 }}>
                  <Tap onClick={assemble} style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink28, padding: "8px 0" }}>Rebuild</Tap>
                  {ai && <Tap onClick={rewrite} style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink28, padding: "8px 0" }}>{busy === "rewrite" ? "Writing…" : "In my voice"}</Tap>}
                  <Tap onClick={() => setAm("signing", !am.signing)} style={{ fontFamily: SANS, fontSize: 12.5, color: am.signing ? C.accent : C.ink28, padding: "8px 0" }}>Sign it</Tap>
                </div>
                {am.signing && (
                  <div className="tj-reveal" style={{ paddingTop: 12 }}>
                    <Ink value={ink.declaration} onChange={(v) => setInk("declaration", v)} height={150} label="Signature" />
                  </div>
                )}
                {!am.signing && ink.declaration && ink.declaration.strokes && ink.declaration.strokes.length > 0 && (
                  <div style={{ paddingTop: 10 }}><InkThumb value={ink.declaration} height={70} /></div>
                )}
              </div>
            )}
          </Section>
        </div>
      )}

      {!openAll && firstOpen > -1 && firstOpen < steps.length - 1 && (
        <Ghost onClick={() => setOpenAll(true)}><span style={{ color: C.accent, marginRight: 8 }}>—</span>Show the rest</Ghost>
      )}

      {suggestion && visible >= steps.length - 1 && (
        <div style={{ marginTop: 34, paddingTop: 20, borderTop: `1px solid ${C.line}` }}>
          <Mark kind="you" detail="from your own notes" />
          <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 300, fontStyle: "italic", color: C.ink70, lineHeight: 1.55, marginTop: 10 }}>{suggestion.t}</div>
        </div>
      )}

      {err && <Note>{err}</Note>}

      {complete && (
        <div className="tj-finish">
          <div style={{ fontFamily: SERIF, fontSize: 27, fontWeight: 300, color: C.ink, letterSpacing: "-0.02em", lineHeight: 1.3 }}>{signoff}</div>
          <div style={{ fontFamily: SANS, fontSize: 13, color: C.ink28, marginTop: 12 }}>{longDate(date)}</div>
        </div>
      )}
    </div>
  );
}

function MorningHead({ date, todayKey, opener, core, setC }) {
  const fav = (core && (core.openingFavs || []).includes(opener)) || false;
  return (
    <div style={{ paddingTop: 14, paddingBottom: 4 }}>
      <h1 style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 38, lineHeight: 1.06, letterSpacing: "-0.026em", color: C.ink, margin: 0 }}>
        {date === todayKey ? "Good morning, TJ." : longDate(date)}
      </h1>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginTop: 12 }}>
        <div style={{ flex: 1, fontFamily: SERIF, fontSize: 19, fontWeight: 300, fontStyle: "italic", color: C.ink45, lineHeight: 1.5 }}>{opener}</div>
        {setC && (
          <Tap onClick={() => setC("openingFavs", fav ? core.openingFavs.filter((x) => x !== opener) : [...(core.openingFavs || []), opener])}
            aria="Keep this line" style={{ color: fav ? C.accent : C.ink16, fontSize: 15, padding: "2px 0 2px 6px" }}>{fav ? "★" : "☆"}</Tap>
        )}
      </div>
    </div>
  );
}

function Quote({ quote, core, setC }) {
  const favs = (core && core.quoteFavs) || [];
  const fav = favs.includes(quote.w);
  return (
    <div className="tj-quote">
      <div style={{ fontFamily: SERIF, fontSize: 20.5, fontWeight: 300, color: C.ink, lineHeight: 1.5, letterSpacing: "-0.014em" }}>
        “{quote.w}”
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 12, gap: 12 }}>
        <span style={{ fontFamily: SANS, fontSize: 11.5, letterSpacing: "0.09em", textTransform: "uppercase", color: C.ink45 }}>{quote.a}</span>
        {setC && (
          <Tap onClick={() => setC("quoteFavs", fav ? favs.filter((x) => x !== quote.w) : [...favs, quote.w])}
            aria="Keep this quote" style={{ color: fav ? C.accent : C.ink16, fontSize: 14, padding: "2px 0 2px 8px" }}>{fav ? "★" : "☆"}</Tap>
        )}
      </div>
      {quote.n && <div style={{ fontFamily: SANS, fontSize: 13, color: C.ink45, marginTop: 10, lineHeight: 1.5 }}>{quote.n}</div>}
    </div>
  );
}

function DeeperQuestion({ day, setD, date, index, ai }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const list = day.morning || [];
  const ask = async () => {
    setBusy(true); setErr("");
    try {
      if (index.length < 8) throw new Error("Not enough written yet for this to be worth anything.");
      const out = await askJSON({
        messages: [{ role: "user", content: `My journal entries, oldest first:\n\n${digest(index)}\n\nWrite one question for me for this morning. It should come from something specific and recurring in these entries. It is the morning, so aim it forward: what I could do or notice today, not what is wrong with me. Direct, not gentle, not therapeutic.\n\nReturn only JSON: ["the question"]` }],
        maxTokens: 300,
      });
      const q = (Array.isArray(out) ? out : [])[0];
      if (!q) throw new Error("Nothing came back.");
      setD(["morning"], [...list, { id: uid(), q: String(q), a: "", src: "generated" }]);
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(false);
  };
  return (
    <Section label="Deeper" note="one question, from the record">
      {list.map((a) => (
        <div key={a.id} style={{ padding: "20px 0 4px" }}>
          <div style={{ fontFamily: SERIF, fontSize: 18.5, fontWeight: 300, color: C.ink, lineHeight: 1.35, marginBottom: 8 }}>{a.q}</div>
          {a.src === "generated" && <div style={{ marginBottom: 10 }}><Mark kind="generated" detail={`from ${index.length} entries`} /></div>}
          <Grow value={a.a} ariaLabel={a.q} onChange={(v) => setD(["morning"], list.map((x) => (x.id === a.id ? { ...x, a: v } : x)))} placeholder="…" />
        </div>
      ))}
      {busy ? <Working label="Reading back" /> : (
        <Ghost onClick={ask} disabled={!ai}><span style={{ color: C.accent, marginRight: 8 }}>+</span>{ai ? "Ask me something from the record" : "Reflection is switched off"}</Ghost>
      )}
      {err && <Note>{err}</Note>}
    </Section>
  );
}

function AffirmationLibrary({ core, setC, lib, setLib, ai, onSuggest, busy }) {
  const [cat, setCat] = useState("All");
  const [draft, setDraft] = useState("");
  const [draftCat, setDraftCat] = useState("Identity");
  const all = core.affirmations || [];
  const list = all.filter((a) => (cat === "All" ? true : cat === "Archived" ? a.archived : a.cat === cat && !a.archived));
  const move = (id, dir) => {
    const i = all.findIndex((a) => a.id === id), j = i + dir;
    if (j < 0 || j >= all.length) return;
    const next = [...all];
    next.splice(j, 0, next.splice(i, 1)[0]);
    setC("affirmations", next);
  };
  const sugg = lib.affSuggestions || [];
  return (
    <div className="tj-reveal" style={{ marginTop: 10, paddingTop: 18, borderTop: `1px solid ${C.line}` }}>
      <div className="tj-seg" style={{ gap: 14, paddingBottom: 8 }}>
        {["All", ...AFFIRMATION_CATS, "Archived"].map((c) => (
          <Tap key={c} onClick={() => setCat(c)} style={{ fontFamily: SANS, fontSize: 11.5, letterSpacing: "0.06em", whiteSpace: "nowrap", padding: "6px 0", color: cat === c ? C.accent : C.ink16 }}>{c}</Tap>
        ))}
      </div>
      {sugg.length > 0 && (
        <div style={{ padding: "6px 0 14px" }}>
          <Mark kind="generated" />
          {sugg.map((s) => (
            <div key={s.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
              <div style={{ flex: 1, fontFamily: SERIF, fontSize: 17.5, fontWeight: 300, color: C.ink, lineHeight: 1.5 }}>{s.text}</div>
              <Tap onClick={() => { setC("affirmations", [...all, { id: uid(), text: s.text, cat: s.cat || "Identity" }]); setLib("affSuggestions", sugg.filter((x) => x.id !== s.id)); }}
                style={{ fontFamily: SANS, fontSize: 12, color: C.accent, padding: "4px 0 4px 8px", whiteSpace: "nowrap" }}>Add</Tap>
              <Tap onClick={() => setLib("affSuggestions", sugg.filter((x) => x.id !== s.id))} style={{ color: C.ink16, fontSize: 13, padding: "4px 0 4px 6px" }} aria="Dismiss">×</Tap>
            </div>
          ))}
        </div>
      )}
      {list.map((a) => (
        <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "13px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
          <div style={{ flex: 1 }}>
            <Grow serif size={17} value={a.text} ariaLabel="Affirmation"
              onChange={(v) => setC("affirmations", all.map((x) => (x.id === a.id ? { ...x, text: v } : x)))} placeholder="I…" />
            <div style={{ fontFamily: SANS, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: C.ink16, marginTop: 5 }}>{a.cat || "Identity"}</div>
          </div>
          <Tap onClick={() => setC("affirmations", all.map((x) => (x.id === a.id ? { ...x, fav: !x.fav } : x)))} aria="Favorite" style={{ color: a.fav ? C.accent : C.ink16, fontSize: 13, padding: "4px 3px" }}>{a.fav ? "★" : "☆"}</Tap>
          <Tap onClick={() => move(a.id, -1)} aria="Move up" style={{ color: C.ink16, fontSize: 13, padding: "4px 3px" }}>↑</Tap>
          <Tap onClick={() => setC("affirmations", all.map((x) => (x.id === a.id ? { ...x, archived: !x.archived } : x)))}
            style={{ fontFamily: SANS, fontSize: 11, color: C.ink16, padding: "4px 0 4px 4px", whiteSpace: "nowrap" }}>{a.archived ? "restore" : "archive"}</Tap>
        </div>
      ))}
      <div style={{ paddingTop: 14 }}>
        <Grow serif size={17} value={draft} onChange={setDraft} placeholder="Write your own" ariaLabel="New affirmation" />
        {draft.trim() && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", paddingTop: 10, alignItems: "center" }}>
            {AFFIRMATION_CATS.map((c) => (
              <Tap key={c} onClick={() => setDraftCat(c)} style={{ fontFamily: SANS, fontSize: 11, letterSpacing: "0.06em", padding: "4px 0", color: draftCat === c ? C.accent : C.ink16 }}>{c}</Tap>
            ))}
            <Tap onClick={() => { setC("affirmations", [...all, { id: uid(), text: draft.trim(), cat: draftCat }]); setDraft(""); }}
              style={{ fontFamily: SANS, fontSize: 13, color: C.accent, padding: "6px 0" }}>Add</Tap>
          </div>
        )}
      </div>
      {ai && (
        <Ghost onClick={onSuggest}>
          <span style={{ color: C.accent, marginRight: 8 }}>—</span>{busy ? "Reading your entries…" : "Suggest some from my patterns"}
        </Ghost>
      )}
    </div>
  );
}

/* ══════════ HISTORY — a timeline of what you've kept ══════ */
function History({ index, inkDates, core, setDate, date }) {
  const [scale, setScale] = useState("day");
  const wins = core.wins || [];

  const days = useMemo(() => {
    const map = {};
    for (const r of index) {
      if (!map[r.d]) map[r.d] = { d: r.d, typed: 0, gratitude: 0, identity: 0 };
      map[r.d].typed += 1;
      if (r.sec === "gratitude") map[r.d].gratitude += 1;
      if (r.sec === "identity") map[r.d].identity += 1;
    }
    for (const k of inkDates) if (!map[k]) map[k] = { d: k, typed: 0, gratitude: 0, identity: 0 };
    for (const w of wins) if (!map[w.d]) map[w.d] = { d: w.d, typed: 0, gratitude: 0, identity: 0 };
    return Object.values(map)
      .map((x) => ({ ...x, ink: inkDates.includes(x.d), win: wins.some((w) => w.d === x.d) }))
      .sort((a, b) => (a.d < b.d ? 1 : -1));
  }, [index, inkDates, wins]);

  const groups = useMemo(() => {
    if (scale === "day") return days.map((d) => ({ key: d.d, label: longDate(d.d), items: [d] }));
    const by = {};
    for (const d of days) {
      const k = scale === "week" ? weekKeyOf(d.d) : scale === "month" ? monthKey(d.d) : d.d.slice(0, 4);
      (by[k] = by[k] || []).push(d);
    }
    return Object.entries(by).map(([k, items]) => ({
      key: k,
      label: scale === "week" ? `Week of ${midDate(mondayOf(items[items.length - 1].d))}` : scale === "month" ? monthName(items[0].d.slice(0, 7)) : k,
      items,
    })).sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [days, scale]);

  const dot = (on, title) => (
    <span title={title} style={{ width: 6, height: 6, borderRadius: "50%", background: on ? C.accent : "transparent", border: `1px solid ${on ? C.accent : C.ink16}`, display: "inline-block" }} />
  );

  return (
    <div>
      <Segment options={[{ id: "day", label: "Day" }, { id: "week", label: "Week" }, { id: "month", label: "Month" }, { id: "year", label: "Year" }]} value={scale} onChange={setScale} />
      <Rule style={{ marginTop: 6 }} />
      <Section label="Timeline" note="entries · gratitude · identity · wins · ink" top={24}>
        {groups.length === 0 && <Empty>Nothing yet. It fills in as you write.</Empty>}
        {groups.map((g) => {
          const agg = g.items.reduce((a, x) => ({ typed: a.typed + x.typed, gratitude: a.gratitude + x.gratitude, identity: a.identity + x.identity, ink: a.ink || x.ink, win: a.win || x.win }), { typed: 0, gratitude: 0, identity: 0, ink: false, win: false });
          return (
            <Tap key={g.key} onClick={() => scale === "day" && setDate(g.items[0].d)}
              style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "15px 0", borderBottom: `1px solid ${C.lineSoft}`, textAlign: "left" }}>
              <span style={{ flex: 1, fontFamily: SERIF, fontSize: 17, fontWeight: 300, color: g.items[0].d === date ? C.accent : C.ink70 }}>{g.label}</span>
              <span style={{ fontFamily: SANS, fontSize: 11, color: C.ink16, minWidth: 34, textAlign: "right" }}>{agg.typed || ""}</span>
              <span style={{ display: "flex", gap: 7, alignItems: "center" }}>
                {dot(agg.gratitude > 0, "Gratitude")}
                {dot(agg.identity > 0, "Identity")}
                {dot(agg.win, "Win")}
                {dot(agg.ink, "Handwritten")}
              </span>
            </Tap>
          );
        })}
      </Section>

      {wins.length > 0 && (
        <Section label="Wins" note={`${wins.length} kept`}>
          {wins.slice(0, 12).map((w) => (
            <div key={w.id} style={{ padding: "16px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
              <Eyebrow style={{ color: C.ink16, marginBottom: 6 }}>{midDate(w.d)}</Eyebrow>
              <div style={{ fontFamily: SERIF, fontSize: 17.5, fontWeight: 300, color: C.ink70, lineHeight: 1.55 }}>{w.t}</div>
            </div>
          ))}
        </Section>
      )}

      {index.some((r) => r.sec === "gratitude") && (
        <Section label="Gratitude archive" note="what you keep coming back to">
          {index.filter((r) => r.sec === "gratitude").slice(-24).reverse().map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
              <span style={{ fontFamily: SANS, fontSize: 10.5, color: C.ink16, minWidth: 46, letterSpacing: "0.05em", paddingTop: 4 }}>{midDate(r.d)}</span>
              <span style={{ flex: 1, fontFamily: SERIF, fontSize: 17, fontWeight: 300, color: C.ink70, lineHeight: 1.5 }}>{r.t}</span>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
