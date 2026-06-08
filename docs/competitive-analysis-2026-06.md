# Wherabouts.com — Competitive Assessment Report

**Date:** 2026-06-07
**Prepared for:** product/strategy review
**Scope:** Feature & market comparison of wherabouts.com against 5 competitors —
Radar, Mappify, Google Maps Platform, HERE Technologies, and Geoapify.

---

## 1. Executive summary

Wherabouts.com occupies a **genuinely uncontested niche**: *authoritative
Australian location data (G-NAF + ABS ASGS) combined with a real-time geofencing /
device / webhook stack.* No single competitor sits in exactly that square:

- **Mappify** owns AU geocoding but has **no geofencing, devices, or webhooks.**
- **Radar** owns geofencing + device tracking but is global/generic, a large funded
  company, and not built on Australian authoritative data.
- **Google / HERE / Geoapify** are global geocoding/maps platforms; geofencing is
  weak, SDK-side, or absent, and none specialise in G-NAF/ABS.

The strategic one-liner the product can credibly own is **"Radar for Australia,
built on authoritative government data."**

The three biggest competitive gaps, in priority order, are: **(1) no client / mobile
SDKs** (Radar's core moat), **(2) no routing** (table-stakes for Mappify parity), and
**(3) no places/POI dataset.** A recently-shipped **region/boundary classification**
endpoint (ASGS) closed the most-cited prior gap and now matches Radar "Regions" and
Mappify "area lookups."

---

## 2. Wherabouts.com feature inventory (as of this review)

**Shipped / in active development:**
- **Geocoding:** autocomplete, forward geocode, reverse geocode, nearby search,
  address-by-ID — over G-NAF.
- **Batch geocoding:** async job submit / poll / results.
- **Zones (custom geofencing):** polygon CRUD, point-in-zone (`contains`),
  addresses-in-zone — PostGIS `ST_Covers`.
- **Devices:** location push, device-in-zone resolution.
- **Real-time events:** boundary crossings + webhook delivery (create/list/delete/
  reactivate).
- **Regions / boundary classification (new):** coordinate → official ABS/ASGS units
  (state, SA1–SA4, LGA, postcode/POA, Commonwealth & State electoral divisions, mesh
  block).
- **Platform:** API explorer, projects/teams, analytics, billing, dashboard,
  self-hosted Protomaps basemap.
- **Developer surface:** OpenAPI 3.1 spec; a **TypeScript server SDK** (being
  extended from addresses-only to full coverage — resource-namespaced, hand-written).

**Data foundation:** G-NAF (Geoscape, authoritative AU address file) + ABS ASGS
boundaries — both open/government data. **Geographic scope: Australia only.**

**Not present:** client/mobile SDKs, routing/directions/distance-matrix, places/POI
dataset, IP geolocation, postal address validation/standardisation, fraud/spoof
detection, prebuilt integrations (Segment/Braze/etc.), trip tracking/ETAs.

---

## 3. Competitor profiles

### 3.1 Radar (radar.com) — the closest strategic competitor
Full-stack location infrastructure. **Geofencing Platform:** geofences, trips
(tracking + live ETAs + arrival detection), places (POI visit detection), regions
(admin-boundary detection), beacons, fraud (GPS spoof/VPN/tamper), campaigns
(location messaging). **Maps Platform:** geocoding, search/autocomplete + address
validation, routing (distance/matrix/route-matching), base maps, static maps.
**Developer surface (its moat):** native SDKs for iOS, Android, React Native,
Flutter, Capacitor, Cordova, Web; ~30 prebuilt integrations (Segment, Braze,
Amplitude, mParticle, AWS, Salesforce…). Global, hundreds of millions of devices.
**Overlap with wherabouts:** very high on geofencing/devices/webhooks — but wherabouts
matches the *engine*, not the *breadth*.

### 3.2 Mappify (mappify.io) — the closest AU competitor
AU-only geocoding + routing on G-NAF. Forward/reverse geocode, **area lookups**
(LGA / postcode / ABS SA units), road distances (driveStats), directions, spreadsheet
paste-to-geocode UI; "DIY spatial analytics" (heatmaps, matrices) marked *coming
soon*. Pricing: **2,500 free requests/day, then ~$1/1,000; $1,000/mo unlimited**, AUD,
no contracts. **Gap vs wherabouts:** no geofencing, no device tracking, no webhooks,
no real-time eventing. Effectively "wherabouts minus the geofencing stack, plus
routing."

### 3.3 Google Maps Platform — the incumbent gorilla
Geocoding, Places, autocomplete, geolocation (cell/WiFi), **Address Validation Pro**,
Routes, Time Zone, plus new agentic/MCP grounding. Subscription tiers (Starter $100,
Essentials $275/mo) + PAYG; global, deepest POI dataset, strongest brand. **Weakness
relative to wherabouts:** no managed geofencing-as-a-service product; generic global
address data (not G-NAF-authoritative for AU edge cases like rural/unit addressing);
cost and complexity at scale.

### 3.4 HERE Technologies — the enterprise platform
Location *data* platform: maps + data (200 countries, 1,000+ attributes), geocoding,
routing, positioning/tracking, low-code/no-code tooling, a data marketplace.
Enterprise/fleet/logistics oriented, heavyweight onboarding. **Relative to
wherabouts:** strong on tracking/routing/data breadth; not developer-self-serve
friendly, not AU-specialised, geofencing aimed at fleet rather than app developers.

### 3.5 Geoapify — the developer-friendly open-data player
Open-data (OSM, GeoNames, OpenAddresses, GTFS) APIs: geocoding/autocomplete,
maps/tiles, routing, **isolines/reachability**, places/POI, postcode API. Generous
commercial free tier, transparent pricing, indie-developer friendly — the closest
*positioning* analogue to wherabouts' likely go-to-market. **Gap:** no geofencing,
device tracking, or webhooks; global open data rather than AU-authoritative.

---

## 4. Feature matrix

Legend: ✅ strong / native · ⚠️ partial or indirect · ❌ absent

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
| Server SDK(s) | ⚠️ (TS, WIP) | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| Prebuilt integrations marketplace | ❌ | ✅ | ❌ | ⚠️ | ✅ | ❌ |
| Self-hosted/base maps | ✅ (Protomaps) | ✅ | ❌ | ✅ | ✅ | ✅ |
| AU-authoritative data (G-NAF/ABS) | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Global coverage | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |

---

## 5. Positioning analysis

**Two axes define the market:** *(x) data scope — AU-authoritative ↔ global-generic*
and *(y) capability — pure geocoding ↔ full geofencing/real-time platform.*

- **Mappify** sits AU-authoritative but low on the capability axis (geocoding/routing
  only).
- **Radar** sits high-capability but global-generic.
- **Google / HERE / Geoapify** cluster global-generic, mid-to-high capability.
- **Wherabouts is the only player in the AU-authoritative + high-capability quadrant.**

That quadrant is defensible because the two moats compound: the **G-NAF/ABS data
authority** is hard for global players to care about, and the **geofencing/device/
webhook engine** is hard for Mappify-class geocoders to build. Owning both is the
strategy.

**Risks to the position:**
- **Radar could enter AU** with localised data and instantly out-feature wherabouts on
  SDKs/POI/routing. Speed to entrench the AU-data moat matters.
- **Mappify could add geofencing** — lower likelihood (different architecture) but it
  is the most direct flanking move.
- **Single-market ceiling:** AU-only caps TAM. The data-authority moat doesn't
  translate to other geographies without equivalent national datasets.

---

## 6. Gap assessment & recommendations

**Priority 1 — Client/mobile SDKs (closes Radar's core moat).**
Radar's defensibility is a drop-in iOS/Android/RN SDK handling background location,
battery, permissions, and on-device geofence evaluation. Wherabouts is API-only
(server pushes device locations). Without a client SDK, wherabouts cannot win
consumer-app/mobile use cases — the highest-value geofencing segment. *This is the
single most strategic investment.* (Large, multi-quarter native effort — scope as its
own milestone.)

**Priority 2 — Routing layer (Mappify parity).**
Distance/driveStats + directions (and later a matrix). Mappify's entire second pillar;
table stakes for logistics/delivery buyers. Fits the existing PostGIS/OSM-capable
stack. Medium effort.

**Priority 3 — Finish & publish the TypeScript SDK, then add Python.**
Currently being extended to full endpoint coverage. Publishing it (npm) + a Python
SDK materially lowers integration friction for the server-side/data buyer — the
segment wherabouts can win *today* without mobile SDKs.

**Priority 4 — Places/POI + address validation.**
POI visit detection (Radar "Places") and postal address validation/standardisation
(Google Address Validation, Smarty) are common buyer asks. G-NAF already gives a
validation head start for AU.

**Lower priority / watch:** isolines/reachability (Geoapify/HERE differentiator),
fraud/spoof detection (Radar-only, niche), integrations marketplace (only once
webhooks have traction).

**Defend now (cheap, high-leverage):**
- Market the **G-NAF + ABS authority** explicitly — it's the moat global players
  won't match. Lead with "official government address & boundary data."
- Lean on the **all-in-one AU geofencing** story against Mappify ("they geocode; we
  geocode *and* tell you when a device enters a zone").
- Price transparently against Mappify's AUD/no-contract model — developer-self-serve
  is where Geoapify and Mappify win and where Google/HERE are weak.

---

## 7. Bottom line

Wherabouts is **not** a "me-too geocoder." It is the only product pairing
Australian authoritative data with a working real-time geofencing/device/webhook
platform. The recent ASGS region-classification work and the in-progress TypeScript
SDK both reinforce that position. To convert the niche into a durable business:
**entrench the AU-data moat fast, ship client SDKs to unlock mobile geofencing, and
add routing for feature parity with the incumbents buyers already compare against.**
