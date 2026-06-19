# Agent-readable public documentation layer

**Date:** 2026-06-19
**Status:** Approved (design) — ready for implementation plan
**Author:** brainstormed with Claude

## Problem

The four features a developer would most want to learn about — the **component
library** (`/_protected/components`), the **SDK playground**
(`/_protected/sdk-playground`), the **API explorer / docs**
(`/_protected/api-docs`), and **zones** (`/_protected/zones`) — are all
interactive React UIs locked behind login. An LLM agent (or a logged-out human)
cannot read them. We want each feature's *documentation* to be publicly
reachable so any agent can crawl, search, and understand how the platform works
without authenticating.

## Reframe (the core decision)

"Replicate the four features on the docs route" is the wrong target. An agent
gains nothing from a polygon-drawing canvas or a live SDK playground — those need
a browser, a session, and an API key. What an agent needs is the **text**: what
each feature does and the API calls behind it.

So the work is **not** "mirror four interactive UIs publicly." It is "extract
each feature's documentation into one content layer and serve it as the markdown
agents actually consume." The interactive `_protected` pages stay behind login as
the "try it live" layer and link out to the public docs.

This generalizes a pattern already shipped in this repo: `lib/agent-skills.ts`
holds markdown bodies as the single source of truth and serves them at stable
`.well-known/agent-skills/...` URLs with live SHA-256 digests.

## What already exists (do not rebuild)

- **`/docs`** — a public, comprehensive, human-facing docs page
  (`apps/web/src/components/docs-page.tsx`). It is hand-built JSX driven by
  **structured endpoint data** (per-endpoint params, notes, example responses,
  and curl/SDK/Python code samples), plus narrative prose. It is **not**
  markdown-driven, and the web app has **no markdown→HTML renderer** in its
  dependencies.
- **`/.well-known/agent-skills/index.json`** + **`/{skill}/SKILL.md`** — 3
  agent-readable skills (geocoding, zones/geofencing, batch geocoding) served as
  raw markdown, with `index.json` digests computed live from the served bytes.
- **`/.well-known/api-catalog`** (RFC 9727), **`/api/openapi.json`**,
  **`/api/health`**.
- **`apps/mcp/`** — a standalone MCP Worker fronting the *operational* location
  API (already designed and planned in git under `docs/mcp/`).
- **`MARKDOWN-FOR-AGENTS.md`** — a plan to enable Cloudflare content negotiation
  (HTML→markdown on `Accept: text/markdown`). Out of scope here; layered later.

## Architecture: one content layer → three renderings

### 1. Content layer — single source of truth

`apps/web/src/lib/docs/` — a typed registry of documentation topics.

```ts
interface DocTopic {
  slug: string;            // url-safe, stable
  title: string;
  description: string;     // one line; feeds index + llms.txt
  category: "guide" | "api" | "sdk" | "ui";
  related: string[];       // other slugs
  body: string;            // markdown (narrative topics), OR
  endpointRef?: string;    // id into the existing structured endpoint data
}
```

Two content sources feed the registry, on purpose:

- **API reference topics** reuse the **structured endpoint data that `docs-page.tsx`
  already defines** (params, notes, example response, code samples). A
  `endpointToMarkdown()` serializer renders that structured data to markdown.
  This keeps the human page and the agent markdown from drifting — both read the
  same structured objects. As part of this work, that endpoint data is extracted
  out of `docs-page.tsx` into the shared `lib/docs/` module so both consumers
  import it (targeted improvement; `docs-page.tsx` is large and mixing data with
  JSX is the reason it can't currently be reused).
- **Narrative topics** (`sdk`, `react-ui`/components, `authentication`,
  `errors`, `rate-limits`) are authored as markdown strings in the registry,
  mirroring the `agent-skills.ts` style.

The existing `agent-skills.ts` skills become a **view over this registry** (or
import shared bodies from it) so `.well-known/agent-skills` stays consistent and
nothing is authored twice.

### 2. Three renderings (all read the registry)

- **Markdown for crawlers** — `GET /docs/{slug}.md` returns
  `text/markdown; charset=utf-8` (mirrors the existing `SKILL.md` route exactly,
  including `cache-control: public, max-age=3600`). For `endpointRef` topics the
  body is produced by `endpointToMarkdown()`; for narrative topics it is the
  registry `body` verbatim.
- **Discovery index** — `GET /llms.txt` returns a curated plain-text index
  (the [llms.txt](https://llmstxt.org/) convention): site summary, then a linked
  list of every `/docs/{slug}.md` URL with its one-line description, plus links
  to `/api/openapi.json`, `/.well-known/agent-skills/index.json`, and
  `/.well-known/api-catalog`. This is the "plugin without a build": a single
  manifest any agent crawls, no new server, no new deploy.
- **HTML for logged-out humans** — the existing public `/docs` page stays the
  human surface. It is extended so its navigation includes the new narrative
  topics (sdk, react-ui, auth, errors). Because there is no markdown renderer and
  the page is already JSX-driven, narrative topics are rendered as DocsPage
  sections rather than by introducing a markdown→HTML dependency. **No new
  rendering library is added.** Cross-links are added: each `_protected` feature
  page links to its public doc ("Read the docs"), and docs link back ("Try it
  live — sign in").

### 3. The "plugin" — recommendation

**Do not build a second MCP server for docs.** The crawlable markdown +
`/llms.txt` *is* the agent-facing surface: it reaches every agent (Claude,
generic crawlers, RAG pipelines) with no protocol negotiation, no client, and no
build — which is exactly the "without a build, just specific routes on the
documentation route" ask.

Keep `apps/mcp` for *operational* API tool-calling (already designed). If docs
should later be reachable over MCP, that existing server can add
`search_docs` / `get_doc` tools that read this same registry — zero new
infrastructure. A docs-only MCP server would only reach MCP clients and would
need its own hosting, for no gain over markdown + llms.txt.

### 4. Later (non-blocking, out of scope)

Enable Cloudflare Markdown-for-Agents (`MARKDOWN-FOR-AGENTS.md`) so even non-`.md`
HTML pages negotiate to markdown. Independent of this work.

## Units and boundaries

- `lib/docs/registry.ts` — `DocTopic[]`, types, `findTopic(slug)`. Pure data.
- `lib/docs/endpoints.ts` — structured endpoint data extracted from
  `docs-page.tsx` + `endpointToMarkdown()`. Pure functions.
- `lib/docs/serialize.ts` — `topicMarkdown(topic)` (frontmatter + body) and the
  `llms.txt` builder. Pure functions, no I/O.
- `routes/docs.{slug}[.]md.ts` — markdown route (dynamic, parses slug from URL
  like the existing `SKILL.md` route).
- `routes/llms[.]txt.ts` — discovery index route.
- `components/docs-page.tsx` — extended to consume `lib/docs` and add narrative
  topic sections + cross-links.
- `lib/agent-skills.ts` — refactored to source bodies from `lib/docs` (no
  duplicate authoring).

Each unit answers: *what it does* (data / serialize / serve), *how you use it*
(import the registry or hit the route), *what it depends on* (only the registry;
routes depend on serialize + registry). The serializers are independently
testable without a browser.

## Testing

- **Consistency:** every `DocTopic` slug resolves to a `200` `.md` route with
  `content-type: text/markdown`; every slug appears in `/llms.txt`.
- **No drift:** `endpointToMarkdown()` output for a known endpoint contains its
  params and example response; agent-skills bodies match their `lib/docs` source.
- **Discovery:** `/llms.txt` lists OpenAPI, agent-skills index, and api-catalog
  URLs; links are absolute against request origin.
- **Route shape:** unknown slug → `404` text/plain (matches `SKILL.md` route).
- Follows the repo's no-DOM test convention (pure logic + route handlers).

## Scope boundaries (YAGNI)

- No markdown→HTML renderer dependency.
- No second MCP server; no changes to `apps/mcp` in this work.
- No Cloudflare content-negotiation changes.
- No public mirror of the interactive UIs (components/zones/playground stay
  `_protected`); only their *documentation* goes public.

## Success criteria

An LLM agent with no account can: fetch `/llms.txt`, discover every doc URL,
fetch `/docs/{slug}.md` for any of the four features as clean markdown, and from
that understand the API calls behind each feature — while logged-out humans still
get the existing rich `/docs` HTML, now covering SDK and UI topics too.
