# TJ 3.0

## What this is

A personal journal and operating system, used every morning and evening by one person.

Five sections: **Today** (morning and evening modes), **Areas**, **Journal**, **Review**, **Talk**. Five, because nine scrolled off the edge of an iPad and adding more made a taxonomy problem worse.

It is **not** a drawing app. Handwriting is one surface inside it, in three places: the morning notebook, the daily declaration signature, and the Journal "Write" tab. `Ink` and `InkThumb` are the only drawing components.

Roughly 90% of use is reading and typing; 10% is Apple Pencil. Both must be excellent. They are different problems, and work on one must not degrade the other.

Origin: `TJ30-adaptive.jsx`, a single React 18 file written for Claude's artifact sandbox, now `src/App.jsx` at roughly 3,900 lines. Inline styles, one injected CSS string. No Tailwind, no CSS framework, no component library. Read it fully before changing anything.

## The design is not up for renegotiation

Editorial and typographic, now rendered dark: a serif display face, hairline dividers, uppercase letterspaced eyebrow labels, generous whitespace.

**The palette is dark green, bright orange, black, slate and sand** — TJ's words. Sand is the text, orange is the single accent, green and slate are the ground. Three contexts: `.tj-dawn` (morning, green-black with an orange sunrise), the slate default, `.tj-dusk` (evening and Talk, deepest). Sand on slate reads 14:1 and orange 6.9:1 — computed, not eyeballed.

**Glass is the surface language.** Every raised thing — quote, scripture, cards, prompts, vision tiles, the settings sheet, the toast, the header and nav — is a translucent pane over a blurred ground: `backdrop-filter: blur(~22px) saturate(150%)`, a hairline `--glassLine` border, an inset top highlight, and a soft drop shadow. `.tj-wash` paints large green and orange orbs behind everything; without something to blur, frosted panes look flat, so the orbs are what makes the glass read. Keep green and orange apart in that wash — overlapped they mix to brown.

Blur is expensive on an iPad, so it is used on surfaces, never on rows or list items. `prefers-reduced-transparency` drops every blur to a flat slate.

Do not:

- Widen or remove the 640px `max-width` on `.tj-main`. That is a reading measure, not a bug. It stays narrow on every screen. The canvas is exempt and may use full width.
- Shrink or remove section headers, eyebrow labels, dividers, or padding on reading screens. That whitespace is the product.
- Replace the bottom text nav with icons, a sidebar, or a tab bar. It is text, it holds five items, it does not scroll, and every target is at least 44pt. Adding a sixth means taking one away.
- Change any palette value, type size, or copy string without a reason TJ gave you.
- Alter the `Mark` component or the labels "Your words," "Counted," "Generated." That provenance distinction is the point of the app.
- Add Tailwind, a UI library, a router, or a state manager.
- Split the file into a component tree unless a build error forces it, and then minimally.

If a design change is genuinely required to solve a technical problem, propose it and wait.

## Life areas

The app's one taxonomy. `ANCHORS`, the Becoming goal buckets, `THEMES`, book `OUTCOMES` and the retrieval sections used to be five overlapping lists that disagreed; `AREA_DEFS` is the list now and the rest point at it. Do not add a sixth.

Eleven areas under four groups: **Foundation** (Body, Money, Home, Play & rest), **Relationships** (Marriage, Fatherhood, Friendship), **Performance** (Work, Mind), **Identity** (Faith, Character).

- **Every area carries its own `hue`**, repainted onto `--accent` for that page's subtree, so a drilled-down area feels like its own place rather than eleven identical forms. All eleven clear 7:1 on the slate ground Areas renders on — checked, not eyeballed, because a hue has to survive the glass wash too.
- **Areas are data, not constants.** They can be added, renamed, retired and reordered. The list a man has at 36 is not the one he has at 46.
- **Seasons.** Every area is *in focus*, *maintaining*, or *dormant*. **Three in focus, maximum.** Dormant is a deliberate, guilt-free choice — an area set down must not sit there accusing him. Eleven simultaneous focus areas is how a person levels up in none of them.
- **Play & rest is not decoration.** Without it the app measures only striving, and a genuinely restful week reads as a failed one. That is a quiet way for a tool like this to make its owner worse. Do not quietly drop it.
- **The morning follows the season.** With areas in focus, the morning asks about those and drops the generic rotation they replace. Flow length is something he controls by choosing what he is working on, not something he scrolls past.
- **The level check** is the revisit loop: his own words from last time set beside what he would write today, then a forced re-choice of the three. The delta is the point, not a score. It reuses the `identity.versions` pattern.
- Areas read their own id **plus their legacy section names** (`AREA_SECS`), so entries indexed before the restructure stay visible.

