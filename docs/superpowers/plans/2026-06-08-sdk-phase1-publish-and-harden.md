# SDK Phase 1 — Publish & Harden — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` (or
> `superpowers:subagent-driven-development`) to implement this task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking. Run `pnpm dlx ultracite fix` before each commit; commit per task.

**Goal:** Turn `@wherabouts.com/sdk` from an internal, raw-source, GET-only package into a
**published, versioned, resilient** npm SDK — the highest-leverage DX fix from the analysis. Two
halves: **(A) make it installable** (build pipeline, dual ESM+CJS + `.d.ts`, npm publish), and
**(B) make it production-safe** (retries/backoff, timeouts, `AbortSignal`, per-request options).

**Source analysis:** `docs/sdk-dx-analysis-and-plan-2026-06.md` §5 "Phase 1" + §6 quick wins.
**Wire contract (LOCKED):** `docs/CONTRACT.md` — authoritative for header names, retry policy,
idempotency, and the error envelope the SDK consumes. Do not diverge; changes go through that file.

**Architecture:** Keep the hand-written, dependency-free `fetch` client. Resilience is added to the
single generalized `request` helper in `src/http.ts` (introduced by Phase 0); resource modules are
untouched except to thread a per-call options arg. Build is a `tsup` config emitting `dist/`.

**Tech Stack:** TypeScript (ESM source), `tsup` (build, dev-dep only — no runtime deps added),
vitest, `publint` + `@arethetypeswrong/cli` for package-correctness checks.

---

## Decisions (locked)

- **Published name:** `@wherabouts/sdk` (the internal `@wherabouts.com/sdk` name has a dot in the
  scope and is **not a legal npm org name**). The workspace package is renamed to `@wherabouts/sdk`;
  all `workspace:*` references update accordingly.
- **Module formats:** dual **ESM + CJS**, both with `.d.ts`. `sideEffects: false`.
- **Build tool:** `tsup` (esbuild bundler + dts in one config). First build pipeline in the
  monorepo; `turbo.json` already declares a `build` task with `outputs: ["dist/**"]`.
- **Version:** bump to **`0.2.0`** (single source of truth; kills the `0.1.0` vs `0.1.0-preview`
  mismatch). First publish may be `0.2.0-preview.0` under the `next` dist-tag if a soak is wanted.
- **Retry defaults:** `maxRetries: 2`, exponential backoff with full jitter, base 200 ms, cap 5 s.
- **Idempotency plumbing** ships now (SDK sends `Idempotency-Key` on writes) but is **inert until
  Phase 2** adds server enforcement. Forward-compatible, no behavior change today.

---

## ⚠️ Hard dependency — Phase 0 must land first

This plan **edits `src/http.ts` and the resource factories created by the `sdk-completion` slice**
(`worktree-sdk-completion`, plan `2026-06-07-typescript-sdk-completion.md`). That slice is **not yet
merged to `master`** (no `src/http.ts` exists on master today). **Do not start Phase 1 until Phase 0
is merged.** If Phase 1 must proceed in parallel, branch from `worktree-sdk-completion`, not
`master`, and rebase when it lands.

**Working dir:** create a worktree off the post-Phase-0 base:
`superpowers:using-git-worktrees` → branch `worktree-sdk-phase1-publish-harden`.

---

## File structure (target)

```
packages/sdk/
  package.json          # MODIFIED: name, version, exports, files, publishConfig, scripts, devDeps
  tsup.config.ts        # NEW: dual ESM+CJS + dts
  tsconfig.json         # MODIFIED: ensure dts-compatible (see Task 2 risk note)
  README.md             # NEW: 60-second quickstart
  CHANGELOG.md          # NEW: 0.2.0 entry (Keep a Changelog format)
  .npmignore            # NEW (or files[] in package.json) — ship dist + README + LICENSE only
  src/
    http.ts             # MODIFIED: retries, backoff, timeout, signal, per-request options
    errors.ts           # MODIFIED: capture requestId from response header
    types.ts            # MODIFIED: RequestOptions type; version const → 0.2.0
    resources/*.ts      # MODIFIED: each method accepts optional RequestOptions, threaded to request
    http.test.ts        # NEW: retry/backoff/timeout/abort/idempotency tests
```

---

## Task 1: Package metadata for publish

Make the package npm-publishable without yet building.

- [ ] Rename `name` → `@wherabouts/sdk`; remove `"private": true`.
- [ ] Set `"version": "0.2.0"`.
- [ ] Add `"publishConfig": { "access": "public", "provenance": true }`.
- [ ] Add dual-format `exports` map, plus legacy `main`/`module`/`types`:
  ```jsonc
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist", "README.md", "CHANGELOG.md", "LICENSE"],
  "sideEffects": false,
  "engines": { "node": ">=18" }
  ```
