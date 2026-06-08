# Wherabouts.com — Competitive Reassessment (Post-SDK-Hardening Update)

**Date:** 2026-06-08
**Updates:** [`competitive-analysis-2026-06.md`](./competitive-analysis-2026-06.md) (2026-06-07 baseline)
**Trigger:** The TypeScript SDK moved from *addresses-only, work-in-progress* to
**full 22-method coverage (Phase 0) + publishable & hardened (Phase 1)** this cycle.
This re-scores the same feature framework — only the developer-surface dimensions
moved; the competitor set and capability rows are unchanged.

---

## 1. What changed since the 2026-06-07 baseline

The prior report's §6 ranked the gaps: **P1 client/mobile SDKs**, **P2 routing**,
**P3 finish & publish the TypeScript SDK (then Python)**. This cycle closed most of **P3**:

- **Full endpoint coverage** — the SDK now spans all six resource namespaces
  (`addresses`, `geocode`, `zones`, `devices`, `webhooks`, `regions`), not just addresses.
- **Publishable package** — renamed to the npm-legal `@wherabouts/sdk`, dual **ESM+CJS**
  with bundled types, `publint` + `are-the-types-wrong` clean. *(Actual `npm publish`
  still pending an org + token + license — so "shipped as code," not yet "on the registry.")*
- **Production-grade hardening** — automatic retries with backoff/jitter, `Retry-After`,
  per-request timeouts + `AbortSignal`, idempotent writes, and typed errors carrying
  `requestId`/`docUrl`/`fields`.

What did **not** change: no client/mobile SDKs (P1), no routing (P2), no Python SDK,
no places/POI, no address validation. The strategic picture is the same; the
**developer-surface gap narrowed materially.**

---

## 2. Developer-surface delta

| Dimension | 2026-06-07 baseline | Now (2026-06-08) |
|---|---|---|
| TS server SDK coverage | addresses-only, WIP | **Full (22 methods)** |
| Packaging / installability | private, raw source | **Publishable (ESM+CJS+types), publish pending** |
| SDK resilience (retries/timeouts) | none | **Built-in** |
| Idempotent writes | none | **Auto `Idempotency-Key`** |
| Typed errors w/ correlation id | basic (code+message) | **`requestId`/`docUrl`/`fields`** |
| Python SDK | none | none (unchanged) |
| Client / mobile SDKs | none | none (unchanged) |

---

## 3. Updated feature matrix

Legend: ✅ strong/native · ⚠️ partial/indirect · ❌ absent · 🔼 improved since baseline

| Capability | Wherabouts | Radar | Mappify | Google | HERE | Geoapify |
|---|---|---|---|---|---|---|
| Forward/reverse geocoding | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Autocomplete | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Batch geocoding | ✅ | ⚠️ | ✅ | ⚠️ | ✅ | ✅ |
| Nearby / radius search | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| Admin-boundary classification | ✅ (ASGS) | ✅ | ✅ | ⚠️ | ✅ | ⚠️ |
| Custom geofencing (zones) | ✅ | ✅ | ❌ | ❌ | ⚠️ | ❌ |
| Device location tracking | ✅ (server) | ✅ (SDK) | ❌ | ⚠️ | ✅ | ❌ |
| Real-time geofence events / webhooks | ✅ | ✅ | ❌ | ❌ | ⚠️ | ❌ |
| Routing / directions / matrix | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Places / POI dataset | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Address validation/standardisation | ❌ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ |
| IP geolocation | ❌ | ✅ | ❌ | ✅ | ⚠️ | ✅ |
| Isolines / reachability | ❌ | ⚠️ | ❌ | ⚠️ | ✅ | ✅ |
| Fraud / spoof detection | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Client / mobile SDKs | ❌ | ✅ | ❌ | ✅ | ✅ | ⚠️ |
| **Server SDK(s)** | **🔼 ✅ (TS, full+hardened; npm pending)** | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| **SDK resilience (retry/idempotency/typed errors)** | **🔼 ✅** | ✅ | n/a (SDK-light) | ⚠️ | ⚠️ | ⚠️ |
| Prebuilt integrations marketplace | ❌ | ✅ | ❌ | ⚠️ | ✅ | ❌ |
| Self-hosted/base maps | ✅ (Protomaps) | ✅ | ❌ | ✅ | ✅ | ✅ |
| AU-authoritative data (G-NAF/ABS) | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Global coverage | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |

