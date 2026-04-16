# Phase 1: BetterAuth Infrastructure - Research

**Researched:** 2026-04-14
**Domain:** Authentication infrastructure (BetterAuth + Convex + TanStack Start)
**Confidence:** MEDIUM-HIGH

## Summary

This phase replaces the Clerk authentication infrastructure with BetterAuth, using the `@convex-dev/better-auth` Convex Component to store auth data (users, sessions) in Convex. The integration follows a well-documented pattern: BetterAuth runs as HTTP endpoints on the Convex deployment, a TanStack Start API route proxies auth requests to Convex, and a React provider manages client-side auth state.

The reference project (mydeffo.com-web) uses BetterAuth with a Drizzle/PostgreSQL adapter -- a different architecture than what we need. We must use the `@convex-dev/better-auth` Convex Component instead, which provides its own adapter. The Convex + BetterAuth integration has dedicated TanStack Start documentation and an official example repository.

**Primary recommendation:** Use `@convex-dev/better-auth` (v0.11.4) with `better-auth` (pinned to a compatible version per docs) and the `convexBetterAuthReactStart` helper from `@convex-dev/better-auth/react-start` for TanStack Start integration. Do NOT follow the mydeffo.com reference project's Drizzle adapter pattern -- use the Convex Component adapter instead.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFR-01 | BetterAuth server configured for TanStack Start | Convex Component handles server-side auth; TanStack Start proxies via `/api/auth/$` route handler using `convexBetterAuthReactStart` |
| INFR-02 | Convex adapter stores users and sessions | `@convex-dev/better-auth` provides `createClient` + `authComponent.adapter(ctx)` that stores auth data in Convex tables |
| INFR-03 | Auth middleware protects routes requiring authentication | TanStack Router `beforeLoad` guard on `_protected` layout route checks auth state; replaces current Clerk `context.userId` check |
| INFR-04 | Client-side auth hooks provide current user and auth state | `ConvexBetterAuthProvider` + `createAuthClient` from `better-auth/react` with `convexClient()` plugin provides `useSession` hook |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Ultracite/Biome** enforced -- run `pnpm dlx ultracite fix` before committing
- **Tabs** for indentation, **double quotes** for strings
- **Named exports** preferred over default exports
- **Arrow functions** for callbacks
- **kebab-case** filenames for all source files
- **No console.log** in production code
- **No `any` type** -- use `unknown` when type is genuinely unknown
- **Server functions** use `createServerFn` from `@tanstack/react-start`
- **Type-safe env vars** via `@t3-oss/env-core` + Zod
- **Existing conventions**: `@/` import alias, `src/lib/` for utilities, `src/routes/` for file-based routes

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-auth` | 1.6.2 (pin per docs) | Auth framework | Official BetterAuth library; Convex component docs may require pinned version |
| `@convex-dev/better-auth` | 0.11.4 | Convex Component for BetterAuth | Official Convex integration -- provides adapter, HTTP route registration, React provider |
| `convex` | 1.35.1 (current) | Backend platform | Already installed; must be >= 1.25.0 for component support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@t3-oss/env-core` | existing | Type-safe env vars | Adding new env vars (VITE_CONVEX_SITE_URL, VITE_SITE_URL) |
| `zod` | existing | Schema validation | Validating new environment variables |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@convex-dev/better-auth` (Convex Component) | `better-auth` with Drizzle adapter (like mydeffo.com) | Drizzle adapter stores in PostgreSQL, not Convex -- violates requirement that auth data lives in Convex |
| BetterAuth | Convex Auth (`@convex-dev/auth`) | Convex Auth is a different library; project decision is to use BetterAuth specifically |

**Installation:**
```bash
cd apps/web
pnpm add @convex-dev/better-auth better-auth@1.6.2
```

**Version verification:** Versions checked via `npm view` on 2026-04-14:
- `better-auth`: 1.6.2
- `@convex-dev/better-auth`: 0.11.4
- `convex`: 1.35.1

**IMPORTANT:** The `@convex-dev/better-auth` docs may pin `better-auth` to a specific version (e.g., `1.5.3` in older docs). Check the latest docs before installing -- the pinned version ensures compatibility with the Convex adapter. If the latest component supports 1.6.2, use that; otherwise pin to what the docs specify.

## Architecture Patterns

### Recommended Project Structure
```
packages/backend/convex/
  auth.ts              # BetterAuth config (createClient, createAuth)
  auth.config.ts       # Convex auth provider config (getAuthConfigProvider)
  http.ts              # HTTP router with auth routes registered
  schema.ts            # Updated with auth tables (auto-managed by component)
  convex.config.ts     # Register betterAuth component via app.use()

