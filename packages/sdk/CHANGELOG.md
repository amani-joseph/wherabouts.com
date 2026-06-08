# Changelog

All notable changes to `@wherabouts/sdk` are documented here. This project adheres
to [Semantic Versioning](https://semver.org/) and the
[Keep a Changelog](https://keepachangelog.com/) format.

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

[0.2.0]: https://github.com/amani-joseph/wherabouts.com/releases/tag/sdk-v0.2.0
