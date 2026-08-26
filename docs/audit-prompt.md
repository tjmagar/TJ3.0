# TJ 3.0 — Full Audit & Optimization Prompt

> Paste everything below the line into a fresh Claude Code session opened on this repo.
> It assumes `CLAUDE.md` is loaded (it will be, automatically).

---

## ROLE

You are the sole maintainer of TJ 3.0 — a single-user journal and personal
operating system that its owner uses every morning and every evening, on an
iPad, as a PWA. There is no team, no staging environment, and no second copy of
the data. Everything the owner has ever written lives in one IndexedDB store on
one device.

Act like the engineer who will still own this file in three years: conservative
with data, exacting about the reading and typing experience, and unwilling to
ship a fix you have not actually run. You are not a refactoring enthusiast. The
codebase is deliberately one 3,500-line file with inline styles, and it stays
that way.

Read `CLAUDE.md` in full before your first edit. It is the product spec and it
overrides your instincts. In particular: the design is not up for
renegotiation, and the priority order in it decides every tradeoff you hit.

## CONTEXT

**What exists.** `src/App.jsx` (~3,500 lines, React 18, plain JSX, inline
styles, one injected CSS string). Nine sections: Today (morning/evening),
People, Faith, Journal, Patterns, Judgment, Library, Becoming, Talk. It began
as an artifact-sandbox file and was scaffolded into a Vite static site in a
prior pass, which delivered:

- `src/storage.js` — IndexedDB shim behind `window.storage`, preserving the
  throw-on-missing-key contract the `S` helper depends on. `src/storage.test.js`
  covers it under vitest.
- PWA setup — `vite.config.js` (vite-plugin-pwa), manifest, icons, service
  worker with a network-first navigation strategy so Vercel redeploys are not
  pinned behind a stale shell.
- API key entry in Settings → Data, stored at `tj:apikey`, excluded from export.
- `vercel.json` SPA rewrite.

**What is wrong.** The owner's verdict is "this version sucks, so buggy." That
is accurate, and the causes are known. Section 1 of the task below is a defect
register that has already been verified by reading the source — you are not
starting from a blank page. Treat it as confirmed findings to fix, not as
hypotheses to re-litigate. Section 3 asks you to find what the register missed.

**The single most important fact.** Priority 1 in `CLAUDE.md` is *never lose
written data*. Several defects below are silent data-loss paths. They outrank
everything else in this document, including anything that merely looks broken.

**Scope boundary.** Do not touch `Ink` / `InkThumb` internals in this pass
beyond the two items explicitly listed under 1.6 — the handwriting rework is a
separate piece of work with its own constraints in `CLAUDE.md`, and it needs a
physical iPad to validate. Do not restyle anything. Do not add Tailwind, a
router, a state manager, or a component library. Do not split the file.

---

## TASK

### 1. Fix the verified defect register

Ordered by severity. Each item gives the anchor (symbol name, plus an
approximate line — lines shift as you edit, so navigate by symbol). Fix the
cause, not the symptom.

#### 1.1 — A failed read silently overwrites real data with an empty record `[P0, data loss]`

`S.get` (~line 66) catches every error and returns `null`. The shim throws on a
missing key, so "no record" and "IndexedDB threw" are indistinguishable to
every caller.

The consequence, in `App`'s date effect (~line 2102) plus `useSave` (~line
2129): a transient read failure yields `mergeDay(date, null)` → an empty day →
`useSave` sees a valid day whose `date` matches → 700ms later it writes that
empty day over the real record. One failed read destroys a day's entry.

Fix so that a genuine read failure is distinguishable from a missing key, and
so that a save is never issued for state that was hydrated from a failed read.
A day that failed to load must not be autosaved over.

#### 1.2 — Debounced saves are cancelled, never flushed `[P0, data loss]`

`useSave` (~line 2129) returns `clearTimeout` from its effect. When `key`
changes (the owner taps to another date) or the component unmounts within the
debounce window, the pending write is cancelled and never lands. Type a
sentence, tap to yesterday within 700ms, the sentence is gone. The index writer
(~line 2149, 1400ms) has the same shape and a wider window.

Fix so pending writes flush on key change and unmount rather than being
discarded.

#### 1.3 — No flush when the PWA is backgrounded `[P0, data loss]`

On iOS a standalone PWA can be frozen or reclaimed at any moment. Nothing
listens for `visibilitychange` or `pagehide`, so anything inside the debounce
window dies with the page. `CLAUDE.md` explicitly requires PWA close-and-reopen
to be handled.

Add a flush on backgrounding. It must not interrupt an active pen stroke —
coordinate with the ink layer rather than forcing a write mid-stroke.

#### 1.4 — `setAm` clobbers itself; two features are dead as a result `[P1, visible breakage]`

`Morning`'s `setAm` (~line 2906) is `(k, v) => setD(["am"], { ...am, [k]: v })`,
where `am` is captured from the render closure. Two `setAm` calls in one handler
both spread the *same stale* `am`, so the second discards the first. Two
confirmed user-visible failures:

- **"Write it in my voice" produces nothing** (~line 3024): `setAm("declaration",
  out.trim())` immediately followed by `setAm("declarationSrc", "generated")`.
  The generated declaration is thrown away; only the provenance flag survives.
- **"Another" affirmation does nothing** (~line 3134): `setAm("affId", …)` then
  `setAm("affEvidence", "")`. The new affirmation id is discarded.

Fix `setAm` (and `setD`, which has the same closure-capture shape) to use
functional updates so sequential calls compose. Then audit every call site for
other instances of the same pattern.

#### 1.5 — `Talk` drops messages written during an in-flight request `[P1, data loss]`

`Talk.send` (~line 1815) captures `talk` at call time and spreads it again
*after* the await (~line 1828). Anything that changed during the request is
overwritten. Convert to functional updates.

#### 1.6 — Every AI feature is dead `[P1, whole subsystem non-functional]`

`askModel` (~line 210) posts to `api.anthropic.com` with `Content-Type` as its
only header. No API key, no version header, no browser-access header. Every AI
call in the app 401s or is blocked by CORS. The key is stored at `tj:apikey`
and never read by the request path. Additionally, `maxTokens` is accepted as a
parameter and then ignored — `max_tokens: 1000` is hardcoded (~line 216) while
call sites pass 220 through 1200.

These facts are current as of this writing and have been checked against the
docs — do not re-guess them:

- Browser calls require `anthropic-dangerous-direct-browser-access: true`, or,
  via the official TypeScript SDK, the `dangerouslyAllowBrowser: true` client
  option. "Bring your own key" is an explicitly acknowledged legitimate use of
  it, which is exactly this app's posture.
- `anthropic-version: 2023-06-01` is required on raw HTTP calls (the SDK sends
  it automatically).
- Valid current model ids include `claude-opus-5`, `claude-sonnet-5`,
  `claude-sonnet-4-6`, and `claude-haiku-4-5`. Note that `CLAUDE.md` asserts
  `claude-sonnet-4-6` "is almost certainly not valid on the public API" — that
  assumption is now wrong; it is a real model id. Default to `claude-opus-5`
  unless the owner says otherwise, and tell them what you picked.

**Decide and recommend:** whether to adopt `@anthropic-ai/sdk` with
`dangerouslyAllowBrowser: true` (typed errors, automatic retries, streaming,
one less thing to hand-maintain — at the cost of a dependency and bundle
weight) or to keep raw `fetch` with the header set by hand. State your
recommendation with the tradeoff and implement it; this is a reversible call
and does not need to block on an answer.

Then make failure legible without violating the no-error-modals rule: a 401
(bad key) must read differently from a 429 (rate limited) and from being
offline. Follow the existing pattern — the button says why, inline, in a
`Note`. `CLAUDE.md` is explicit that with no key set, everything counted and
hand-written keeps working and AI affordances degrade quietly.

#### 1.7 — Re-listing IndexedDB on every keystroke `[P2, performance]`

The journal-dates effect (~line 2160) depends on `[view, journal]`. `journal` is
a fresh object on every keystroke, so every character typed in the Journal view
triggers two full `S.list` scans. Depend on something stable.

#### 1.8 — Canvas is resized and cleared on every committed stroke `[P2, performance]`

In `Ink`, `paint` is a `useCallback` over `[strokes, paper, sel]`, and `strokes`
is derived fresh from `value` on each render. The sizing effect (~line 2709)
depends on `paint`, so every stroke commit re-enters `fit()`, which reassigns
`canvas.width`/`height` — destroying and repainting the whole bitmap. The
eraser is worse: it commits per pointer move.

This is the one ink item in scope. Fix the dependency so sizing runs on actual
geometry changes only. **Do not** start the layered-canvas rework, coalesced
events, or stroke smoothing here — those are the separate pass.

#### 1.9 — `.tj-inkfull` uses `calc(100vh - 210px)` `[P2]`

Wrong in standalone PWA, as `CLAUDE.md` already predicts. Move to `dvh`/`svh`
with safe-area insets. Cheap, isolated, and in scope.

#### 1.10 — Import leaves the app in a half-refreshed state `[P2]`

`importAll` (~line 2203) restores `core`, `lib`, `day`, `journal`, `index`, and
`ink`, but not `talk`, `week`, `month`, `journalDates`, or `inkDates`. It also
ignores write failures — a quota error mid-import reports "Imported" and the
owner believes their backup restored. Make it complete and make it honest.

#### 1.11 — New sections never appear for existing users `[P2, upgrade path]`

`core.order` is persisted. Hydration does `{ ...emptyCore(), ...c }`, so a saved
`order` array from an older build wins wholesale and any section added later is
permanently invisible in the nav. Same shape applies to `hidden`. Reconcile
persisted `order`/`hidden` against the current `SECTIONS` on load.

#### 1.12 — `writeIndex` read-modify-write race `[P3]`

`writeIndex` (~line 176) reads a month shard, filters, and writes it back. Two
rapid writes to the same shard can interleave and lose rows. Serialize writes
per shard.

#### 1.13 — The index only reads four months, but the UI claims otherwise `[P3, honesty]`

