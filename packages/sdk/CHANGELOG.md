# Changelog

All notable changes to `@wherabouts/sdk` are documented here. This project adheres
to [Semantic Versioning](https://semver.org/) and the
[Keep a Changelog](https://keepachangelog.com/) format.

## [0.4.0] - 2026-06-15

### Added

- `GeocodeAddress` now includes `streetName`, `streetNumber`, `streetType` structured fields matching `AddressSuggestion`
- Added `logger` option to `WheraboutsClientConfig` — called after every request with method, path, status, durationMs, and requestId
- Added `zones.paginate()` async generator for cursor-free iteration over all zones (yields `ZoneRecord[]` per page)
- Exported `WebhookEntryPayload`, `WebhookExitPayload`, and `WebhookEventPayload` discriminated union for typing inbound webhook POST bodies

### Fixed

- `logger` now fires on error responses (4xx/5xx) as well as successful ones

## [0.2.0] - 2026-06-08

First publishable release. Renamed from the internal `@wherabouts.com/sdk`.

### Added

- **Full API coverage** — 22 methods across six resource namespaces
  (`addresses`, `geocode`, `zones`, `devices`, `webhooks`, `regions`),
  replacing the previous addresses-only surface.
- **Automatic retries** for transient failures (`408/425/429/5xx`, network errors,
  timeouts) with exponential backoff + full jitter; honours `Retry-After`.
- **Per-request timeouts** (`timeoutMs`, default 30s) and `AbortSignal` support.
- **Idempotent writes** — `POST`/`PUT` calls auto-attach an `Idempotency-Key`;
  override via per-call `options.idempotencyKey`.
- **Per-request `options`** on every method (`timeoutMs`, `maxRetries`, `signal`,
  `idempotencyKey`, `headers`).
- **Richer errors** — `WheraboutsApiError` now exposes `requestId`, `docUrl`, and
  `fields` (forward-compatible with the API's expanded error envelope).
- **Published build** — dual ESM + CJS with bundled `.d.ts`, verified by
  `publint` and `are-the-types-wrong`.

### Changed

- Package renamed `@wherabouts.com/sdk` → **`@wherabouts/sdk`** (npm scopes cannot
  contain a dot). No backward-compat alias — the prior version was unpublished.
- Client surface is now resource-namespaced (`client.zones.create(...)`), replacing
  the earlier flat methods.

[0.4.0]: https://github.com/amani-joseph/wherabouts.com/releases/tag/sdk-v0.4.0
[0.2.0]: https://github.com/amani-joseph/wherabouts.com/releases/tag/sdk-v0.2.0
