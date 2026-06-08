# @wherabouts/sdk

Official TypeScript SDK for the [Wherabouts](https://wherabouts.com) location API —
Australian geocoding, geofencing zones, device tracking, and webhooks over
authoritative G‑NAF / ABS data.

- **Dependency-free** and runtime-agnostic (Node, edge, browser) — built on `fetch`.
- **Fully typed**, resource-namespaced surface (`client.zones.create(...)`).
- **Resilient by default**: automatic retries with backoff, per-request timeouts,
  `AbortSignal` support, and idempotent writes.

## Install

```sh
npm install @wherabouts/sdk
# or: pnpm add @wherabouts/sdk · yarn add @wherabouts/sdk
```

Requires Node.js 18+ (or any runtime with a global `fetch`).

## Quickstart (60 seconds)

```ts
import { createWheraboutsClient } from "@wherabouts/sdk";

const client = createWheraboutsClient({
  apiKey: process.env.WHERABOUTS_API_KEY!,
});

// Classify a coordinate into official ABS/ASGS regions
const regions = await client.regions.classify({
  lat: -37.8136,
  lng: 144.9631,
});

// Autocomplete an address
const { results } = await client.addresses.autocomplete({ q: "123 collins st" });

// Create a geofence zone
const zone = await client.zones.create({
  name: "Melbourne CBD depot",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [144.95, -37.82],
        [144.97, -37.82],
        [144.97, -37.8],
        [144.95, -37.8],
        [144.95, -37.82],
      ],
    ],
  },
});
```

## Resources

| Namespace | Methods |
|---|---|
| `client.addresses` | `autocomplete`, `getById`, `nearby`, `reverse` |
| `client.geocode` | `forward`, `batch.submit`, `batch.poll`, `batch.results` |
| `client.zones` | `create`, `list`, `get`, `update`, `delete`, `contains`, `addresses` |
| `client.devices` | `pushLocation`, `zones` |
| `client.webhooks` | `create`, `list`, `delete`, `reactivate` |
| `client.regions` | `classify` |

## Configuration

```ts
const client = createWheraboutsClient({
  apiKey: "wh_...",          // required
  baseUrl: "https://api.wherabouts.com", // optional override
  maxRetries: 2,              // optional, default 2
  timeoutMs: 30_000,          // optional, default 30s
  fetch: customFetch,         // optional fetch implementation
  headers: { "x-app": "..." } // optional default headers
});
```

| Option | Default | Description |
|---|---|---|
| `apiKey` | — | Your Wherabouts API key (`wh_...`). Required. |
| `baseUrl` | `https://api.wherabouts.com` | API origin override. |
| `maxRetries` | `2` | Automatic retries for transient failures (429/5xx/network/timeout). |
| `timeoutMs` | `30000` | Per-request timeout. |
| `fetch` | `globalThis.fetch` | Custom `fetch` implementation. |
| `headers` | — | Default headers added to every request. |

### Per-request options

Every method accepts an optional trailing `options` argument to override the client
defaults for a single call:

```ts
await client.addresses.autocomplete(
  { q: "123 collins st" },
  { timeoutMs: 5000, signal: AbortSignal.timeout(5000) }
);

// Writes auto-attach an Idempotency-Key; supply your own to dedupe explicitly:
await client.zones.create(zoneBody, { idempotencyKey: "order-42" });
```

## Resilience

- **Retries** transient failures (HTTP `408/425/429/500/502/503/504`, network errors,
  and timeouts) up to `maxRetries`, using exponential backoff with full jitter
  (200 ms base, 5 s cap). A `Retry-After` response header is honoured when present.
- **Idempotent writes**: `POST`/`PUT` calls automatically send an `Idempotency-Key`
  header so retries are safe. Pass `options.idempotencyKey` to control it.
- **Timeouts & cancellation**: each request times out after `timeoutMs`; pass
  `options.signal` to cancel a call yourself.

## Error handling

Failed requests reject with a `WheraboutsApiError`:

```ts
import { WheraboutsApiError } from "@wherabouts/sdk";

try {
  await client.zones.get(999);
} catch (err) {
  if (err instanceof WheraboutsApiError) {
    err.status;     // HTTP status (e.g. 404)
    err.code;       // machine code (e.g. "not_found")
    err.message;    // human-readable message
    err.requestId;  // correlation id for support, if provided
    err.docUrl;     // link to error docs, if provided
    err.fields;     // field-level validation detail, if provided
  }
}
```

## License

UNLICENSED — © Wherabouts. Contact the maintainers for usage terms.
