# wherabouts · Obsidian Brand Package

**Brand System 2026** — complete asset package for the wherabouts Locations API.

---

## Quick reference

| Colour | Hex | Use |
|--------|-----|-----|
| Void (brand black) | `#0C0C0C` | Primary background |
| White | `#FFFFFF` | Mark, type on dark |
| Silver | `#C8C8C8` | Destination pin, accent |
| Surface | `#161616` | Raised panels, cards |
| Overlay | `#222222` | Modals, dropdowns |
| Border | `#2C2C2C` | Dividers, outlines |
| Mist | `#5A5A5A` | Secondary / subdued text |

**Typeface:** JetBrains Mono (300 Light · 400 Regular · 500 Medium · 600 SemiBold)
**Brand guide:** `/brand.html`
**CSS tokens:** `/brand/tokens.css`

---

## File inventory

### SVG — Vector assets (scalable, lossless)

| File | Description | Background |
|------|-------------|------------|
| `logo.svg` | Primary stacked lockup — mark above wordmark | Dark |
| `logo-mark.svg` | Route W mark only, no wordmark | Dark |
| `logo-horizontal.svg` | Horizontal lockup — mark + rule + wordmark | Dark |
| `logo-wordmark.svg` | Wordmark only — no mark | Dark |
| `logo-inverted.svg` | Stacked lockup for light backgrounds | Light |
| `logo-mark-inverted.svg` | Mark only for light backgrounds | Light |
| `logo-wordmark-inverted.svg` | Wordmark only for light backgrounds | Light |
| `logo-monochrome.svg` | All-black — print, emboss, engraving | Light |
| `logo-monochrome-white.svg` | All-white — photographic / dark backgrounds | Dark |
| `favicon.svg` | Rounded-square app icon (simplified W route) | #0C0C0C |
| `apple-touch-icon.svg` | iOS home-screen icon (180 × 180) | #0C0C0C |
| `og-image.svg` | Open Graph / Twitter card (1200 × 630) | #0C0C0C |

> **Always use SVG where possible.** Reach for PNGs only when the target platform requires raster images.

---

### PNG — Raster exports (`/brand/png/`)

#### Favicon set
| File | Size | Use |
|------|------|-----|
| `favicon-16x16.png` | 16 × 16 | Browser tab (legacy) |
| `favicon-32x32.png` | 32 × 32 | Browser tab (retina) |
| `favicon-48x48.png` | 48 × 48 | Windows shortcut |
| `favicon-64x64.png` | 64 × 64 | General favicon |
| `favicon-96x96.png` | 96 × 96 | Android / Chrome shortcut |
| `favicon-192x192.png` | 192 × 192 | PWA icon (maskable) |
| `favicon-512x512.png` | 512 × 512 | PWA splash / store listing |

#### App / touch icons
| File | Size | Use |
|------|------|-----|
| `apple-touch-icon-180x180.png` | 180 × 180 | iOS home screen |

#### Logo — stacked (dark background)
| File | Width | Use |
|------|-------|-----|
| `logo-200.png` | 200 px | Emails, small embeds |
| `logo-400.png` | 400 px | Standard web use |
| `logo-800.png` | 800 px | Retina / 2× displays |

#### Logo — stacked (light / inverted)
| File | Width | Use |
|------|-------|-----|
| `logo-inverted-200.png` | 200 px | Light-bg emails, print |
| `logo-inverted-400.png` | 400 px | Light-bg web use |

#### Logo — horizontal lockup
| File | Width | Use |
|------|-------|-----|
| `logo-horizontal-310.png` | 310 px | Nav bars, headers |
| `logo-horizontal-620.png` | 620 px | Retina nav bars |

#### Mark only
| File | Width | Use |
|------|-------|-----|
| `logo-mark-64.png` | 64 px | Small avatars, inline |
| `logo-mark-128.png` | 128 px | Profile pictures |
| `logo-mark-256.png` | 256 px | High-res avatars |
| `logo-mark-512.png` | 512 px | App store, splash |
| `logo-mark-inverted-64.png` | 64 px | Light-bg avatar |
| `logo-mark-inverted-128.png` | 128 px | Light-bg profile |
| `logo-mark-inverted-256.png` | 256 px | Light-bg high-res |

#### Monochrome
| File | Width | Use |
|------|-------|-----|
| `logo-monochrome-256.png` | 256 px | Single-colour print (black) |
| `logo-monochrome-white-256.png` | 256 px | Single-colour print (white) |

#### Social / Open Graph
| File | Size | Use |
|------|------|-----|
| `og-image-1200x630.png` | 1200 × 630 | Twitter, LinkedIn, Facebook previews |

---

### Other assets

| File | Description |
|------|-------------|
| `tokens.css` | CSS custom properties — colours, spacing, typography, shadows, transitions |

---

## Usage rules

### ✓ Do
- Use the **primary dark lockup** (`logo.svg`) on all dark backgrounds (`#0C0C0C`, `#161616`)
- Use the **inverted lockup** (`logo-inverted.svg`) on white and light neutral backgrounds
- Maintain **clear space** equal to the height of the origin ring on all four sides of the mark
- Scale proportionally from the original SVG source files — never stretch or squish
- Use `favicon.svg` as the primary favicon; provide `favicon-32x32.png` as a fallback

### ✗ Don't
- Place the logo on coloured backgrounds without explicit brand approval
- Apply shadows, glows, gradients, or other effects to the mark
- Rearrange, recolour, or reconstruct the mark elements
- Use the logo at widths narrower than **80 px** (full lockup) or **32 px** (mark only)
- Modify the `stroke-dasharray` values — the pill-dash proportions are fixed

---

## Using tokens.css

```html
<!-- In your HTML <head> -->
<link rel="stylesheet" href="/brand/tokens.css">
```

```css
/* In your stylesheets */
.button {
  background: var(--whr-color-void);
  color: var(--whr-color-white);
  font-family: var(--whr-font-brand);
  border-radius: var(--whr-radius-md);
  transition: background var(--whr-transition-base);
}
```

---

## Favicon setup (HTML `<head>`)

```html
<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/brand/png/favicon-32x32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/brand/png/favicon-16x16.png" sizes="16x16" type="image/png">
<link rel="apple-touch-icon" href="/brand/png/apple-touch-icon-180x180.png">

<!-- PWA manifest -->
<!-- icons: favicon-192x192.png (purpose: any maskable), favicon-512x512.png -->

<!-- Open Graph -->
<meta property="og:image" content="https://wherabouts.com/brand/png/og-image-1200x630.png">
<meta name="twitter:image" content="https://wherabouts.com/brand/png/og-image-1200x630.png">
<meta name="twitter:card" content="summary_large_image">
```

---

*wherabouts.com · Obsidian Brand System · April 2026*