apps/web/src/
  lib/
    auth-client.ts     # createAuthClient with convexClient() plugin
    auth-server.ts     # convexBetterAuthReactStart exports (handler, getToken, etc.)
  routes/
    api/
      auth/
        $.ts           # Proxy route: GET/POST -> handler(request)
    __root.tsx          # ConvexBetterAuthProvider, beforeLoad auth fetch
    _protected.tsx      # Route guard using isAuthenticated from context
```

### Pattern 1: Convex Component Registration
**What:** Register BetterAuth as a Convex Component in `convex.config.ts` and create auth configuration in `convex/auth.ts`
**When to use:** Required -- this is how the Convex adapter works

```typescript
// convex/convex.config.ts
import { defineApp } from "convex/server";
import betterAuth from "@convex-dev/better-auth/convex.config";

const app = defineApp();
app.use(betterAuth);
export default app;
```

```typescript
// convex/auth.ts
import { betterAuth } from "better-auth/minimal";
import { createClient } from "@convex-dev/better-auth";
import type { DataModel } from "./_generated/dataModel";
import { components } from "./_generated/api";

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: unknown) => {
  return betterAuth({
    baseURL: process.env.VITE_CONVEX_SITE_URL,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
    },
  });
};
```

### Pattern 2: HTTP Route Registration
**What:** Register BetterAuth endpoints on Convex HTTP router
**When to use:** Required -- this exposes auth API endpoints on the Convex deployment

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();
authComponent.registerRoutes(http, createAuth);
export default http;
```

### Pattern 3: TanStack Start Auth Proxy
**What:** Proxy auth requests from TanStack Start to Convex deployment
**When to use:** Required -- TanStack Start needs a local API route that forwards to Convex

```typescript
// src/lib/auth-server.ts
import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

export const {
  handler,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthReactStart({
  convexUrl: process.env.VITE_CONVEX_URL!,
  convexSiteUrl: process.env.VITE_CONVEX_SITE_URL!,
});
```

```typescript
// src/routes/api/auth/$.ts
import { createFileRoute } from "@tanstack/react-router";
import { handler } from "@/lib/auth-server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
    },
  },
});
```

### Pattern 4: Client Auth Setup
**What:** Create auth client with Convex plugin for React components
**When to use:** Required -- provides hooks like `useSession` for client-side auth state

```typescript
// src/lib/auth-client.ts
import { convexClient } from "@convex-dev/better-auth/client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [convexClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
```

### Pattern 5: Root Route with ConvexBetterAuthProvider
**What:** Replace ClerkProvider + ConvexProviderWithClerk with ConvexBetterAuthProvider
**When to use:** Required -- wraps the app with auth context

```typescript
// src/routes/__root.tsx (simplified)
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { createServerFn } from "@tanstack/react-start";
import { getToken } from "@/lib/auth-server";
import { authClient } from "@/lib/auth-client";

const fetchAuth = createServerFn({ method: "GET" }).handler(async () => {
  return await getToken();
});

export const Route = createRootRouteWithContext<RouterAppContext>()({
  beforeLoad: async (ctx) => {
    const token = await fetchAuth();
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
    }
    return { isAuthenticated: !!token, token };
  },
  component: RootDocument,
});

function RootDocument() {
  const context = useRouteContext({ from: Route.id });
  return (
    <ConvexBetterAuthProvider
      client={context.convexQueryClient.convexClient}
      authClient={authClient}
      initialToken={context.token}
    >
      {/* ... app shell ... */}
    </ConvexBetterAuthProvider>
  );
}
```

### Pattern 6: Route Protection
**What:** Guard protected routes using auth state from context
**When to use:** For all routes under `_protected` layout

```typescript
// src/routes/_protected.tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected")({
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) {
      throw redirect({ to: "/sign-in" });
    }
  },
  component: RouteComponent,
});
```

### Anti-Patterns to Avoid
- **Using Drizzle adapter for Convex storage:** The mydeffo.com reference uses `drizzleAdapter` with PostgreSQL. Do NOT replicate this pattern -- use `authComponent.adapter(ctx)` from `@convex-dev/better-auth` instead.
- **Running BetterAuth server in TanStack Start:** BetterAuth runs on Convex (via HTTP actions), not in the TanStack Start server. The TanStack Start route at `/api/auth/$` is just a proxy.
- **Mixing Clerk and BetterAuth providers:** During this phase, both may coexist temporarily, but the Convex provider must switch from `ConvexProviderWithClerk` to `ConvexBetterAuthProvider`.
- **Importing from `better-auth` instead of `better-auth/minimal`:** The Convex component docs use `better-auth/minimal` for the server-side config to avoid bundling unnecessary code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth data storage in Convex | Custom Convex mutations for users/sessions | `@convex-dev/better-auth` adapter | Handles schema, CRUD, session management automatically |
| Cookie handling in TanStack Start | Manual cookie get/set | `convexBetterAuthReactStart` from `@convex-dev/better-auth/react-start` | Handles cookie proxying between TanStack Start and Convex |
| JWT token management for Convex | Custom JWT creation/validation | `ConvexBetterAuthProvider` + `getToken` | Token lifecycle managed by the component |
| Auth HTTP endpoints | Custom API routes for login/signup/session | `authComponent.registerRoutes(http, createAuth)` | Better Auth provides all standard endpoints |
| Client auth state | Custom React context for auth | `createAuthClient` with `convexClient()` plugin | Provides `useSession`, `signIn`, `signUp`, `signOut` hooks |

