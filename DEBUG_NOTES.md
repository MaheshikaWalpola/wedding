# Debug notes — mystery oval ring on the v14 invitation cover (RESOLVED)

## The bug
A thin egg-shaped oval ring painted across the white invitation cover,
top at the swans crest, bottom crossing over the gold wax seal, with a
soft shadow along its right edge. No DOM element accounted for it:
`elementsFromPoint` returned only containers and an SVG `getBBox()`
sweep found nothing oval-sized.

## Root cause
`button.wax-seal::before` — the seal's absolutely-positioned inner
highlight ring (`inset: 7px`, organic percentage border-radius
`47% 53% 48% 52% / 51% 47% 53% 49%`, thin pale border).

The v14 cover rule set `.cover .wax-seal { position: static }` to put
the seal in normal flow. That removed the seal as the pseudo-element's
containing block, so `inset: 7px` resolved against the nearest
positioned ancestor — the entire `.cov-text` column (~241×404px). The
wax-blob percentage radius stretched over that tall box produced
exactly the egg-shaped hairline oval. The `::after` fire-water glow
(`inset: -16px`) was silently broken the same way.

Why the diagnostics missed it: pseudo-elements never appear in
`elementsFromPoint` (hits report the origin element — hence only
"containers"), and it isn't SVG, so the `getBBox` sweep was blind to
it. It painted above the seal because a pseudo paints with its origin
element's stacking position. Confirmed in real headless Chrome
(`--dump-dom` style audit showed the pseudo at 227×404px), so it was
never a preview-browser artifact.

## Fix (css/styles.css, both `.cover .wax-seal` rules)
`position: relative; left: auto; top: auto;` — keeps the seal in flow
while restoring it as the containing block for `::before`/`::after`.
The base `.wax-seal` rule's `left: 50%; top: 59%` must be neutralised
with `auto`, otherwise `relative` would shift the seal.

## Verified in real Chrome (headless, 430px and 1440px)
Oval gone at both widths; seal shows its correct inner ring; open
animation plays through to the presented inner card (locket, wreath
medallion, gift note); hero renders with corner sprays and
fire/water name marks.

## Lesson
When a phantom shape has no matching element, audit **pseudo-elements'
computed size/inset/radius** early — they're invisible to hit-testing
and element sweeps. And changing `position` on an element whose
pseudos use `inset` changes their containing block.
