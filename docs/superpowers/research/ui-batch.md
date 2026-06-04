# Design-Research Brief: Batch Geocoding Dashboard UI

Surface: submit a list of addresses, poll the job, view/download results. Dashboard
uses **session-authed oRPC procedures** (Decision A settled) — NOT the public API-key
endpoints, which stay for programmatic SDK callers.

---

## Endpoints / Data

### Shipped public API (API-key auth, `apiKeyAuth` + `usageMiddleware`)
Source: `packages/api/src/routers/public/geocode.ts`

| Procedure | Method / Path | Input | Output |
|---|---|---|---|
| `batchGeocodeSubmit` | POST `/api/v1/geocode/batch` | `{ addresses: string[] }` — each `min(5)` chars, array `min(1)`, `max(1000)` ("Maximum 1,000 addresses per job") | `{ jobId, status, inputCount }` |
| `batchGeocodePoll` | GET `/api/v1/geocode/batch/{jobId}` | `{ jobId: uuid }` | `{ jobId, status, inputCount, processedCount, completedAt, error, downloadUrl }` |
| `batchGeocodeResults` | GET `/api/v1/geocode/batch/{jobId}/results` | `{ jobId: uuid }` | `{ results: unknown[], count }` |

- **Job statuses:** `pending` → `processing` → `completed` | `failed`.
  - Submit inserts `pending`; if `BATCH_GEOCODE_QUEUE` binding exists, enqueues then
    sets `processing`. Enqueue failure → `failed` + `INTERNAL_SERVER_ERROR`.
- **downloadUrl** is non-null only when `status === "completed"`; it is a relative path
  `/api/v1/geocode/batch/{id}/results` (NOT a presigned URL — must be fetched through
  the results endpoint).
- All three procedures scope by `validatedApiKey.projectId`; cross-project access → `NOT_FOUND`/`UNAUTHORIZED`.

### Consumer / async processing
Source: `apps/server/src/queues/batch-geocode.ts` (`processBatchGeocodeMessage`)
- Iterates addresses, calls `autocompleteAddresses(db, address, { limit: 1 })`.
- Writes a JSON array to R2 bucket `GEOCODE_RESULTS` at key
  `geocode-jobs/{projectId}/{jobId}.json`.
- On success: sets `status=completed`, `processedCount`, `resultsR2Key`, `completedAt`.
- On failure: sets `status=failed`, `error`, `completedAt`, then rethrows for CF Queue retry/DLQ.
- **Per-row result shape** (`BatchGeocodeResult`):
  ```ts
  { input: string; matched: boolean;
    address?: { id, formattedAddress, latitude, longitude, country, state, locality, postcode };
    error?: string }
  ```
- NOTE: `batchGeocodeResults` returns `results` typed as `unknown[]`; the SDK type
  `BatchGeocodeResultsResponse.results` is also `unknown[]`. The concrete row type lives
  only in the queue file. **The dashboard should re-declare a typed `BatchRow` interface**
  matching `BatchGeocodeResult` (or it should be lifted into `packages/sdk/src/types.ts`).

### DB table
Source: `packages/database/src/schema/jobs.ts` — `batch_geocode_jobs`
Columns: `id (uuid pk)`, `projectId`, `apiKeyId`, `status`, `inputCount`,
`processedCount (default 0)`, `resultsR2Key`, `error`, `createdAt`, `completedAt`.
Indexes on `project_id` and `status`. Type exports: `BatchGeocodeJob`, `NewBatchGeocodeJob`.

### SDK types
Source: `packages/sdk/src/types.ts` — `BatchGeocodeSubmit*`, `BatchGeocodePollResponse`
(status union `"pending"|"processing"|"completed"|"failed"`), `BatchGeocodeResultsResponse`.

---

## oRPC procedures to add (session-authed)

