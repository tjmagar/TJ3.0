# Physical iPad checklist

Desktop browser emulation does not test Apple Pencil, palm rejection, safe areas, or standalone viewport behavior. None of this is verifiable without the device. Run it after every deploy that touches input, layout, or the service worker.

## Install and shell

```
[ ] Add to Home Screen works from Safari
[ ] Launches standalone, no Safari chrome
[ ] Landscape fills the screen
[ ] Portrait fills the screen
[ ] Top toolbar not clipped
[ ] Bottom controls not clipped
[ ] Nothing hidden behind safe areas
[ ] No unwanted scrolling or rubber-banding around the app shell
```

## Pencil and touch

```
[ ] Pencil draws
[ ] Finger does not accidentally draw while the Pencil is in use
[ ] Palm resting on the glass leaves no marks
[ ] Pencil stroke continues uninterrupted with the palm down
[ ] Finger drawing still possible after Pencil use, without reload
[ ] Pressure visibly varies stroke width where the hardware supports it
[ ] Stroke width changes smoothly, no jitter
[ ] Fast handwriting stays smooth — no corners where curves belong
[ ] Two-finger pan and pinch zoom behave as intended
[ ] Undo and redo
[ ] Eraser removes the intended strokes
[ ] Lasso selects and moves
[ ] Scribble works in typed fields
```

## State and durability

```
[ ] Orientation change preserves notebook state and resizes the canvas
[ ] Close and reopen the PWA preserves work
[ ] Hard refresh mid-session loses nothing
[ ] Offline: writing and reading work, AI degrades cleanly
[ ] Reconnecting does not duplicate or clobber anything
[ ] A new Vercel deploy actually reaches the installed app
```

## The one that gets skipped

```
[ ] Reading screens still look right
```

Open Patterns and Becoming side by side against the original artifact build. The 640px measure, the type scale, the eyebrow labels, the whitespace. Everything above this line is measurable and satisfying to fix. This line is subjective and easy to wave through, and it is where the damage happens if it happens.
