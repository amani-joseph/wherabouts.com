# Design-Research Brief: Docs + API Explorer Update

Surface: in-browser API docs page (`/docs`) and interactive "try-it" API Explorer.
Goal: add the 5 new public endpoint groups (forward geocode, batch geocode, zones, devices, webhooks) to the docs page and the explorer, which today cover only the 4 address endpoints.

## How docs/explorer work today

There are **four independent, hand-authored layers**. None auto-discovers from the others or from the router.

1. **Docs page** — `apps/web/src/components/docs-page.tsx`
   - `endpointDocs: EndpointDoc[]` is a hardcoded array. Each entry has `title`, `href` (`#anchor`), `method`, `path`, `description`, `summary`, `notes[]`, `params[]`, and `exampleResponse` (a string).
   - A separate hardcoded `nav` array (left sidebar) lists section groups with `{ title, href }` anchors — e.g. `#autocomplete`, `#reverse`, `#nearby`, `#address-by-id`. Adding endpoints means adding nav entries too.
   - Curl + JS/fetch + SDK examples are written inline per endpoint as template-literal strings.
   - `EndpointSection` renders each `EndpointDoc` (method badge, path, params table, example response). Static `Badge` "4 core address endpoints" copy also references the count.

2. **Explorer UI** — `apps/web/src/components/api-explorer.tsx`
   - Maps over `apiExplorerEndpoints` (imported from the lib below) and renders one card per endpoint with a params form, "fill examples", and a Send button.
   - Auth UI supports two modes: `raw` (paste `wh_..._...` key) and `managed` (pick a saved key by `managedKeyId`).

3. **Explorer endpoint catalog** — `apps/web/src/lib/api-explorer-endpoints.ts`
   - `ApiEndpointId` is a **closed string union** of exactly 4 ids: `addresses.autocomplete | addresses.byId | addresses.nearby | addresses.reverse`.
   - `apiExplorerEndpoints: ApiEndpoint[]` declares `id`, `method`, `path`, `summary`, `description`, `params[]` (each with `name/type/required/description/example`). Adding endpoints means widening the union + adding entries.

4. **Explorer server proxy** — `packages/api/src/routers/domains/api-explorer.ts` (oRPC procedure `apiExplorer.sendRequest`, registered in `routers/index.ts`)
   - The Send button does **not** fetch the public API directly from the browser. It calls `orpcClient.apiExplorer.sendRequest({ authMode, endpointId, paramValues, managedKeyId, rawApiKey })`.
   - This procedure has its **own** `endpointMap: Map<ApiEndpointId, ApiEndpoint>` (a 3rd copy of the catalog) and resolves auth (managed key decryption vs raw), builds the URL, calls the real public API, returns `{ statusCode, durationMs, body }`.
   - CRITICAL CONSTRAINT: the proxy's `ApiEndpoint` type hardcodes `method: "GET"`. It only substitutes path params and appends query params. POST/PUT/DELETE endpoints (zones create/update/delete, batch submit, device location, webhooks create/delete) are **not representable** today — the proxy needs a request-body path and non-GET method support before those endpoints can be exercised in the explorer.

## OpenAPI: auto-gen vs hand-authored (FINDING)

**The published OpenAPI document is hand-maintained, NOT auto-generated.** This is the key finding.

- The web route `apps/web/src/routes/api/openapi.json.ts` simply returns `getOpenApiDocument()` from `apps/web/src/lib/openapi.ts`.
- `apps/web/src/lib/openapi.ts` is a giant hardcoded `as const` JS object (OpenAPI 3.1.0) that manually spells out paths, params, schemas, and responses for **only the 4 address endpoints**. The `info.description` even hardcodes "autocomplete, reverse geocoding, nearby search, and canonical address retrieval."
- Note the potential confusion: the **server** (`packages/api/src/routers/public-http.ts`) does use oRPC's `OpenAPIHandler` — but that is used only to **route/dispatch** incoming `/api/v1/*` requests against `publicHttpRouter`. It is not what serves `/api/openapi.json`, and the web app does not import any oRPC-generated spec. The public router already declares `method`/`path`/`summary` per route (and the new endpoints are already registered there), so an oRPC `OpenAPIGenerator` could in principle produce the spec — but that wiring does not exist today.

Implication: every new endpoint needs a hand-written OpenAPI block in `openapi.ts` unless the team chooses to switch to generating the spec from `publicHttpRouter` (see Open Questions).

## Full list of new endpoints to document

The new public endpoints are already implemented/registered under `packages/api/src/routers/public/` and wired in `public-http.ts`. **14 new endpoints across 5 groups:**

### Forward geocode + batch (`public/geocode.ts`)
1. `GET  /api/v1/addresses/geocode` — Forward geocode an address.
2. `POST /api/v1/geocode/batch` — Submit batch geocoding job.
3. `GET  /api/v1/geocode/batch/{jobId}` — Poll batch geocoding job (status).
4. `GET  /api/v1/geocode/batch/{jobId}/results` — Download batch geocoding results.

