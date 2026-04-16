---
status: awaiting_human_verify
trigger: "hero-demo-animation-flicker - layout shifts and flickering on small screens (<640px)"
created: 2026-04-15T00:00:00Z
updated: 2026-04-15T00:00:00Z
---

## Current Focus

hypothesis: The suggestions panel appearing/disappearing causes layout shifts because the outer container uses `h-auto min-h-[22rem]` instead of a fixed height, and the AnimatePresence mount/unmount changes the container's intrinsic height. Additionally, `layout` prop on DemoSuggestionRow triggers Framer Motion layout animations that cause visible reflows on small screens.
test: Check if reserving space for the panel (fixed height or CSS containment) and removing layout animations prevents shifts
expecting: Fixed container height prevents parent content from shifting; removing `layout` prop stops row-level reflows
next_action: Identify all layout-shifting elements and apply fix

## Symptoms

expected: The demo animation should look the same as desktop, just scaled down proportionally
actual: On phone screens (<640px), the animation causes layout shifts and flickering during typing animation, when autocomplete suggestions appear/disappear, and throughout the animation cycle
errors: No console errors - visual/layout issue
reproduction: View landing page hero section on phone-sized viewport (<640px) and watch demo animation cycle
started: Likely introduced or worsened by recent hero responsiveness changes (commit 9444085) with h-auto min-h-[22rem]

## Eliminated

## Evidence

- timestamp: 2026-04-15T00:01:00Z
  checked: hero.tsx AddressDemoInput component structure
  found: |
    1. Outer container (line 513) uses `h-auto min-h-[22rem]` - height grows/shrinks with content
    2. AnimatePresence (line 542) conditionally mounts/unmounts the suggestions panel
    3. When panel appears, container height jumps from ~input-only to ~input+panel
    4. When panel disappears, container height shrinks back
    5. DemoSuggestionRow (line 251) has `layout` prop - triggers Framer Motion layout animations on every re-render
    6. The 3rd suggestion row is `hidden md:flex` (line 248) - on mobile only 2 rows show, but container still resizes
    7. Motion wrapper around panel (line 544-562) animates opacity+y but the mount/unmount itself causes height change
  implication: Multiple sources of layout shift - container height not reserved, panel mount/unmount, and layout prop on rows

## Resolution

root_cause: Three compounding layout-shift sources on mobile -- (1) outer container used `h-auto min-h-[22rem]` so its height changed every time the suggestions panel mounted/unmounted, (2) the suggestions panel was in normal document flow so its appearance pushed sibling content down, (3) DemoSuggestionRow had a Framer Motion `layout` prop causing layout recalculations on every animation tick
fix: |
  1. Changed outer container from `h-auto min-h-[22rem]` to fixed `h-[22rem]` (md: `h-[24rem]`) so height never changes
  2. Made suggestions panel absolutely positioned (`absolute inset-x-0 top-3`) inside a relative wrapper so it overlays without affecting document flow
  3. Removed `layout` prop from DemoSuggestionRow to prevent Framer Motion layout thrashing
verification: Lint passes clean. Visual verification on mobile viewport needed.
files_changed:
  - apps/web/src/components/shadcn-space/blocks/hero-15/hero.tsx