**Changes from baseline:** *Server SDK(s)* ⚠️→✅ (with publish caveat); added an explicit
**SDK resilience** row — a depth dimension the original presence/absence matrix didn't capture,
where Wherabouts now matches Radar and *exceeds* the geocoding-only players whose SDKs are thin
wrappers.

---

## 4. SDK depth — the new competitive surface

The original matrix scored SDK *presence*. Post-hardening, the more honest comparison is
*quality*, which is where buyers actually feel friction:

| SDK quality trait | Wherabouts | Radar | Google (services-js) | Mappify/Geoapify |
|---|---|---|---|---|
| Resource-namespaced surface | ✅ | ✅ | ⚠️ | ⚠️ |
| Auto-retry + backoff | ✅ | ✅ | ✅ | ❌ |
| Idempotent writes | ✅ | n/a | n/a | ❌ |
| Typed errors + request id | ✅ | ✅ | ⚠️ | ❌ |
| Dual ESM+CJS + shipped types | ✅ | ✅ | ✅ | ⚠️ |
| Installable from npm today | ⚠️ (pending) | ✅ | ✅ | ✅ |

**Read:** on *server-SDK ergonomics* Wherabouts now sits at parity with Radar and ahead of the
AU/open-data geocoders — a credible "Stripe-grade server SDK for AU location data" claim, **once
it's actually on npm.** The publish step is now the gating item, not the engineering.

---

## 5. Updated positioning

The quadrant thesis is unchanged — **AU-authoritative data × full geofencing/real-time
platform** remains uncontested. What shifted is the *credibility of the developer story within
that quadrant*: the server-side buyer (data/geocoding/backend integrations) can now adopt a
typed, resilient SDK rather than hand-rolling fetch calls. That is the segment Wherabouts can
win **today, without mobile SDKs** — and the baseline report named it as exactly the cheap,
high-leverage move. It is now largely executed on the engineering side.

The ceiling is also unchanged: the **client/mobile SDK gap (Radar's moat)** still caps the
consumer-app/mobile-geofencing segment, and remains the single most strategic investment.

---

## 6. Re-prioritised gaps

**P0 (new, trivial, blocking value) — actually publish the SDK.** The package is built,
hardened, and verified; it is *not yet installable* (`@wherabouts` npm org + token + a license
decision; currently `UNLICENSED`). Until it's on npm, none of the Phase 1 value reaches a buyer.
This is now the highest-ROI action in the whole roadmap — hours, not weeks.

**P1 — Client/mobile SDKs (unchanged).** Still the defining gap vs Radar; multi-quarter; own
milestone.

**P2 — Routing (unchanged).** Mappify parity; table stakes for logistics buyers; medium effort.

**P3 — Server-side DX completion.** (a) **Phase 2 API-side DX** (error envelope, rate-limit
headers, idempotency *enforcement*) — the SDK is already forward-compatible and *sends* the
signals; the server must *emit/enforce* them to realise the resilience story end-to-end.
(b) **Python SDK** — the remaining half of baseline P3, mirroring the now-proven namespaced
surface.

**P4 — Places/POI + address validation (unchanged).**

**Defend now (unchanged):** lead with G-NAF + ABS authority and all-in-one AU geofencing; price
transparently in AUD against Mappify; and **now add "typed, resilient official SDK" to the
developer-self-serve pitch** — a concrete, demonstrable edge over Mappify/Geoapify the moment the
package is published.

---

## 7. Bottom line

The baseline's verdict holds — Wherabouts is the only AU-authoritative + real-time-geofencing
player — but the **developer surface is no longer a soft spot on the server side.** This cycle
converted the most-cited "SDK is WIP" gap into a publishable, Radar-grade server SDK. The
competitive needle now turns on one cheap action (**publish it**) and one expensive one (**client
SDKs**). Ship the former this week; scope the latter as its own milestone.