**Key insight:** The `@convex-dev/better-auth` package provides a complete integration layer. The developer's job is configuration and wiring, not implementation. Almost every piece of auth logic is handled by the component.

## Common Pitfalls

### Pitfall 1: Version Pinning
**What goes wrong:** `@convex-dev/better-auth` may require a specific pinned version of `better-auth`. Installing the latest `better-auth` can cause runtime errors or type mismatches.
**Why it happens:** The Convex component wraps BetterAuth internals and may not immediately support new BetterAuth releases.
**How to avoid:** Check `@convex-dev/better-auth` docs for the required `better-auth` version. Install with `--save-exact`.
**Warning signs:** Type errors in `createAuth`, runtime errors from the adapter.

### Pitfall 2: Missing VITE_CONVEX_SITE_URL
**What goes wrong:** Auth requests fail silently or 404 because the proxy cannot reach Convex HTTP endpoints.
**Why it happens:** `VITE_CONVEX_SITE_URL` (the `.convex.site` URL) is different from `VITE_CONVEX_URL` (the `.convex.cloud` URL). The site URL is where HTTP actions are served.
**How to avoid:** Add `VITE_CONVEX_SITE_URL` to `.env` and to the env validation schema. It is typically `https://<deployment>.convex.site`.
**Warning signs:** 404 errors on `/api/auth/*` endpoints.

### Pitfall 3: SSR Auth Check on Every Navigation
**What goes wrong:** `getToken()` server function runs on every client-side navigation, causing slow UX.
**Why it happens:** TanStack Router's `beforeLoad` in root route fires on every navigation.
**How to avoid:** Cache the token/session state client-side; only re-fetch on initial load or after auth state changes. The `ConvexBetterAuthProvider` should handle this.
**Warning signs:** Visible loading delay on every page transition.

### Pitfall 4: Vite SSR Bundle Issue
**What goes wrong:** `@convex-dev/better-auth` fails to resolve during SSR.
**Why it happens:** Vite treats it as an external module during SSR by default.
**How to avoid:** Add `@convex-dev/better-auth` to `ssr.noExternal` in `vite.config.ts`.
**Warning signs:** Module not found errors during SSR, hydration mismatches.

### Pitfall 5: Cloudflare Workers Compatibility
**What goes wrong:** BetterAuth or its dependencies use Node.js APIs not available in Cloudflare Workers.
**Why it happens:** The project deploys to Cloudflare Workers (see `wrangler.jsonc` and `@cloudflare/vite-plugin`). BetterAuth's server code runs on Convex (not Workers), but the proxy handler and client code must be Workers-compatible.
**How to avoid:** The auth server logic runs on Convex, not in the Worker. The TanStack Start proxy (`handler`) should only forward requests. Verify that `@convex-dev/better-auth/react-start` works in a Workers environment.
**Warning signs:** Runtime errors about missing Node.js APIs in the deployed Worker.

### Pitfall 6: RouterAppContext Type Update
**What goes wrong:** TypeScript errors because the router context still expects Clerk types (`userId`, `token`).
**Why it happens:** The `RouterAppContext` interface in `__root.tsx` needs updating to match BetterAuth's state shape.
**How to avoid:** Update the interface to include `isAuthenticated: boolean` and `token: string | null` instead of Clerk's `userId`.
**Warning signs:** TypeScript compilation errors in route files.

## Code Examples

### Environment Variable Updates

```typescript
// packages/env/src/web.ts - add new vars
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_CONVEX_URL: z.url(),
    VITE_CONVEX_SITE_URL: z.url(),  // NEW: .convex.site URL for HTTP actions
    // Remove: VITE_CLERK_PUBLISHABLE_KEY (Phase 3)
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
```

### Vite Config Update

```typescript
// vite.config.ts - add ssr.noExternal
export default defineConfig({
  plugins: [/* ... existing ... */],
  ssr: {
    noExternal: ["@convex-dev/better-auth"],
  },
  server: {
    port: 3001,
  },
});
```

### Convex Auth Config Provider

