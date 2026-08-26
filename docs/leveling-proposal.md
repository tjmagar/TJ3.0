# TJ 3.0 — leveling up: proposal

Draft for reaction, not a plan of record. Nothing here is built yet.

## What you said

- Too many sections in the nav.
- The morning/evening flow is too long.
- The bottom nav is hard to reach or hit.
- Add Health and Finances.
- *"Think about a human leveling up and every facet or area they'd spend time on. I need the app to reflect that and allow me to revisit as I do level up."*

## The diagnosis

**Two problems, one cause.**

Your nav mixes two different kinds of thing. *People* and *Faith* are life areas. *Today, Journal, Patterns, Judgment, Library, Becoming, Talk* are instruments — things you do. Nine items already scroll horizontally; Health and Finances make eleven. Adding tabs to a taxonomy problem makes it worse.

Underneath that, the app already carries **five overlapping taxonomies that disagree with each other**:

| Where | What it is | Count |
|---|---|---|
| `ANCHORS` | daily reminders — wife, daughter, discipline, faith, health, sales | 6 |
| `AREAS` (Becoming) | goal buckets — Relationships, Performance, Foundation, Identity | 4 |
| `THEMES` | counted keyword themes | 18 |
| `OUTCOMES` (Library) | what a book is for | 12 |
| `INDEX_SECTIONS` | how entries are filed for retrieval | 8 |

Health exists as a `body` block buried at the bottom of the evening. Money exists only as a counted theme. Play, rest, home and friendship do not exist anywhere. That incoherence is felt more than it is seen, and it is why the app can be good and still not feel right.

---

## 1. One life-areas model

Eleven areas, grouped under the four you already wrote in `Becoming`, so the grouping is yours rather than mine.

**Foundation** — Body · Money · Home · Play & Rest
**Relationships** — Marriage · Fatherhood · Friendship
**Performance** — Work · Mind
**Identity** — Faith · Character

| Area | Covers | Today |
|---|---|---|
| **Body** | sleep, training, food, recovery, energy, drink | the buried evening `body` block |
| **Money** | earning, spending, debt, saving, giving | a counted theme only |
| **Home** | the physical order of where you live | nothing |
| **Play & Rest** | joy, hobbies, adventure, actual rest | **nothing** |
| **Marriage** | Sara | People → Wife |
| **Fatherhood** | Margo | People → Daughter |
| **Friendship** | the friends men lose in their thirties | nothing |
| **Work** | craft, judgment, ambition, contribution | scattered across Judgment + a theme |
| **Mind** | focus, learning, emotional regulation, what you're reading | Library, partially |
| **Faith** | practice, doubt, meaning, service | its own section |
| **Character** | who you're becoming, integrity, promises | Becoming |

**Play & Rest is the one I most want you to keep.** As it stands the app measures striving and nothing else, which means a genuinely restful week reads as a failed one. That is a quiet way for a tool like this to make a person worse.

**Areas are data, not code.** Add, rename, retire, reorder. The list a man has at 36 is not the list he has at 46, and "revisit as I level up" is the whole request.

## 2. Seasons — the part that makes it a leveling system

Every area sits in one of three states:

- **In focus** — you are actively working on it. **Maximum three.**
- **Maintaining** — it matters, it is fine, you are not pushing.
- **Dormant** — deliberately set down for now. Guilt-free and explicit.

This app already believes in constraint — *"three, no more"*, *"Four areas. No more."* Eleven simultaneous focus areas is how a person levels up in none of them. Dormant being a real, chosen state is what stops the list becoming a wall of quiet accusation.

## 3. What each area holds

- **Where it honestly stands** — your words, not a score.
- **What better looks like here** — your words.
- **The next actual move** — small enough that you can't talk yourself out of it.
- **What the record says** — counted from your own entries, and read back by the model. Marked `Counted` and `Generated`, same as everywhere else.

## 4. The revisit loop

A **Level check**, on a cadence you set (quarterly by default). It shows each area beside what you wrote last time, asks what actually changed, and makes you re-choose the three in focus.

The delta is the point: not a score going up, but *"three months ago you said this about Money, here is what you said today."* The app already does exactly this for identity statements (`identity.versions`) — this reuses that pattern rather than inventing one.