`ANCHORS` is the one list that still has not been folded into `AREA_DEFS`. Its sixth entry — "Sales — improve judgment, not just activity" — was left over from the removed sales surfaces and is gone; `day.anchors.sales` stays in storage and in the export. The remaining five still overlap the areas (Discipline against the sheet's non-negotiables, Health against Body). That is a real duplication and it has not been resolved. Do not paper over it; propose the fold.

`day.body`, `day.wife`, `day.daughter` and `day.faith` keep their existing shape and paths. Areas are a view over them, not a migration of them — which is why nothing written before the restructure had to move.

## The daily sheet

Modelled on the paper goal sheet TJ uses. Its mechanic is not "set goals" — it is **rewriting the same goals, in present tense, every single day**. The app already showed him identity statements and affirmations; it never made him re-inscribe them, which is the entire point of the paper version.

- `core.lifeGoals` are written as facts, not targets. "I make $74,000 a month" does different work than "reach $74k". Do not rephrase them into targets.
- `core.dailyActions` carry a cadence — *every day* or *Monday–Friday*. The distinction is from the sheet and it matters: some things do not happen on a Saturday, and pretending otherwise just manufactures a broken streak.
- **`dailyActions` is the only non-negotiables list.** There used to be a second, `core.nonNegotiables`, edited in a Discipline tab and read out in the evening — same name, same idea, a different record nothing else touched. That is what "I don't really understand what I do regardless" was. It folds into `dailyActions` once, on load, keyed by `disciplineMerged`; the old array stays in storage and in the export. Ticked in the morning on the sheet, ticked or reviewed in the evening, both writing `day.sheet.did`. Do not add a third.
- The rewrite happens in the morning (`DailySheet`), typed or by hand. The Pencil is the truer version; the paper sheet is handwritten.
- What was written files into Character under "Written again today", so the run of consecutive days is counted from the record rather than stored as a score.
- Editing the sheet lives in Areas → Character, not in the morning. The morning is for doing it.

**The vision board** is the sheet's photo panel. TJ names what he is working toward; the photographs are his own, added from the camera roll and downscaled to ~1400px JPEG on the way in so storage and the JSON export stay sane. Nothing ships with the app — no stock image carries the same weight, and shipping product photography would be someone else's copyright. It **leads the morning, above the greeting, every day** — the paper sheet keeps the picture at the top of the page, and a board you have to scroll to is a board you stop seeing. One photograph runs large; the rest sit in a strip beneath it and promote to the lead with one tap. The lead is **dealt, not hashed** (`visionLead`): every photograph is shown once before any repeats, the order reshuffles on each pass, and none leads two mornings running. `hashStr(date) % n` looked like a rotation and was not one — it clustered badly enough that with eight photos one led four times in three weeks and another twice. Derived from the date, so it stores nothing, holds still all day, and two devices agree. Before any photo exists it is a single line and an "Add a photo" — never a grid of empty rectangles, and never a dead end that sends him to Areas to get started. **Editing is where the mistake gets made**: a quiet "Edit" under the strip reveals a remove on each thumbnail and turns each into a picker, so a wrong photograph is replaced or dropped in the morning rather than by going to Character. Naming a card still lives in Character.

## The morning is short on purpose

TJ's words after using it: *"quite a few things I have to fill out, so it almost feels like a chore"* and *"there's some elements of duplicativeness."* He was right — four separate steps circled the same identity material.

Six beats, each distinct: energy and headspace (two taps), the quote, gratitude, who you're being, one question, today's three, the sheet.

**Everything is on screen.** Progressive disclosure hid the sheet and the question behind a "Show the rest" TJ never found — a morning you have to unfold is a longer morning, not a shorter one.

A **scripture verse** (World English Bible, public domain) and a **Stoic passage** (Marcus, Seneca, Epictetus in public-domain translation) rotate daily under the quote. The Daily Stoic's own commentary is Ryan Holiday's and is not reproduced; only the primary sources it draws on.

- **One question, not four.** `MORNING_QUESTIONS` rotates one prompt a day. It replaced the confidence, anticipation and relationships frames, which overlapped each other and the intention.
- **The sheet does the identity work.** Affirmation and declaration are therefore `off` by default. They still exist in Settings → Morning; they are not deleted, because the defaults are a judgement and he may want them back.
- **Focus areas are read back, never re-asked.** The morning shows the next move you already wrote for each area in focus. It does not ask you to write another line about it, and that step never blocks the flow.
- `FREQ_DEFAULT` and `FREQ_VERSION` carry this. Bump the version when the defaults change meaningfully, or a saved `freq` from the long morning will keep the chore.

Do not add a step without taking one away, and do not add a question that could be answered with the same sentence as an existing one.

## The day closes

Three things were written every morning and nothing ever asked whether they happened. Without that, the app has no record of follow-through and the next morning has nothing to carry.

- **The evening marks the three**: *Did it*, *Moved it*, *Didn't*, on `p.state`. Not a score — "0 of 3" counts only what was done, and a thing you moved is information, not a failure.
- **The morning offers back what was left open**, under "Left open yesterday", with one tap to put it in an empty slot. It is never auto-filled: a thing moved three days running is something he should see himself doing.
- Yesterday is loaded read-only as `prevDay`. An unreadable yesterday must not halt today the way an unreadable today does.
- **The evening ticks the non-negotiables and logs the numbers.** The headline metric of each area in focus — the first in its `metrics` — sits in one row in the evening. Logging only from inside an area screen meant three separate visits, so nothing got logged and the charts stayed empty.

## Review and Talk

**Review is three tabs.** Nine sections became five, and Review promptly rebuilt nine inside itself: Insights, Blind spots, Experiments, Decisions, Week, Month, Level check — three of which were the same act, the model reading the record back. Now: **Looking back** (the synthesis, with a *This week* / *This month* range, and the three readings stacked under it in one scroll), **Decisions**, **Level check**. A reading is not a peer of the week it belongs to.

**Talk knows the day.** It read years of archive and nothing about the day in front of him, so using it meant retyping what he had just written. Its system prompt now carries today's intention, gratitude, the three and their state, and the areas in focus with their next moves. There are ways in from the evening ("Talk it through") and from any area screen ("Talk about work"), each handing it an opener built from his own words. With no key they degrade like every other AI affordance — the button says why.

## Metrics and charts

Areas carry structured data as well as prose. Each area's `metrics` in `AREA_DEFS` define what is tracked: `kind` picks the input and the mark, `goal` says which direction is good so a delta can be coloured honestly rather than "up is green", and the first metric is the area's headline.

Values live on `day.metrics` and are mirrored into a month-sharded series (`tj:met:YYYY-MM`) because trends need numbers across days, which the text index cannot answer.

Chart rules, and they are not stylistic:

- **Form follows the data's job.** Continuous values (sleep, weight, money) are a trend: 2px line, 10% area wash, one end-dot with a surface ring. Binary and 1–5 ordinal values are *magnitude*, so they are bars from a baseline. Drawn as lines they produce sawtooth that means nothing — this was shipped wrong once.
- **One series per chart**, so there is no legend and no categorical palette. The heading says what is plotted.
- **Label the endpoint only.** Never a number on every point.
- Gridlines hairline and recessive; text wears ink tokens, never the accent.
- Figures are **sans**, not the serif display face — a serif hero number reads as decoration.
- A toggle's headline is how many days it happened, not its latest value.

## Priority order when tradeoffs appear

1. Never lose written data
2. Reading and typing quality across the five sections
3. Apple Pencil writing quality
4. iPad usability, landscape first, portrait second
5. Performance as content accumulates
6. Simple maintainable architecture
7. Desktop and phone compatibility

## Stack and deployment

Vite + React 18, plain JSX. Static site. GitHub → Vercel → iPad Home Screen PWA. No Next.js, no Docker, no VPS, no persistent server. Configure Vercel rewrites so refreshing a client-side route does not 404.

**Shipping is not a separate decision.** Work is only useful once it reaches the iPad, and the only route there is `main`. When a change is finished and verified, open the pull request and merge it without asking. Do not leave finished work sitting on a branch waiting for permission.

Finished still means finished: the build passes, `npm test` passes, and anything the change plausibly breaks has been checked. Say what landed afterwards, and flag anything you could not verify — merging without asking is not licence to merge without looking.

## API key — decision already made

Pure static site, no serverless proxy. The app calls the Anthropic API directly from the browser using a key entered once in Settings → Data, stored in IndexedDB under `tj:apikey`. Masked input, with a remove action. Exclude that key from the JSON export.

Reasoning, so it isn't argued back: a proxy on a public URL is an open endpoint anyone who finds it can spend credits through, and this is a single-user app not worth owning an auth problem for. The key lives on the device, the same trust boundary as the journal itself.

Browser calls require the `anthropic-dangerous-direct-browser-access: true` header alongside `x-api-key` and `anthropic-version`. "Bring your own key" is the acknowledged use for it, and it is exactly this app's posture. Verified against the docs, not guessed.

The model is `claude-opus-5`, in the `MODEL` constant. (An earlier draft of this file claimed `claude-sonnet-4-6` was a sandbox alias invalid on the public API — that was wrong; it is a real model id. Corrected so it does not get propagated again.)

With no key set, every AI affordance degrades exactly as it already does when reflection is switched off in settings — counted and hand-written layers keep working, buttons say why. Follow the existing pattern. No error modals.

## Storage

The source calls `window.storage.get/set/list` through the `S` helper. That API exists only in Claude's artifact sandbox. Replace it with an IndexedDB-backed shim exposing an identical interface so the rest of the file is untouched.

- `idb-keyval` or a small hand-rolled wrapper. Not localStorage — ink is stored as vector stroke arrays and will exceed the quota.
- `get` must **throw** on a missing key, not return null. Existing code catches that and treats it as "no record." Preserve the contract exactly.
- All keys are prefixed `tj:`. Export and import iterate `S.list("tj:")`. Verify both after the swap.

## Data safety is a feature, not a chore

Everything written lives on one device. Clearing website data, resetting the iPad, or Safari storage eviction would destroy years of journaling. The existing manual JSON export is not sufficient protection.

**Built: the indicator.** `core.lastBackup` is stamped on every export. One line sits at the foot of every day — "Backed up 3 days ago", or the accent-orange "Not backed up in 21 days — export now", or "Never backed up" — and exports on tap. Quiet because it is one line in `ink16`; unavoidable because he reaches the bottom of the evening every night. `BACKUP_WARN_DAYS` is 14. Settings → Data repeats it under the export.

Still open, and worth doing: scheduled automatic export to the Files app; an iCloud Drive folder picked once; optional sync that requires no server to maintain.

**Migrations must reach disk.** `useSave` skips the first render, so a `mergeCore` migration used to live only in memory: the next load redid it, and anything keyed off ids it generated broke between sessions. `mergeCore` sets a `MIGRATED` Symbol — a Symbol so `JSON.stringify` drops it and it never reaches storage — and the loader commits the record once.

**Undo, not confirmation.** Nothing written could be taken back — every × was final. A confirmation on each one puts a dialog in front of a man tidying his own list, which is not what confirmations are for, and `CLAUDE.md` already rules out modals. So the delete happens and the toast offers it back for 6.5 seconds: `offerUndo(label, restore)`, a module-level sink App claims on mount, the same shape `flushers` uses. `restore` closes over the whole prior array rather than the removed item, so undo puts the list back exactly as it was. Wired into every delete that destroys something written — vision cards, life goals, daily actions, identity statements, journal entries, kept lessons, goals, books, experiments, decisions.

The handwriting canvas has had its own undo/redo all along; that stays. Typed fields get the browser's native undo while focused, which is not the same thing and does not survive leaving the field.

**Still one accidental tap away:** import overwrites every record in the file with no confirmation and no merge. That is the remaining violation of the line below, and it is the one place a wrong tap costs years.

Also handle the ordinary cases: refresh, PWA close and reopen, orientation change, remount, and the existing debounced saves (700ms for records, 1400ms for the index). Autosave must never interrupt an active stroke. Destructive actions must not be one accidental tap away.

**Storage is per device.** IndexedDB is scoped to one origin in one browser on one device; nothing syncs. Photographs added on a laptop do not reach the iPad. The JSON export carries them as base64 (about 380KB per photograph after the 1400px downscale, so five is roughly 1.8MB) and imports cleanly onto a fresh profile — verified. Treat the iPad as the source of truth.

## PWA

Installable from Safari to the iPad Home Screen, launching standalone with no browser chrome.

- Manifest: `display: standalone`, theme and background `#F5F2EA`, name "TJ 3.0"
- Icons: 180×180 apple-touch-icon, 192 and 512 PNGs. Quiet — parchment field, one serif letterform.
- `apple-mobile-web-app-capable`, status bar style `default`
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` — the app uses `env(safe-area-inset-*)` and depends on `viewport-fit=cover`
- Do not assume `100vh` is the usable viewport. Prefer `dvh`/`svh`. `.tj-inkfull` uses `calc(100vh - 210px)` and is expected to be wrong in standalone. Fix it.
- Service worker for offline app shell, with a version check. Do not cache-first the JS bundle in a way that pins a stale build across Vercel deploys.
- Writing and reading work offline. Only AI features require network.

## Pencil and touch

Apple Pencil is a first-class input. Pointer Events throughout, never mouse events. Branch on `event.pointerType`: `pen` draws, `touch` navigates and operates UI, `mouse` is desktop.

**Palm rejection is mandatory.** During an active pen stroke, a palm or finger on the glass must not mark, interrupt the stroke, pan the canvas, fire a button, or trigger a gesture.

Known bug: `sawPen.current` is set true on first pen contact and never resets, so finger drawing is permanently disabled for the session once the Pencil is used. Replace with intent-scoped suppression — suppress conflicting touch during and briefly after an active pen stroke, not forever.

**Pressure.** Use `event.pressure` where meaningful values exist; fall back to a consistent default width where they don't, without hard-coding around a Pencil generation. Smooth the signal — the current code maps raw pressure straight to width and produces jitter.

**Gestures.** Pencil draws. One finger operates UI. Two fingers pan. Pinch zooms. Manage `touch-action` per element rather than disabling browser behavior globally.

## Known defects in the ink component, in priority order

1. `paint()` redraws every stroke on every pointer move. Degrades as strokes accumulate. Move to a layered canvas — committed strokes baked underneath, only the live stroke redrawn per frame — or an equivalent you can defend.
2. No `getCoalescedEvents()`. On a 120Hz ProMotion display, fast handwriting drops points between frames.
3. Raw points joined by straight segments. Interpolate or smooth so handwriting reads as curves.
4. No pan or zoom. Evaluate whether the notebook needs a transformable canvas and say what it costs.
5. Pointer capture is already used. Keep it.

Avoid React state updates per pointer move. Strokes persist as vectors — keep it that way; `InkThumb` replays them in the archive and the timeline depends on it.

If a library would materially improve handwriting quality or performance, name it, explain the tradeoff, and wait for an answer before adding it.

## Full-page notebook mode

In standalone PWA mode: canvas fills the available application space; top toolbar and bottom controls both fully visible and never clipped by safe areas or system UI; canvas resizes correctly across orientation changes; the app shell does not scroll around the notebook; writing near screen edges stays usable.

## Verification before claiming done

Browser: build succeeds and previews; all five sections render; the eleven areas seed and group; morning and evening themes both apply; typing survives a hard refresh; the JSON backup imports with entries, insights, books and handwriting intact; export from a fresh profile imports cleanly; with no key nothing crashes and AI buttons read as unavailable; with a key, "Read what I've written" in Patterns returns a real insight; strokes replay after refresh; routes survive direct navigation on Vercel.

Physical iPad: see @docs/ipad-checklist.md. Emulation does not test any of it.
