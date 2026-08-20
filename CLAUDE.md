# TJ 3.0

## What this is

A personal journal and operating system, used every morning and evening by one person. Nine sections: Today (morning and evening modes), People, Faith, Journal, Patterns, Judgment, Library, Becoming, Talk.

It is **not** a drawing app. Handwriting is one surface inside it, in three places: the morning notebook, the daily declaration signature, and the Journal "Write" tab. `Ink` and `InkThumb` are the only drawing components.

Roughly 90% of use is reading and typing; 10% is Apple Pencil. Both must be excellent. They are different problems, and work on one must not degrade the other.

Origin: `TJ30-adaptive.jsx`, a single 3,400-line React 18 file written for Claude's artifact sandbox. Inline styles, one injected CSS string. No Tailwind, no CSS framework, no component library. Read it fully before changing anything.

## The design is not up for renegotiation

Editorial and typographic: a serif display face, hairline dividers, uppercase letterspaced eyebrow labels, generous whitespace, one muted green accent, three palettes that swap by context (`.tj-dawn` morning, parchment default, `.tj-dusk` evening and Talk).

Do not:

- Widen or remove the 640px `max-width` on `.tj-main`. That is a reading measure, not a bug. It stays narrow on every screen. The canvas is exempt and may use full width.
- Shrink or remove section headers, eyebrow labels, dividers, or padding on reading screens. That whitespace is the product.
- Replace the bottom text nav with icons, a sidebar, or a tab bar.
- Change any palette value, type size, or copy string.
- Alter the `Mark` component or the labels "Your words," "Counted," "Generated." That provenance distinction is the point of the app.
- Add Tailwind, a UI library, a router, or a state manager.
- Split the file into a component tree unless a build error forces it, and then minimally.

If a design change is genuinely required to solve a technical problem, propose it and wait.

## Priority order when tradeoffs appear

1. Never lose written data
2. Reading and typing quality across the nine sections
3. Apple Pencil writing quality
4. iPad usability, landscape first, portrait second
5. Performance as content accumulates
6. Simple maintainable architecture
7. Desktop and phone compatibility

## Stack and deployment

Vite + React 18, plain JSX. Static site. GitHub → Vercel → iPad Home Screen PWA. No Next.js, no Docker, no VPS, no persistent server. Configure Vercel rewrites so refreshing a client-side route does not 404.

## API key — decision already made

Pure static site, no serverless proxy. The app calls the Anthropic API directly from the browser using a key entered once in Settings → Data, stored in IndexedDB under `tj:apikey`. Masked input, with a remove action. Exclude that key from the JSON export.

Reasoning, so it isn't argued back: a proxy on a public URL is an open endpoint anyone who finds it can spend credits through, and this is a single-user app not worth owning an auth problem for. The key lives on the device, the same trust boundary as the journal itself.

Check current Anthropic docs for the header permitting direct browser calls and for the correct model string. `claude-sonnet-4-6` in the source is a sandbox alias and is almost certainly not valid on the public API. Look both up; do not guess.

With no key set, every AI affordance degrades exactly as it already does when reflection is switched off in settings — counted and hand-written layers keep working, buttons say why. Follow the existing pattern. No error modals.

## Storage

The source calls `window.storage.get/set/list` through the `S` helper. That API exists only in Claude's artifact sandbox. Replace it with an IndexedDB-backed shim exposing an identical interface so the rest of the file is untouched.

- `idb-keyval` or a small hand-rolled wrapper. Not localStorage — ink is stored as vector stroke arrays and will exceed the quota.
- `get` must **throw** on a missing key, not return null. Existing code catches that and treats it as "no record." Preserve the contract exactly.
- All keys are prefixed `tj:`. Export and import iterate `S.list("tj:")`. Verify both after the swap.

## Data safety is a feature, not a chore

Everything written lives on one device. Clearing website data, resetting the iPad, or Safari storage eviction would destroy years of journaling. The existing manual JSON export is not sufficient protection.

Propose and implement a real answer before the app is relied on. Evaluate and recommend among: scheduled automatic export to the Files app; an iCloud Drive folder picked once; a quiet but unavoidable "last backed up N days ago" indicator; optional sync that requires no server to maintain.

Also handle the ordinary cases: refresh, PWA close and reopen, orientation change, remount, and the existing debounced saves (700ms for records, 1400ms for the index). Autosave must never interrupt an active stroke. Destructive actions must not be one accidental tap away.

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

Browser: build succeeds and previews; all nine sections render; morning and evening themes both apply; typing survives a hard refresh; the JSON backup imports with entries, insights, books and handwriting intact; export from a fresh profile imports cleanly; with no key nothing crashes and AI buttons read as unavailable; with a key, "Read what I've written" in Patterns returns a real insight; strokes replay after refresh; routes survive direct navigation on Vercel.

Physical iPad: see @docs/ipad-checklist.md. Emulation does not test any of it.
