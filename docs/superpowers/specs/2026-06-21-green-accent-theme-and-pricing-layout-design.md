# Green-accent black/white theme + pricing layout fix

**Date:** 2026-06-21
**Status:** Approved (design)

## Goal

Unify the visual design on a black & white base with a single green accent
derived from the hero globe, replacing the current ad-hoc cyan, and apply green
app-wide (landing, pricing, docs, dashboard). Separately, fix the duplicate
`/pricing` route so the pricing page renders inside the shared `_public` layout.

## Decisions (from brainstorming)

1. **Green shade:** anchor to the globe's green hue family (globe base
   `[0.18, 0.42, 0.36]` ≈ `#2E6B5C`, a dark teal-green). Tune lightness/chroma to
   a vivid, accessible "electric" green for use as a UI accent.
2. **Intensity:** green is the **primary** color, app-wide (every primary button
   and CTA).
3. **Cyan:** replaced by green everywhere (hero CTAs and globe markers) — one
   accent color.
4. **Layout:** only fix pricing. Leave `index` (`/`) and `docs` (`/docs`) as-is
   (they own their shells).

## Part 1 — Color tokens

Edit `packages/ui/src/styles/globals.css` (the token file the web app imports via
`apps/web/src/index.css`). Backgrounds, cards, text, borders stay grayscale.
The web app runs hardcoded `dark` mode, so the dark values are what ship; light
values are updated too for parity / the component-library demos.

Green hue anchored at oklch hue **162** (green-teal, matching the globe):

| Token | Light (`:root`) | Dark (`.dark`) | Notes |
|-------|-----------------|----------------|-------|
| `--primary` | `oklch(0.52 0.13 162)` | `oklch(0.78 0.17 162)` | deep green (light) / electric green (dark) |
| `--primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | keep existing contrast model |
| `--ring` | `oklch(0.6 0.12 162)` | `oklch(0.7 0.15 162)` | focus rings reinforce accent |
| `--sidebar-primary` | `oklch(0.52 0.13 162)` | `oklch(0.78 0.17 162)` | active dashboard nav (was stray purple in dark) |
| `--sidebar-primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | |
| `--sidebar-ring` | `oklch(0.6 0.12 162)` | `oklch(0.7 0.15 162)` | |
| `--chart-1` | `oklch(0.72 0.17 162)` | `oklch(0.72 0.17 162)` | charts pick up the accent |

Final values will be nudged if a quick WCAG AA contrast check on
`--primary` / `--primary-foreground` fails (≥ 4.5:1 for text). `--chart-2..5`
left as the existing blue/purple ramp (complementary, out of scope).

## Part 2 — Replace cyan with green

- `apps/web/src/components/shadcn-space/blocks/hero-15/hero-globe.tsx`:
  `MARKER_COLOR [0.4, 0.91, 0.98]` (cyan) → a vivid green fraction matching the
  accent (~`[0.22, 0.94, 0.66]`). `BASE_COLOR` (globe's green) unchanged.
- `apps/web/src/components/shadcn-space/blocks/hero-15/hero.tsx`: hero CTA
  buttons currently styled cyan → use the `primary` (now green) variant.
- Sweep any remaining literal cyan in marketing blocks (hero-15 / related) and
  re-point to the accent.

## Part 3 — Pricing layout fix

- Delete `apps/web/src/routes/pricing.tsx` (byte-identical duplicate of
  `apps/web/src/routes/_public/pricing.tsx`). This removes the duplicate
  `/pricing` route. `/pricing` then renders inside `_public.tsx` (navbar +
  outlet), matching the already-moved legal pages (`privacy`, `security`,
  `terms`).
- `index` and `docs` unchanged.
- Rebuild to regenerate `routeTree.gen.ts`; confirm build passes.

## Verification

- `pnpm build` (web) succeeds; no duplicate-route error.
- `routeTree.gen.ts` lists `_public/pricing` and no top-level `pricing`.
- Visual spot-check: hero CTAs, globe markers, a dashboard primary button, and
  active sidebar item all read as the same green; backgrounds remain B/W.
- Contrast: primary button text meets WCAG AA.

## Commit hygiene

The worktree carries unrelated uncommitted changes. Stage **only** the files
touched by this work (the CSS tokens, hero/globe colors, pricing deletion).
Do not sweep in unrelated modified/untracked files.

## Out of scope

- Moving `index`/`docs` under `_public`.
- Reworking the full chart palette.
- Touching `react-ui` / `vue-ui` package tokens (separate published libraries).