`readIndex(4)` bounds the working set, while Talk says "Reads everything you've
written here" and every `Mark` reports "from N entries." After four months that
is quietly false, and provenance honesty is the entire point of this app.
Either widen the window, or make the claim accurate. Raise this with the owner
rather than choosing silently — it is a product question, not a bug.

---

### 2. Remove "Deals" from Judgment

The owner's words: *"Drop the sales tab 'deals'. It's for TJ 3.0 not my sales
job."*

Remove the Deals tab and its UI: the tab entry in the `Judgment` segment
(~line 1399), `dealFields` (~line 1354), and the `tab === "deals"` block
(~line 1432). Update `readJudgment` (~line 1380), which currently reads
`[...lib.calls, ...lib.deals]`, and the "Across your reviews" counter
(~line 1457), which sums both.

Two constraints:

- **Do not delete stored `deals` data.** Leave the key in storage and in the
  JSON export. Priority 1 says never lose written data, and "I removed the UI"
  is not a licence to drop records the owner may want later.
- Changing the reviews counter means touching a copy string, which `CLAUDE.md`
  normally forbids. That is sanctioned here because removing Deals forces it.
  Keep the change minimal and in the existing voice. Change nothing else.

**Ask before acting:** `Judgment` also carries *Calls* and *Language*, which are
likewise sales-shaped, and `THEMES` contains a `sales` theme feeding the
counted layer. The owner named only Deals. Ask whether Calls and Language stay
before touching them — do not infer the wider cut.

---

### 3. Audit for what the register missed

The register above came from one reading pass. Do your own. Concentrate where
this codebase's failure modes actually live:

- **Stale closures over state in async handlers and multi-call handlers.** 1.4
  and 1.5 are two instances of one systemic pattern. Find the rest.
- **Effect dependency arrays containing freshly-built objects or arrays**
  (`pool` in `Today`'s seeding effect, ~line 658, is one) — these re-run every
  render.
- **Every path where a write can be issued from state that was never
  successfully hydrated.**
- **`migrate` / `mergeDay` / `emptyCore` merge semantics** against records
  written by older versions.
- **Error swallowing.** `catch { return null }` and `catch { return [] }` appear
  throughout `S`. Each one is a place a real failure looks like an empty result.

For anything you find, apply the same bar: name the symptom, the cause, and the
file:line, and rank it against the `CLAUDE.md` priority order.

---

## OUTPUT

### Deliverable 1 — Audit report, before you change anything

Write `docs/audit-YYYY-MM-DD.md`. For each finding: id, severity keyed to the
`CLAUDE.md` priority order, `file:line` + symbol, the symptom the owner would
actually notice, the cause, and the fix in one or two sentences. Mark each as
`confirmed` (you reproduced or traced it) or `suspected`. Separate anything you
believe needs the owner's decision into its own short list.

Do not pad this. A finding you cannot trace to a line is not a finding.

### Deliverable 2 — The fixes

Small, reviewable commits grouped by defect, each message naming the defect and
its consequence. Not one omnibus commit. Push to `claude/tj3-setup-2kqdkw`,
which already has PR #1 open — pushing updates it.

### Deliverable 3 — Tests where they pay

Extend `src/storage.test.js` and add coverage for the data-safety fixes
specifically: throw-on-missing-key still holds; a failed read does not produce a
save; a pending debounced write flushes on key change and on unmount. These are
the regressions that would cost real journal entries, and they are the ones
worth locking down. Do not chase coverage elsewhere.

### Deliverable 4 — A completion report that is honest

State plainly what you fixed, what you found and deliberately did not fix (with
the reason), and what you could not verify without a physical iPad.

### Verification gates — run these, do not assert them

Before you claim done:

- `npm run build` succeeds; `npm run preview` serves.
- `npm test` — the vitest suite **runs and passes**. Report the actual output.
  A suite that exists but does not run is not a passing suite.
- All nine sections render. Morning (`tj-dawn`) and evening (`tj-dusk`) themes
  both apply.
- Typing survives a hard refresh.
- Typing, then changing date inside the debounce window, survives.
- Export → fresh profile → import round-trips entries, insights, books, and
  handwriting intact.
- With no key set: nothing crashes, AI buttons read as unavailable, counted and
  hand-written layers work.
- With a key set: "Read what I've written" in Patterns returns a real insight.
- Strokes replay after refresh.
- Judgment renders without Deals; a previously-saved deals record still appears
  in the JSON export.

`docs/ipad-checklist.md` covers what only hardware can test. Emulation does not
test any of it — say so rather than implying otherwise.

### Decide vs. ask

**Decide yourself** (say what you chose and why): SDK vs. raw fetch; which model
id; how to structure the flush-on-background; test shape.

**Ask before acting:** anything that changes the design, a palette value, a type
size, or a copy string beyond the one Deals-forced counter; whether Calls and
Language follow Deals out; how to resolve the four-month index window against
the "reads everything" claim; adding any runtime dependency beyond the
Anthropic SDK.

When you hit a genuine uncertainty, do every part that does not depend on the
answer first, then ask once, with the options and your recommendation.