- [ ] Add `license`, `repository`, `homepage`, `keywords` (geocoding, geofencing, australia, g-naf).
- [ ] Update every `@wherabouts.com/sdk` reference in the repo to `@wherabouts/sdk`
      (`grep -rl "@wherabouts.com/sdk"` — at minimum `apps/web` docs-page + sdk-snippet, the
      api-explorer, and any tsconfig path). Internal consumers keep `workspace:*`.
- [ ] Bump `WHERABOUTS_SDK_VERSION` in `types.ts` → `"0.2.0"`; assert it equals `package.json`
      `version` in a test (anti-drift).

**Acceptance:** `pnpm -F @wherabouts/sdk exec npm pkg get name version` shows the new name/version;
no stray `@wherabouts.com/sdk` references remain; `pnpm install` reconciles the workspace.

## Task 2: Build pipeline (`tsup`)

- [ ] Add dev-deps: `tsup`, `publint`, `@arethetypeswrong/cli`.
- [ ] `tsup.config.ts`: `entry: ["src/index.ts"]`, `format: ["esm","cjs"]`, `dts: true`,
      `sourcemap: true`, `clean: true`, `treeshake: true`, `target: "node18"`, `outExtension`
      → `.js` (esm) / `.cjs` (cjs).
- [ ] Scripts: `"build": "tsup"`, `"check-types": "tsc --noEmit"`,
      `"lint:pkg": "publint && attw --pack"`, `"prepublishOnly": "pnpm build && pnpm lint:pkg"`.
- [ ] Confirm `turbo build` picks it up (root already wires `build` → `dist/**` outputs).

**⚠️ Risk — `.ts` import specifiers vs `.d.ts` emit.** The source uses extensioned specifiers
(`import { x } from "./client.ts"`). esbuild bundles these fine for JS, but **dts generation may
choke**. Mitigate in this order: (1) let `tsup`'s bundled dts resolve them (usually works); if not,
(2) enable TS 5.7 `rewriteRelativeImportExtensions` in `tsconfig.json`; if not, (3) drop the `.ts`
extensions from relative import specifiers across `src/`. Pick the first that produces clean
`dist/index.d.ts`.

**Acceptance:** `pnpm -F @wherabouts/sdk build` emits `dist/index.js`, `dist/index.cjs`,
`dist/index.d.ts` (+ maps). `publint` and `attw --pack` both pass (no false ESM/CJS or types
resolution errors). `npm pack --dry-run` shows only `dist` + docs + LICENSE.

## Task 3: Resilience layer in `http.ts`

Generalize the `Requester` (from Phase 0) to be resilient. Add to `WheraboutsClientConfig`:
`maxRetries?` (default 2), `timeoutMs?` (default 30_000), and per-call overrides.

- [ ] **Timeout + abort:** wrap each attempt in an `AbortController`; abort after `timeoutMs`.
      If the caller passes a `signal`, compose it (`AbortSignal.any([callerSignal, timeoutSignal])`)
      so either aborts; surface caller-abort as the caller's reason, timeout as a
      `WheraboutsApiError({ code: "timeout" })` (or a dedicated `WheraboutsTimeoutError`).
- [ ] **Retry policy:** retry only safe-to-retry conditions — network/`fetch` throw, and statuses
      `408, 425, 429, 500, 502, 503, 504`. **Never retry other 4xx.** GET/DELETE/PUT are idempotent;
      POST is retried only when an `Idempotency-Key` is present (so retries are safe).
- [ ] **Backoff:** exponential with full jitter (`base=200ms`, `cap=5s`); on `429`/`503` honour a
      `Retry-After` header (seconds or HTTP-date) when present, capped at `cap`.
- [ ] Stop after `maxRetries`; throw the last `WheraboutsApiError`/network error.

**Acceptance:** unit-tested (Task 6). No new runtime dependency. `AbortSignal.any` is Node 18.17+/
modern-runtime safe — guard with a fallback if `any` is absent.

## Task 4: Per-request options + idempotency

- [ ] Add `RequestOptions = { timeoutMs?, signal?, maxRetries?, idempotencyKey?, headers? }` to
      `types.ts`; add an optional trailing `options?: RequestOptions` param to **every** resource
      method; thread into `request`.
