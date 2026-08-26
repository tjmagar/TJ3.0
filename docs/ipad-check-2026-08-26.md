# iPad check — the 2026-08-26 pass

Scoped to what actually changed in this pass. The standing full list is
`docs/ipad-checklist.md`; run that one after a deploy that touches input or the
service worker in a bigger way. Findings and reasoning: `docs/audit-2026-08-26.md`.

Roughly ten minutes. Do it in order — the first block is the one that matters.

**Before you start:** install from Safari via Add to Home Screen and launch from
the Home Screen icon, not from a Safari tab. Standalone is the only mode where
the layout changes in this pass are real.

---

## 1. Data safety — the reason for this pass

Two bugs here were silently destroying writing. These are the tests that prove
they're gone.

```
[ ] Type a few words in Gratitude. Within about a second — before you'd
    normally stop typing — tap ‹ to the previous day. Tap › back.
    The words are still there.
```
> This is the one. The debounced save used to be cancelled rather than written,
> so anything typed in the last 700ms before leaving a day was gone for good.

```
[ ] Type something, then immediately swipe up to the Home Screen without
    waiting. Reopen the app. The text is there.
```
> iOS can freeze a standalone PWA the moment you leave it. Nothing used to be
> flushed on the way out.

```
[ ] Type something, then pull down to hard-refresh. Nothing is lost.
[ ] Close the app fully (swipe away from the app switcher), reopen. Work intact.
[ ] Write in the morning notebook, rotate the iPad, rotate back.
    The strokes are still there and the canvas fills the new shape.
```

## 2. Full-page notebook — the one layout change

`.tj-inkfull` moved off `calc(100vh - 210px)` onto a flex column at `100dvh`.
`100vh` is not the usable viewport in standalone, so this was expected to be
wrong before and is the change only a real device can judge.

Open Journal → Write → **Full page**, then:

```
[ ] Landscape: canvas fills the screen
[ ] Portrait: canvas fills the screen
[ ] Top toolbar (Pen / Pencil / Marker / Eraser / Lasso, undo, Close) fully visible
[ ] Bottom row (blank / ruled / dot, Clear) fully visible, not under the home indicator
[ ] Nothing clipped by the notch or the status bar
[ ] The page behind the notebook doesn't scroll or rubber-band
[ ] Writing near all four edges still marks
[ ] Rotate while in full page: canvas resizes, strokes survive
```

## 3. Offline and deploys

```
[ ] Airplane mode: the app opens, and reading and writing work
[ ] Airplane mode: AI buttons say why rather than erroring or hanging
[ ] Back online: nothing duplicated, nothing clobbered
[ ] After the next Vercel deploy, the installed app actually picks it up
    (you should get the "new version is ready" prompt, not a stale build)
```

> Note: the serif face (Newsreader) loads from Google Fonts and is **not**
> precached. Offline, expect type to fall back to Georgia. That's a known
> finding in the audit, not a bug in this pass — but if it bothers you offline,
> say so and I'll self-host the font.

## 4. Expected to fail — do not treat these as regressions

The handwriting rework is a separate pass and CLAUDE.md scopes it that way. I
deliberately touched exactly one ink item (a canvas that reallocated its whole
bitmap on every stroke). These are still open and known:

```
[×] Finger drawing after Pencil use, without reload   — sawPen never resets
[×] Smooth stroke width, no jitter                    — raw pressure → width
[×] Fast handwriting reads as curves                  — no getCoalescedEvents
[×] Two-finger pan / pinch zoom                       — not implemented
```

If you hit these, the build is behaving as expected. Everything else failing is
a real problem worth telling me about.

## 5. The line that gets skipped

```
[ ] Reading screens still look right
```

No palette value, type size, or copy string was changed in this pass, so this
should be untouched — but the original checklist is right that this is where
damage happens quietly. Open **Patterns** and **Becoming** and just look: the
640px measure, the type scale, the eyebrow labels, the whitespace.

One surface is genuinely new and you've never seen it: if IndexedDB ever fails
to read, the app now stops on a short "storage couldn't be read" screen instead
of rendering an empty day and saving over your real one. You shouldn't be able
to trigger it in normal use — but that's the only new screen in this pass.
