<!-- GSD:project-start source:PROJECT.md -->
## Project

**Wherabouts.com — BetterAuth Migration**

Wherabouts.com is an existing application built on TanStack Start. Authentication uses BetterAuth (self-hosted, open-source), with auth data persisted to **Postgres (Neon) via Drizzle ORM** — see `packages/database/src/schema/auth.ts`. The mydeffo.com-web project serves as architectural inspiration for BetterAuth patterns.

> Note: An earlier plan scoped auth storage to Convex. That direction was abandoned due to complexity; there is no `convex/` directory and no Convex dependency in the repo.

**Core Value:** Users can authenticate seamlessly — login, signup, OAuth, and session persistence must work without disruption.

### Constraints

- **Stack:** TanStack Start on the web app, Cloudflare Workers (`apps/server`) on the API — no framework changes.
- **Data storage:** Auth data is stored in Postgres on Neon, managed via Drizzle migrations (`packages/database/drizzle/*`).
- **Feature parity:** Existing auth features must work identically on BetterAuth.
- **Zero legacy auth residue:** Full replacement — no legacy auth code or dependency should remain.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