- [ ] Per-call `headers` merge over (don't replace) client headers; per-call `timeoutMs`/`maxRetries`
      override config.
- [ ] **Writes** (`zones.create`, `zones.update`, `webhooks.create`, `devices.pushLocation`,
      `geocode.batch.submit`): if no `idempotencyKey` supplied, auto-generate
      (`crypto.randomUUID()`) and send as `Idempotency-Key`. Document that server enforcement
      arrives in Phase 2 (inert until then).

**Acceptance:** types compile; a write call with a captured mock fetch shows the `Idempotency-Key`
header; a per-call `timeoutMs` overrides the client default.

## Task 5: Surface `requestId` on errors

- [ ] In `parseApiError`, read `x-request-id` (and `x-wherabouts-request-id` fallback) from the
      response and set `WheraboutsApiError.requestId` (optional, `undefined` if absent — safe before
      Phase 2 emits it). Add `requestId` to the error class + `index.ts` export.

**Acceptance:** mock a response with the header → thrown error carries `requestId`; without it →
`undefined`, no throw.

## Task 6: Tests (vitest, mock fetch)

- [ ] `http.test.ts`: (a) network-throw then success within `maxRetries` resolves; (b) exhausts
      retries → throws; (c) `429` with `Retry-After: 1` waits ~1 s (fake timers) then retries;
      (d) `400`/`404` → **no** retry; (e) `timeoutMs` aborts a hung fetch → timeout error;
      (f) caller `signal.abort()` aborts mid-flight; (g) write sends auto `Idempotency-Key`;
      (h) `requestId` surfaced from header.
- [ ] Use `vi.useFakeTimers()` for backoff; do not sleep real time. No live server, no env vars.
- [ ] **Build-consumption smoke test:** after `build`, a tiny script `require()`s `dist/index.cjs`
      and `import()`s `dist/index.js` and asserts `createWheraboutsClient` is callable (run in CI
      step, not vitest, to validate both formats resolve).

**Acceptance:** `pnpm -F @wherabouts/sdk test` green; coverage includes every branch of the retry
decision.

## Task 7: Docs — README + CHANGELOG

- [ ] `README.md`: badges, one-paragraph what/why, **60-second quickstart** (install →
      `createWheraboutsClient({ apiKey })` → `await client.regions.classify({lat,lng})`), config
      table (`apiKey`, `baseUrl`, `maxRetries`, `timeoutMs`, `fetch`), error-handling example
      (`instanceof WheraboutsApiError`, `.code`, `.status`, `.requestId`), and a retries/timeout note.
- [ ] `CHANGELOG.md` (Keep a Changelog): `0.2.0` — full endpoint coverage (from Phase 0), retries,
      timeouts, per-request options, published to npm, renamed scope.

**Acceptance:** install snippet uses `@wherabouts/sdk`; every documented option exists in
`WheraboutsClientConfig`/`RequestOptions`.

## Task 8: Release path (manual first, CI after)

- [ ] **First release manual & deliberate:** `pnpm -F @wherabouts/sdk publish --dry-run`, review the
      tarball, then publish (`--tag next` for the preview, or latest for `0.2.0`). Requires the
      `@wherabouts` npm org to exist and a publish token — **flag to the user; needs org access.**
- [ ] **CI workflow** (`.github/workflows/release-sdk.yml`): on tag `sdk-v*`, `pnpm build` +
      `publint`/`attw` gate + `npm publish --provenance`. Optional in this slice — manual publish is
      acceptable for `0.2.0`; wire CI before `1.0.0`.

**Acceptance:** dry-run tarball contains only built artifacts; a clean external project can
`npm i @wherabouts/sdk` and call an endpoint against staging.

## Task 9: Verification & self-review

- [ ] `pnpm -F @wherabouts/sdk build && pnpm -F @wherabouts/sdk test && pnpm check-types` all green.
- [ ] `publint` + `attw --pack` clean.
- [ ] `grep -r "@wherabouts.com/sdk"` returns nothing (rename complete).
- [ ] Version constant === package version.
- [ ] Update `docs/sdk-dx-analysis-and-plan-2026-06.md` §5 to mark Phase 1 items done.

---

## Out of scope (later phases)
- API-side error envelope, rate-limit headers, **idempotency enforcement** (Phase 2 — SDK only
  *sends* the key here).
- Auto-pagination async iterators, generated-from-spec types, Python/browser/mobile SDKs (Phase 4).
- OpenAPI-driven docs site (Phase 3).

## Risks & notes
- **Phase 0 dependency** is the biggest scheduling risk — see the hard-dependency section.
- **`.ts` specifier dts emit** (Task 2 risk) is the likeliest technical snag; mitigation ladder
  provided.
- **npm org `@wherabouts`** must be created and access granted before Task 8 — surface to the user
  early; it gates the only externally-visible outcome of the slice.
- **`AbortSignal.any` / `AbortSignal.timeout`** availability — guard for older runtimes if the SDK
  targets pre-18.17 Node.
