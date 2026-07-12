# Debug notes — mystery oval ring on the v14 invitation cover

## What the bug looks like
A thin, egg-shaped **oval ring** (~62% of the card's width, spanning from
~15% to ~78% of its height, slightly narrower at the top, with a soft
drop shadow on its right edge) painted on the white invitation cover,
behind the text column. Its top passes exactly where the `.cov-swans`
crop sits; its bottom meets the gold wax seal. Visible at both narrow
and desktop viewport widths. **No DOM element accounts for it** so far:
`elementsFromPoint` on its edge (even after force-enabling
pointer-events on everything) returns only `.cov-text`/`.cover`
containers, and a `getBBox()` sweep over every SVG child of `.cover`
finds nothing oval-sized (only the `#bspray` use, 220×477).

## Ruled out by visual bisect (hide → oval persisted)
1. `.cov-swans` (`display:none`) — oval still there.
2. `.cov-spray` / spray artwork — exonerated in the final bisect frame:
   with the trio below hidden, the spray still renders and the oval is
   **gone**, so the spray isn't the painter.
3. Geometry rules out: wax-seal pulse ring (~94px circle), fire-water
   `::after` glow (opacity 0, ~94px), `.inv-medallion` (measured
   116×116 at (258,281)), `.inv-photo` locket (118×150).
4. `.cover::before` inner frame is likely NOT it — the rounded-rect
   frame and the oval were visible **simultaneously** in the first
   screenshot (two distinct shapes).

## Current suspects (the oval vanished when ALL THREE were hidden together)
- `.env-card` (inner invitation card, base `opacity: 0`, `z-index: 2`
  under the cover). Prime suspect: this embedded preview browser is
  known to freeze CSS transitions mid-state (documented earlier in the
  session), so an opacity-0-by-transition element may composite at a
  stale partial opacity. Which child could read as an oval at scale
  0.88 is unclear — check `.inv-crest`, watermark `::after`, locket.
- `.cov-text` subtree pseudo-elements (unchecked: each child's
  `::before/::after` computed `content` + `border-radius`).
- `.cover::before` (kept in the hidden trio for completeness; see #4).

## Next steps
1. Re-enable one at a time: hide **only** `.env-card` → screenshot; if
   oval gone, culprit is in the inner card subtree. Else hide only
   `.cov-text` and repeat.
2. If `.env-card`: hide its children progressively; also dump
   `card.getAnimations()` and computed opacity at paint time.
3. If `.cov-text`: loop children logging
   `getComputedStyle(el, "::before"/"::after").content/borderRadius`.
4. **Reality check on a real browser**: open the live site (or local)
   in the user's actual Chrome — the preview browser's frozen-animation
   quirk may be fabricating this; the oval may not exist in production.
5. Cheap, robust fix worth applying regardless of root cause:
   `.env-card { visibility: hidden; }` plus
   `.risen .env-card, .presented .env-card { visibility: visible; }` —
   an invisible-by-visibility element cannot paint, unlike a
   compositor-frozen opacity. Verify the open animation still works
   after adding it.

## State warning
The working tree holds **uncommitted v14 changes** (new `#bspray` /
`#bwreath` defs from the workflow winners, ref-layout cover, hero
sprays, muted palette). Commit or stash before any experimental
resets — the artwork exists nowhere else except the workflow journal:
`~/.claude/projects/-Users-maheshikawalpola-Documents-wedding-planner/78d84ede-2b1d-4daa-a78d-d2f2efa6c87e/subagents/workflows/wf_e1aa64cf-2d4/journal.jsonl`
(spray winner = agent `a7849eac8f0d7d7b7`, wreath winner = `aec7bd5f178b81a12`).
