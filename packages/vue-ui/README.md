# @wherabouts/vue-ui

Vue 3 components and helpers for the [Wherabouts](https://wherabouts.com) location API —
address autocomplete, forward/reverse geocoding inputs, and structured address form fields.
Built on [`@wherabouts/sdk`](https://www.npmjs.com/package/@wherabouts/sdk), styled with
Tailwind, and shipped with a prebuilt stylesheet so you can drop them in without any build
setup. This is the Vue counterpart to [`@wherabouts/react-ui`](../react-ui/README.md).

> **Coverage:** Authoritative Australian addresses (G-NAF). International coverage
> (US, parts of the EU, and more) is in **beta** and rolling out — availability may
> vary by deployment.

## Status

> **Early access (v0.1.0).** This package currently ships the shared **types** and
> **utilities** (`toAddressWithParsed`, `cn`) that back the components. The Vue 3 SFC
> components (`AddressAutocomplete`, `AddressFormField`, `ForwardGeocodeInput`,
> `ReverseGeocodeInput`, `AddressFieldGroup`) are **planned for Phase 2** and are not yet
> exported — see [`src/index.ts`](./src/index.ts). The API below documents the intended
> surface; check the [exports](#whats-available-today) section for what's usable right now.

## Requirements

- Vue **3.0+** (peer dependency)
- A Wherabouts API key (`wh_...`)

## Installation

```bash
# npm
npm install @wherabouts/vue-ui @wherabouts/sdk

# pnpm
pnpm add @wherabouts/vue-ui @wherabouts/sdk

# yarn
yarn add @wherabouts/vue-ui @wherabouts/sdk
```

Peer dependencies: `vue` (>=3.0.0) and `@wherabouts/sdk` (>=0.4.2).

Once the components ship, import the stylesheet once, near your app root:

```ts
import "@wherabouts/vue-ui/styles.css";
```

## What's available today

The package exports the building blocks the components share:

```ts
import {
  toAddressWithParsed,
  cn,
  type AddressWithParsed,
  type AddressI18nStrings,
  type AddressSuggestionInput,
} from "@wherabouts/vue-ui";
```

- **`toAddressWithParsed(suggestion)`** — maps a raw SDK `AddressSuggestion` into the
  flattened [`AddressWithParsed`](#types) shape the components use (`formattedAddress`,
  `latitude`, `longitude`, plus parsed `streetAddress` / `suburb` / `state` / `postcode` /
  `country`).
- **`cn(...classes)`** — the `clsx` + `tailwind-merge` class combiner used internally for
  composing Tailwind classes without conflicts.

### Types

| Type | Description |
|---|---|
| `AddressWithParsed` | Flattened address: `id`, `formattedAddress`, `latitude`, `longitude`, `streetAddress`, `suburb`, `state`, `postcode`, `country`. |
| `AddressI18nStrings` | Overridable UI strings: `noResults`, `enterManually`, `errorRetry`, `geolocationError`. |
| `AddressSuggestionInput` | Re-export of the SDK's `AddressSuggestion` (the input to `toAddressWithParsed`). |

## Quick start (Phase 2 — preview)

Each component will take a `client` created with the SDK. Create it once and share it.

```vue
<script setup lang="ts">
import { createWheraboutsClient } from "@wherabouts/sdk";
import { AddressAutocomplete } from "@wherabouts/vue-ui";
import "@wherabouts/vue-ui/styles.css";

const client = createWheraboutsClient({ apiKey: import.meta.env.VITE_WHERABOUTS_KEY });

function onSelect(address) {
  console.log(address.formattedAddress, address.latitude, address.longitude);
}
</script>

<template>
  <AddressAutocomplete
    :client="client"
    placeholder="Start typing an address…"
    @select="onSelect"
  />
</template>
```

> **Note:** Use a **publishable** key scoped to your origin for browser use. Never ship a
> secret server key to the client.

## Components (planned)

These mirror the React package's API and will land in Phase 2:

- **`AddressAutocomplete`** — debounced address search with an accessible (WAI-ARIA
  combobox) suggestion list, keyboard navigation, optional geolocation proximity bias, and
  customizable rendering.
- **`AddressFormField`** — `AddressAutocomplete` wrapped with a label and error styling for
  drop-in form use.
- **`ForwardGeocodeInput`** — resolves free-text address input to coordinates.
- **`ReverseGeocodeInput`** — resolves `latitude`/`longitude` to the nearest address.
- **`AddressFieldGroup`** — a controlled group of structured inputs (street, suburb, state,
  postcode) for editing a full address.

For the full prop and event reference today, see the
[`@wherabouts/react-ui` README](../react-ui/README.md) — the Vue components are designed to
match it (props as Vue props, callbacks surfaced as `@`-events).

## Development

```bash
pnpm --filter @wherabouts/vue-ui build   # vite build + prebuilt styles.css
pnpm --filter @wherabouts/vue-ui dev     # build in watch mode
pnpm --filter @wherabouts/vue-ui test    # vitest
```

## Styling

The package ships a prebuilt `styles.css` (import it once, as shown above). Components use
neutral design tokens and accept `class` for overrides.

## TypeScript

Ships dual ESM + CJS builds with bundled type declarations. All exports are fully typed.

## License

UNLICENSED — © Wherabouts. See the repository for usage terms.