## 5. Taxonomy reconciliation

One area list becomes the source of truth. Everything else references it:

- `THEMES` keep their keywords but gain an `areaId`, so counting rolls up per area.
- `INDEX_SECTIONS` become area ids — entries file themselves into areas.
- `OUTCOMES` (books) become area ids — a book is *for* an area.
- `ANCHORS` derive from the areas in focus rather than being a separate hardcoded six.
- `AREAS` in Becoming becomes the grouping layer above.

No fifth taxonomy is added. Four disappear.

## 6. Navigation — nine scrolling items to five fixed

**Today · Areas · Journal · Review · Talk**

- **Today** — morning and evening, unchanged in spirit
- **Areas** — the hub; every life area, grouped, showing focus state
- **Journal** — type, write, history
- **Review** — Patterns, weekly and monthly synthesis, the decision journal, and the Level check
- **Talk**

Judgment, Library and Becoming stop being top-level: the decision journal moves into Review, books and principles into Mind, identity and discipline into Character. Nothing is deleted — it stops competing for a slot in a bar that can only hold five.

Five fits an iPad without scrolling, which fixes "too many" and "hard to hit" together. Tap targets go to a 44pt minimum, which they are currently under.

## 7. Why this also fixes the long morning

The morning currently walks up to ten fixed steps. Instead it asks about **the areas in focus** — at most three — plus the fixed core that shouldn't move: gratitude, who you're being, the three things, the declaration.

Set Body, Money and Marriage in focus and that is what the morning asks about. Set them dormant and it stops. The flow length becomes something you control by choosing your season, rather than something you scroll past.

---

## Migration

Nothing is orphaned. Existing records map forward:

| From | To |
|---|---|
| `day.body.*` | Body |
| `day.wife.*` | Marriage |
| `day.daughter.*` | Fatherhood |
| `day.faith.*` | Faith |
| `core.identity`, `core.nonNegotiables` | Character |
| `lib.books`, `lib.kb` | Mind |
| `lib.decisions` | Review → decision journal |
| `lib.deals`, `lib.calls`, `lib.language` | retained in storage and export, as now |
| `tj:idx:*` | rewritten to area ids, old shards kept until verified |

This is proven by test, not asserted: a realistic pre-change export goes in, migrates, and every entry, insight, book, decision and stroke is shown still present and reachable.

## `CLAUDE.md` rules this needs lifted

You have said design is open. Naming them anyway, because the spec should not silently diverge from the code:

1. **"Replace the bottom text nav"** — staying text, going from nine scrolling to five fixed.
2. **"Change any copy string"** — new areas need new copy; existing copy stays.
3. **"Shrink or remove section headers, eyebrow labels, dividers, padding"** — not planned, but the Areas hub is a new density.
4. **"Split the file"** — `src/App.jsx` is ~3,600 lines and this adds substantially. **My recommendation: split only the areas system into its own module and leave the rest alone.** For a single-maintainer app, one file you can search beats a tree you have to navigate.
5. **640px measure** — *keeping it.* You did not say the text was too narrow, and it is the right measure for reading. The Areas hub can use the full width; reading screens stay at 640.

Not up for negotiation regardless, and I would push back if asked: the provenance model (`Mark` — Your words / Counted / Generated), and never losing written data.

## What I am deliberately not doing

- **The handwriting rework.** Palm rejection, pressure jitter, coalesced events, pan and zoom are all still open and still need a physical iPad. Restructuring on top of them would only make them harder to isolate. They should be their own pass, before or after this — not inside it.
- **Touching the typographic voice.** Serif display face, hairline rules, eyebrow labels, the three palettes. That is what makes the app feel like yours, and none of your three complaints point at it.

## Open questions

1. **Eleven areas — too many?** Cut freely. My strong keep is Play & Rest; my weakest is Home.
2. **Level check cadence** — quarterly, monthly, or on demand?
3. **Does "Work" stay** given you cut the sales surfaces, or is it too close to the job you didn't want in here?
4. **Should Talk keep a nav slot**, or move inside Review? Keeping it is a bet that you talk to it often.
