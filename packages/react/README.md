# @wherabouts/react

React hooks for the [Wherabouts](https://wherabouts.com) location API — address autocomplete, reverse geocoding, and geofence detection with built-in debouncing, cancellation, and loading/error state.

[![npm](https://img.shields.io/npm/v/@wherabouts/react)](https://www.npmjs.com/package/@wherabouts/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## Requirements

| Peer dependency    | Version  |
|--------------------|----------|
| `react`            | `>= 18`  |
| `@wherabouts/sdk`  | `>= 0.4.1` |

---

## Installation

```bash
# npm
npm install @wherabouts/react @wherabouts/sdk

# pnpm
pnpm add @wherabouts/react @wherabouts/sdk

# yarn
yarn add @wherabouts/react @wherabouts/sdk
```

---

## Quick start

All hooks accept a `WheraboutsClient` instance as their first argument. Create one with your publishable API key from the [Wherabouts dashboard](https://wherabouts.com/dashboard).

```ts
import { WheraboutsClient } from "@wherabouts/sdk";

const client = new WheraboutsClient({
  apiKey: "pk_live_...", // publishable key — safe in browser
});
```

> Use a **publishable key** (`pk_live_…`) in browser code. Secret keys must stay server-side only.

---

## Hooks

### `useAutocomplete`

Type-ahead address search with automatic debouncing and in-flight request cancellation.

```tsx
import { useAutocomplete } from "@wherabouts/react";

function AddressSearch({ client }) {
  const { query, setQuery, results, loading, error } = useAutocomplete(client, {
    debounceMs: 300, // default — waits 300ms after last keystroke
    limit: 5,        // max results to return
    country: "AU",   // optional ISO 3166-1 alpha-2 country filter
    state: "QLD",    // optional state/region filter
  });

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Start typing an address..."
      />
      {loading && <p>Searching…</p>}
      {error && <p>Error: {error.message}</p>}
      <ul>
        {results.map((r) => (
          <li key={r.id}>{r.formattedAddress}</li>
        ))}
      </ul>
    </div>
  );
}
```

#### Signature

```ts
function useAutocomplete(
  client: WheraboutsClient,
  options?: UseAutocompleteOptions
): UseAutocompleteResult
```

#### `UseAutocompleteOptions`

| Option        | Type     | Default | Description                                      |
|---------------|----------|---------|--------------------------------------------------|
| `debounceMs`  | `number` | `300`   | Milliseconds to wait after last keystroke        |
| `limit`       | `number` | —       | Maximum number of suggestions to return          |
| `country`     | `string` | —       | ISO 3166-1 alpha-2 country code filter (e.g. `"AU"`) |
| `state`       | `string` | —       | State or region name filter                      |

#### `UseAutocompleteResult`

| Field      | Type                   | Description                                       |
|------------|------------------------|---------------------------------------------------|
| `query`    | `string`               | Current search string                             |
| `setQuery` | `(q: string) => void`  | Stable setter — safe to pass directly to `onChange` |
| `results`  | `AddressSuggestion[]`  | Matching address suggestions                      |
| `loading`  | `boolean`              | `true` while a request is in flight               |
| `error`    | `Error \| null`        | Last error, or `null`                             |

**Behaviour notes:**
- Empty or whitespace-only query immediately clears results without firing a request.
- Each new keystroke cancels the previous pending request via `AbortController`.
- `setQuery` is memoised with `useCallback` — it will not cause unnecessary re-renders.

---

### `useReverseGeocode`

Resolves a latitude/longitude coordinate to the nearest address. Pass `null` to reset.

```tsx
import { useReverseGeocode } from "@wherabouts/react";

function NearestAddress({ client, userLocation }) {
  // userLocation: { lat: number; lng: number } | null
  const { address, distance, loading, error } = useReverseGeocode(client, userLocation);

  if (loading) return <p>Locating…</p>;
  if (error)   return <p>Error: {error.message}</p>;
  if (!address) return <p>No location set</p>;

  return (
    <div>
      <p>{address.formattedAddress}</p>
      <p>{distance != null ? `${distance.toFixed(0)}m away` : ""}</p>
    </div>
  );
}
```

#### Signature

```ts
function useReverseGeocode(
  client: WheraboutsClient,
  coords: LatLng | null
): UseReverseGeocodeResult
```

#### `LatLng`

```ts
interface LatLng {
  lat: number;
  lng: number;
}
```

#### `UseReverseGeocodeResult`

| Field      | Type                          | Description                                  |
|------------|-------------------------------|----------------------------------------------|
| `address`  | `ReverseGeocodeAddress \| null` | Nearest address, or `null` if not yet resolved |
| `distance` | `number \| null`              | Distance in metres from `coords` to `address` |
| `loading`  | `boolean`                     | `true` while a request is in flight          |
| `error`    | `Error \| null`               | Last error, or `null`                        |

**Behaviour notes:**
- Passing `null` as `coords` immediately resets `address` and `distance` to `null` without firing a request.
- The effect re-runs only when `coords.lat` or `coords.lng` changes — passing a new object reference with the same values does **not** re-fetch.
- In-flight requests are cancelled on unmount or when `coords` changes.

---

### `useZoneContains`

Returns all geofence zones that contain a given coordinate. Useful for entry/exit detection, location-gating, and proximity-based UI.

```tsx
import { useZoneContains } from "@wherabouts/react";

function ZoneStatus({ client, userLocation }) {
  const { zones, loading, error } = useZoneContains(client, userLocation);

  if (loading) return <p>Checking zones…</p>;
  if (error)   return <p>Error: {error.message}</p>;

  return (
    <div>
      {zones.length === 0 ? (
        <p>Not inside any zone</p>
      ) : (
        <ul>
          {zones.map((z) => (
            <li key={z.id}>{z.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

#### Signature

```ts
function useZoneContains(
  client: WheraboutsClient,
  coords: LatLng | null
): UseZoneContainsResult
```

#### `UseZoneContainsResult`

| Field     | Type              | Description                              |
|-----------|-------------------|------------------------------------------|
| `zones`   | `ZoneRecord[]`    | Zones that contain `coords`              |
| `loading` | `boolean`         | `true` while a request is in flight      |
| `error`   | `Error \| null`   | Last error, or `null`                    |

**Behaviour notes:**
- Passing `null` as `coords` immediately clears `zones` without firing a request.
- Same coordinate-stability semantics as `useReverseGeocode` — object identity is ignored, only `lat`/`lng` values matter.
- In-flight requests are cancelled on unmount or when `coords` changes.

---

## Using the browser Geolocation API

A common pattern — combine the browser's `navigator.geolocation` with these hooks:

```tsx
import { useState, useEffect } from "react";
import { useReverseGeocode, useZoneContains, type LatLng } from "@wherabouts/react";

function LocationAwareComponent({ client }) {
  const [coords, setCoords] = useState<LatLng | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      console.error,
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const { address } = useReverseGeocode(client, coords);
  const { zones }   = useZoneContains(client, coords);

  return (
    <div>
      <p>Address: {address?.formattedAddress ?? "Locating…"}</p>
      <p>Zones: {zones.map((z) => z.name).join(", ") || "None"}</p>
    </div>
  );
}
```

---

## TypeScript

All hooks and their option/result types are exported:

```ts
import type {
  LatLng,
  UseAutocompleteOptions,
  UseAutocompleteResult,
  UseReverseGeocodeResult,
  UseZoneContainsResult,
} from "@wherabouts/react";
```

The package ships with bundled type declarations (`.d.ts` and `.d.cts`) for both ESM and CJS consumers.

---

## Bundle formats

| Format | Entry                   | Use case              |
|--------|-------------------------|-----------------------|
| ESM    | `dist/index.js`         | Bundlers (Vite, Next) |
| CJS    | `dist/index.cjs`        | Node / Jest           |

---

## License

[MIT](./LICENSE) © Joseph Amani