```typescript
// convex/auth.config.ts - replace Clerk config
import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";

export default {
  providers: [getAuthConfigProvider()],
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ConvexProviderWithClerk` | `ConvexBetterAuthProvider` | With `@convex-dev/better-auth` | Provider swap in root route |
| Clerk JWT template for Convex | BetterAuth token via `getToken()` | With `@convex-dev/better-auth` | No more Clerk Dashboard JWT config needed |
| Legacy TanStack Start auth middleware | No global middleware needed | With BetterAuth | Auth checked via `beforeLoad` guards, not middleware |
| `better-auth` with Drizzle adapter | `@convex-dev/better-auth` Convex Component | 2025 | Purpose-built Convex integration |

## Open Questions

1. **Exact pinned version of `better-auth`**
   - What we know: Older docs pin `1.5.3`, but current `better-auth` is `1.6.2` and `@convex-dev/better-auth` is `0.11.4`
   - What's unclear: Whether `0.11.4` supports `better-auth@1.6.2` or still requires an older pin
   - Recommendation: Check `@convex-dev/better-auth` package.json peerDependencies at install time; if it errors, pin to the documented version

2. **Cloudflare Workers edge compatibility**
   - What we know: Auth logic runs on Convex, not Workers. But the proxy handler runs in the Worker.
   - What's unclear: Whether `convexBetterAuthReactStart` uses any Node-only APIs
   - Recommendation: Test the proxy route on `wrangler dev` early. If it fails, the handler may need to be a simple `fetch` forwarding instead.

3. **Coexistence with Clerk during migration**
   - What we know: Phase 1 sets up BetterAuth infrastructure; Phase 3 removes Clerk
   - What's unclear: Whether both providers can coexist in `__root.tsx` during the transition
   - Recommendation: In Phase 1, fully replace the auth provider. Clerk packages remain installed but unused until Phase 3 cleanup.

4. **`convex.config.ts` vs current `convex.config.ts`**
   - What we know: Current `convex.config.ts` exists but may not use `defineApp`
   - What's unclear: Whether the existing config needs migration to `defineApp` pattern for component support
   - Recommendation: Check current content; if it doesn't use `defineApp`, update it

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Convex CLI | Component registration | Needs check | -- | `npx convex` |
| Node.js | Build/dev | Yes | ES2022+ | -- |
| pnpm | Package management | Yes | 10.12.4 | -- |

**Missing dependencies with no fallback:**
- None identified -- all infrastructure is cloud-based (Convex) or npm packages

**Missing dependencies with fallback:**
- Convex CLI: Can use `npx convex` if not globally installed

## Sources

### Primary (HIGH confidence)
- [Convex + Better Auth Getting Started](https://labs.convex.dev/better-auth) - Installation, component setup
- [Convex + Better Auth TanStack Start Guide](https://labs.convex.dev/better-auth/framework-guides/tanstack-start) - Framework-specific setup
- [Convex + Better Auth Basic Usage](https://labs.convex.dev/better-auth/basic-usage) - Auth configuration, HTTP routes
- [get-convex/better-auth GitHub repo](https://github.com/get-convex/better-auth) - Official component source and examples
- [get-convex/better-auth TanStack example](https://github.com/get-convex/better-auth/tree/main/examples/tanstack) - Complete working example
- Reference project: `/Users/mac/Developer/projects/mydeffo.com-web` - BetterAuth patterns (Drizzle adapter, not Convex -- used for client patterns only)

### Secondary (MEDIUM confidence)
- [BetterAuth TanStack Start Integration](https://better-auth.com/docs/integrations/tanstack) - Generic TanStack Start setup (not Convex-specific)
- [BetterAuth Convex Integration](https://better-auth.com/docs/integrations/convex) - BetterAuth's own Convex docs
- [Grokipedia: Better Auth with Convex in TanStack Start](https://grokipedia.com/page/Better_Auth_with_Convex_in_TanStack_Start) - Aggregated setup guide
- npm registry: version checks for `better-auth` (1.6.2), `@convex-dev/better-auth` (0.11.4), `convex` (1.35.1)

### Tertiary (LOW confidence)
- [GitHub Issue #7230: SSR auth check on every navigation](https://github.com/better-auth/better-auth/issues/7230) - Performance concern, may be resolved
- [GitHub Issue #237: Difficulty running TanStack example](https://github.com/get-convex/better-auth/issues/237) - Setup issues, may be version-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Convex component with dedicated docs
- Architecture: MEDIUM-HIGH - Based on official docs and examples, but exact code patterns need verification at implementation time
- Pitfalls: MEDIUM - Gathered from GitHub issues and known integration challenges; Cloudflare Workers compat is the main uncertainty

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (30 days -- ecosystem is active but component is reasonably stable)