### Zones (`public/zones.ts`)
5. `POST   /api/v1/zones` — Create a zone.
6. `GET    /api/v1/zones` — List zones.
7. `GET    /api/v1/zones/{id}` — Get a zone by ID.
8. `PUT    /api/v1/zones/{id}` — Update a zone.
9. `DELETE /api/v1/zones/{id}` — Delete a zone.
10. `GET   /api/v1/zones/contains` — Find zones containing a point (lat/lng).
11. `GET   /api/v1/zones/{id}/addresses` — Get addresses within a zone.

### Devices (`public/devices.ts`)
12. `POST /api/v1/devices/{deviceId}/location` — Push device location update.
13. `GET  /api/v1/devices/{deviceId}/zones` — Current zone membership for a device.

### Webhooks (`public/webhooks.ts`)
14. `POST   /api/v1/webhooks` — Subscribe to zone events.
15. `GET    /api/v1/webhooks` — List webhook subscriptions.
16. `DELETE /api/v1/webhooks/{id}` — Delete webhook subscription.

(That is 16 endpoints if counted individually; "5 endpoint groups" = geocode, batch, zones, devices, webhooks. Note batch geocode is async: submit → poll → results, which needs explicit doc narrative about the job lifecycle and R2-backed results download.)

Per-endpoint params/response shapes live in each handler's Zod input/output schemas (e.g. `zones-schema.ts`, `boundary-crossings.ts`) plus `packages/sdk/src/types.ts` — these are the source of truth for documenting params and response bodies.

## Effort estimate

Medium-to-large, dominated by hand-authoring duplicated metadata across 3-4 layers.

- **Docs page (`docs-page.tsx`)**: ~16 new `EndpointDoc` entries (or grouped) with description/notes/params/curl+JS/example-response strings, plus ~5 new nav groups/anchors and updated "core endpoints" count copy. Largest single chunk of work because examples are bespoke prose.
- **OpenAPI (`openapi.ts`)**: ~16 new hand-written path objects with parameters, request bodies (for POST/PUT), and response schemas. Update `info.description`. (Or replace with router-driven generation — bigger upfront, smaller ongoing.)
- **Explorer catalog (`api-explorer-endpoints.ts`)**: widen `ApiEndpointId` union + add ~16 `ApiEndpoint` entries with params/examples.
- **Explorer server proxy (`api-explorer.ts`)**: widen its `ApiEndpointId` union, add to `endpointMap`, AND extend the proxy to support non-GET methods + JSON request bodies (today it is GET-only). This is the highest-risk item — without it, POST/PUT/DELETE endpoints can be listed but not actually run in the explorer.
- **No auto-discovery**: the explorer is fully hardcoded against `apiExplorerEndpoints`; it does not read the OpenAPI doc. So OpenAPI changes do not flow into the explorer automatically.

## Components / files touched

- `apps/web/src/components/docs-page.tsx` (endpointDocs array, nav, examples, count copy)
- `apps/web/src/lib/openapi.ts` (hand-written spec — add paths/schemas)
- `apps/web/src/lib/api-explorer-endpoints.ts` (ApiEndpointId union + catalog)
- `apps/web/src/components/api-explorer.tsx` (likely minimal — already maps the catalog; may need request-body input UI for POST/PUT)
- `packages/api/src/routers/domains/api-explorer.ts` (sendRequest proxy: union, endpointMap, non-GET + body support)
- Read-only sources for content: `packages/api/src/routers/public/*.ts`, `packages/api/src/routers/public-http.ts`, `packages/sdk/src/types.ts`

## Open questions (human decisions)

1. **Hand-author vs generate?** Keep maintaining `openapi.ts` (and the 3 explorer copies) by hand, or invest now in generating the OpenAPI spec + explorer catalog from `publicHttpRouter` via oRPC's `OpenAPIGenerator` (router already declares method/path/summary/Zod schemas)? This decides whether this update is the last manual one or perpetuates 4 sources of truth.
2. **Explorer support for mutating endpoints.** Should the explorer be able to actually execute POST/PUT/DELETE (create/delete zones, submit batch, push device location, create/delete webhooks) against real data? That requires extending the GET-only `sendRequest` proxy with method + request-body handling, plus UX/safety considerations for destructive calls (and managed vs raw key scoping). Or do we list them as docs-only / "GET-only in explorer"?
3. **Doc grouping & async/lifecycle narrative.** Group the 16 endpoints under new top-level doc sections (Geocoding, Batch, Zones, Devices, Webhooks) with their own nav clusters? And how much narrative to add for the async batch lifecycle (submit→poll→results, R2 download) and webhook event semantics (signing, retries, delivery), which the current flat per-endpoint format does not cover?
4. **Example responses: live vs handwritten.** Regenerate `exampleResponse` blobs by calling the live public API with a real key, or hand-write representative examples? Live capture is more accurate but needs a key + seeded data (zones, devices, webhooks).
