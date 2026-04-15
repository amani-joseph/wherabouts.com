---
phase: quick
plan: 260415-hwm
subsystem: ui
tags: [tailwind, responsive, mobile, hero-section]

requires: []
provides:
  - "Mobile-responsive hero section with proper viewport fitting"
affects: []

tech-stack:
  added: []
  patterns:
    - "Mobile-first responsive text sizing (text-lg -> sm:text-xl -> md:text-2xl)"
    - "Content-driven card height with min-h instead of fixed h"

key-files:
  created: []
  modified:
    - apps/web/src/components/shadcn-space/blocks/hero-15/hero.tsx

key-decisions:
  - "Used h-auto with min-h instead of fixed h-96 for address demo card to prevent content clipping on mobile"

patterns-established: []

requirements-completed: []

duration: 3min
completed: 2026-04-15
---

# Quick 260415-hwm: Fix Hero Section Responsiveness Summary

**Mobile-first responsive hero with content-driven card height, scaled text progression, and contained globe backdrop**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-15T02:55:44Z
- **Completed:** 2026-04-15T02:58:50Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Address demo card uses content-driven height (h-auto min-h) instead of fixed h-96
- H1 and subtitle text scale cleanly from mobile (text-lg/text-sm) through desktop (text-2xl/text-lg)
- Globe backdrop contained with overflow-hidden and reduced mobile height (h-[20rem])
- Main section uses lower min-h (70vh) and tighter gaps/padding on mobile

## Task Commits

1. **Task 1: Fix hero section mobile responsiveness** - `9444085` (fix)

## Files Created/Modified
- `apps/web/src/components/shadcn-space/blocks/hero-15/hero.tsx` - Responsive class updates for card, text, globe, and section container

## Decisions Made
- Used h-auto with min-h instead of fixed h-96 for the address demo card to allow content to determine height on mobile while maintaining minimum visual presence

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Known Stubs
None.

## User Setup Required
None - no external service configuration required.

---
*Quick task: 260415-hwm*
*Completed: 2026-04-15*