Pattern (from `packages/api/src/routers/domains/api-keys.ts` + `procedures.ts`):
`protectedProcedure = publicProcedure.use(...)` throws `UNAUTHORIZED` if no
`context.session`. Handlers read `context.session.user.id` and scope DB queries by the
user's projects (`projects.userId === authUserId`). **Key difference from public API:**
there is no API key, so a job must be tied to a user-owned project. The dashboard
submit needs a `projectId` (the user's project) and must verify ownership server-side.

Proposed new router `geocodeRouter` (register in
`packages/api/src/routers/index.ts` `appRouter` as `geocode:`), all `protectedProcedure`:

| Procedure | Input | Output | Notes |
|---|---|---|---|
| `geocode.batchSubmit` | `{ projectId: uuid, addresses: string[] }` (reuse `min(5)`/`min(1)`/`max(1000)` schema) | `{ jobId, status, inputCount }` | Verify `projectId` belongs to `session.user.id` before insert/enqueue. Reuses the same `batchGeocodeJobs` insert + `BATCH_GEOCODE_QUEUE.send` logic. `apiKeyId` is currently `notNull` — see Open Questions. |
| `geocode.batchPoll` | `{ jobId: uuid }` | same as `batchGeocodePoll` (`processedCount`, `inputCount`, `downloadUrl`, `error`, `completedAt`) | Scope by `job.projectId IN (user's projects)` instead of API key. |
| `geocode.batchResults` | `{ jobId: uuid }` | `{ results: BatchRow[], count }` | Fetch from R2 `GEOCODE_RESULTS` by `resultsR2Key`; ownership check via project. Return typed rows, not `unknown[]`. |

### NEW backend addition recommended
| Procedure | Input | Output | Status |
|---|---|---|---|
| `geocode.batchList` | `{ projectId?: uuid, limit?, cursor? }` | `Array<{ jobId, status, inputCount, processedCount, createdAt, completedAt, error }>` | **Does NOT exist in the public API today.** Backend is feasible: `batch_geocode_jobs` already has an `idx_batch_jobs_project_id` index and can be queried by the user's project(s). Needs a new handler (a simple `SELECT ... WHERE projectId IN (userProjects) ORDER BY createdAt DESC`). Flag for human approval. |

(No new DB columns strictly required for batchList; it reads existing columns.)

---

## Components needed

Available shadcn primitives (`packages/ui/src/components/`): `table`, `progress`,
`textarea`, `sonner`, `tabs`, `input`, `card`, `button`, `badge`, `skeleton`.

- **Route file:** `apps/web/src/routes/_protected/batch-geocode.tsx` via
  `createFileRoute("/_protected/batch-geocode")` (mirrors `api-keys.tsx`).
- Client: `orpcClient` / `orpc` query utils from `apps/web/src/lib/orpc.ts`
  (react-query, `credentials: "include"`). Errors surfaced via `sonner` toast
  (api-keys page currently uses local `error` state — prefer `sonner` here for async UX).
- **Input card:** `Tabs` for two input methods —
  1. `Textarea` paste (newline-separated), 2. CSV file upload (`<input type=file>`,
     parsed client-side). Project selector (`Select`/dropdown) populated from
     `projects.listApiKeyOptions`-style query. Submit `Button`.
- **Job card:** status `Badge`, `Progress` bar bound to `processedCount / inputCount`,
  processed counter, elapsed/`completedAt`.
- **Results table:** `Table` columns: input → matched (✓/✗ badge) → formatted address →
  lat/lng → error. Download buttons (CSV / JSON) built from the results array client-side.
- **Recent jobs list:** `Table` of `geocode.batchList` rows (jobId, status badge,
  counts, createdAt) with a "view" action that loads poll/results for that job.

---

## UX flow

1. User picks a project, enters addresses (paste or CSV upload).
2. Client validation runs (see below) before enabling submit.
3. Submit → `geocode.batchSubmit` → returns `{ jobId, status, inputCount }`. Render a job
   card immediately; optimistically prepend to the recent-jobs list.
4. Poll `geocode.batchPoll` on an interval; drive the `Progress` bar from
   `processedCount/inputCount`.
5. On `completed`: stop polling, call `geocode.batchResults`, render the results table +
   enable CSV/JSON download. On `failed`: stop polling, show `error` in a destructive card/toast.
6. Recent-jobs table lets the user re-open any prior job (poll + results on demand).

---

## Polling strategy (react-query)

- Use `useQuery` for poll keyed by `jobId` with
  `refetchInterval: (query) => ["pending","processing"].includes(query.state.data?.status) ? 2000 : false`.
- Stop (return `false`) once `completed` or `failed`.
- Suggested interval ~2s; back off / cap for large jobs. `refetchOnWindowFocus` can stay default.
- Results query (`geocode.batchResults`) is `enabled: status === "completed"` so it fires once.
- Consider `staleTime: 0` on poll so each tick refetches.

---

## Edge cases

- **Empty / too-short addresses:** schema requires each `min(5)` chars; trim blank lines
  from paste/CSV before counting. Show count + over-limit warning client-side.
- **>1000 addresses:** block submit client-side with the "Maximum 1,000" message; server
  rejects too.
- **Duplicate addresses:** allowed by API; optionally de-dupe client-side (open question).
- **Queue binding absent (tests/local):** submit returns `status="pending"` and the job
  never progresses — dashboard should show a "queued, not yet processing" state and not
  poll forever (cap retries or show a stale warning).
- **Results not ready / race:** `batchResults` throws `NOT_FOUND` ("Results not ready")
  if polled before `completed`; gate the results call on status.
- **Large result sets:** results returned in one JSON payload (`results: unknown[]`);
  for 1000 rows this is fine in memory but the table should virtualize or paginate.
- **R2 storage binding unavailable:** results endpoint throws `INTERNAL_SERVER_ERROR`;
  surface a retry.
- **Failed rows within a completed job:** rows carry `matched:false` and/or `error`;
  table must visually distinguish unmatched vs errored rows.
- **CSV parsing failures:** malformed CSV, wrong delimiter, header detection — needs a
  parse-error state.
- **Job ownership:** dashboard procedures must reject jobs not owned by the session
  user's projects (`NOT_FOUND`).
- **`apiKeyId` notNull:** the table requires `apiKeyId`; dashboard submits have no API
  key — see Open Questions.

---

## Open questions (need human decision)

1. **`apiKeyId` is `NOT NULL` on `batch_geocode_jobs`, but dashboard submits have no API
   key.** Options: (a) make `apiKeyId` nullable (migration), (b) add a per-project
   "dashboard" system key, or (c) add a `source`/`userId` column. Blocks `geocode.batchSubmit`.
2. **`batchList` approval & scope:** confirm adding the new backend handler, and whether
   it lists per selected project or across all the user's projects; pagination/cursor + retention window.
3. **CSV parsing — client vs server, and column mapping:** which column holds the address
   when CSV has multiple columns? Single-column assumption vs a column-picker UI? Max
   upload size? Recommend client-side parse (e.g. a light CSV util) with a column selector.
4. **Results typing:** lift the `BatchGeocodeResult` row type into
   `packages/sdk/src/types.ts` so both the queue and dashboard share it (currently
   `unknown[]`).
5. **Retention / cleanup:** R2 objects and `batch_geocode_jobs` rows have no documented
   TTL — does the dashboard expose only recent jobs, and is there a purge policy?
6. **Project selection UX:** if a user has many projects, which is the default for submit?
