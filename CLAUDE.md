<!-- GSD:project-start source:PROJECT.md -->
## Project

**Wherabouts.com — Clerk to BetterAuth Migration**

Wherabouts.com is an existing application built on TanStack Start + Convex. This project migrates the authentication system from Clerk (hosted, third-party) to BetterAuth (self-hosted, open-source), giving full ownership of auth data and infrastructure. The mydeffo.com-web project serves as architectural inspiration for BetterAuth patterns.

**Core Value:** Users can authenticate seamlessly — login, signup, OAuth, and session persistence must work without disruption after the migration.

### Constraints

- **Stack:** Must remain on TanStack Start + Convex — no framework changes
- **Data storage:** Auth data must be stored in Convex (not a separate DB)
- **Feature parity:** All current Clerk auth features must work identically on BetterAuth
- **Zero Clerk residue:** Full replacement — no Clerk code or dependency should remain
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
