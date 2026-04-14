---
phase: quick
plan: 260414-ght
subsystem: ui
tags: [tailwind, framer-motion, hero, layout]

requires: []
provides:
  - "Demo-centric hero layout with address autocomplete as focal point"
affects: []

tech-stack:
  added: []
  patterns:
    - "Demo-first hero layout: supporting headline + prominent interactive demo"

key-files:
  created: []
  modified:
    - apps/web/src/components/shadcn-space/blocks/hero-15/hero.tsx

key-decisions:
  - "Reduced heading scale to text-3xl/5xl to let the demo dominate visually"
  - "Used min-h-fit instead of fixed min-height so section sizes to content"

patterns-established: []

requirements-completed: []

duration: 2min
completed: 2026-04-14
---

# Quick Task 260414-ght: Realign Hero Section Layout Summary

**Restructured hero to center the animated address autocomplete demo as the visual focal point with smaller heading, tighter spacing, and visible subtitle**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-14T01:55:28Z
- **Completed:** 2026-04-14T01:57:07Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Reduced h1 from text-4xl/8xl to text-3xl/5xl so headline supports rather than dominates
- Tightened outer container gap and switched to min-h-fit for natural content sizing
- Added vertical breathing room (py-4 md:py-8) around the demo wrapper
- Uncommented and shortened subtitle to punchy two-sentence copy

## Task Commits

Each task was committed atomically:

1. **Task 1: Restructure hero layout to center the address demo** - `b9d5b16` (feat)

## Files Created/Modified
- `apps/web/src/components/shadcn-space/blocks/hero-15/hero.tsx` - Hero section with demo-centric layout, smaller heading, visible subtitle, tighter spacing

## Decisions Made
- Reduced heading to text-3xl/5xl (plan suggested approximate sizing) to clearly subordinate it to the demo
- Used min-h-fit to let the section size naturally rather than forcing a tall minimum height
- Kept subtitle concise at two sentences for immediate comprehension

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript error in hero.tsx (line 537, `useReducedMotion` returns `boolean | null`) - out of scope per deviation rules, not introduced by this change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Hero layout complete, ready for visual verification
- No blockers

---
*Quick task: 260414-ght*
*Completed: 2026-04-14*
