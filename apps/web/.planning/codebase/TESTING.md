# Testing Patterns

**Analysis Date:** 2026-04-12

## Test Framework

**Runner:**
- No test runner is currently configured or in use
- Dev dependencies include `@testing-library/dom` (^10.4.0) and `@testing-library/react` (^16.2.0) in `apps/web/package.json`
- Dev dependencies include `jsdom` (^26.0.0) -- suggests Vitest with jsdom environment was intended
- No `vitest.config.ts`, `jest.config.ts`, or equivalent test configuration file exists

**Assertion Library:**
- Not configured (Vitest's built-in `expect` would be the natural choice given the Vite toolchain)

**Run Commands:**
```bash
# No test scripts defined in package.json
# Recommended setup when tests are added:
pnpm vitest              # Run all tests
pnpm vitest --watch      # Watch mode
pnpm vitest --coverage   # Coverage
```

## Test File Organization

**Location:**
- No test files exist anywhere in the project source (`apps/web/src/`, `packages/`)
- No `__tests__/` directories exist
- No `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or `*.spec.tsx` files in source

**Recommended pattern** (based on project toolchain):
- Co-locate tests next to source files: `src/lib/api-key-auth.test.ts`
- Use `.test.ts` suffix for unit tests
- Use `.test.tsx` suffix for component tests

**Recommended structure:**
```
src/
├── lib/
│   ├── api-key-auth.ts
│   ├── api-key-auth.test.ts       # Unit tests for auth logic
│   ├── nav-item-matches-path.ts
│   └── nav-item-matches-path.test.ts
├── components/
│   ├── app-sidebar.tsx
│   └── app-sidebar.test.tsx       # Component tests
└── routes/
    └── api/v1/addresses/
        ├── autocomplete.ts
        └── autocomplete.test.ts   # API handler tests
```

## Test Structure

**Suite Organization:**
- Not yet established. Recommended pattern for this codebase:

```typescript
import { describe, expect, it } from "vitest";
import { parseApiKeyFromRequest, validateApiKey } from "./api-key-auth";

describe("parseApiKeyFromRequest", () => {
  it("extracts token from Authorization Bearer header", () => {
    const request = new Request("https://example.com", {
      headers: { Authorization: "Bearer wh_abc123_secret" },
    });
    expect(parseApiKeyFromRequest(request)).toBe("wh_abc123_secret");
  });

  it("returns null when no auth header present", () => {
    const request = new Request("https://example.com");
    expect(parseApiKeyFromRequest(request)).toBeNull();
  });
});
```

## Mocking

**Framework:**
- Not established. Vitest's built-in `vi.mock()` is recommended.

**What to mock:**
- Clerk `auth()` calls in server functions (`src/lib/dashboard-server.ts`, `src/lib/api-keys-server.ts`)
- Database queries via `getDb()` singleton (`src/lib/db.ts`)
- `node:crypto` functions (`randomBytes`, `scryptSync`, `timingSafeEqual`) for deterministic tests

**Recommended mock patterns:**
```typescript
import { vi, describe, it, expect } from "vitest";

// Mock Clerk auth
vi.mock("@clerk/tanstack-react-start/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "user_test123" }),
}));

// Mock database
vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  }),
}));
```

**What NOT to mock:**
- Pure utility functions (`cn()`, `navItemMatchesPath()`, `formatApiKeyDisplaySuffix()`)
- Zod validation schemas (test them with real data)
- Type definitions and interfaces

## Fixtures and Factories

**Test Data:**
- Not established. Key entities that would need fixtures:

```typescript
// Recommended: src/test/fixtures.ts
export const testApiKey = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  clerkUserId: "user_test123",
  name: "Test Key",
  secretHash: "testhash",
  secretSalt: "testsalt",
  secretDisplaySuffix: "abcd",
  createdAt: new Date("2026-01-01"),
  lastUsedAt: null,
  revokedAt: null,
};

export const testDashboardStats: DashboardStats = {
  activeKeys: 2,
  totalRequests: 1500,
  recentRequests: 450,
  endpointBreakdown: [
    { endpoint: "addresses.autocomplete", count: 300 },
    { endpoint: "addresses.reverse", count: 150 },
  ],
  recentKeys: [],
};
```

**Location:**
- No fixture files exist. Recommended: `src/test/fixtures.ts` or co-located with test files.

## Coverage

**Requirements:** None enforced

**Recommended setup:**
```bash
# Add to package.json scripts:
"test": "vitest",
"test:coverage": "vitest --coverage"
```

## Test Types

**Unit Tests:**
- Not yet written. Highest-value targets for unit tests:
  - `src/lib/api-key-auth.ts` - pure crypto/validation logic (parseApiKeyFromRequest, hashApiKeySecret, formatApiKeyDisplaySuffix, generateApiKeySecretPart)
  - `src/lib/nav-item-matches-path.ts` - pure path matching logic
  - `src/lib/utils.ts` - cn() utility

**Integration Tests:**
- Not yet written. Key candidates:
  - `src/lib/dashboard-server.ts` - server functions with DB + auth
  - `src/lib/api-keys-server.ts` - CRUD server functions
  - `src/lib/with-api-key.ts` - API key middleware wrapper
  - `src/routes/api/v1/addresses/*.ts` - API endpoint handlers

**E2E Tests:**
- Not configured. No Playwright or Cypress setup detected.

**Component Tests:**
- Not yet written. Testing Library is installed but unused.
- Key candidates:
  - `src/components/app-sidebar.tsx` - navigation rendering
  - `src/routes/_protected/dashboard.tsx` - loading/empty/data states

## Recommended Vitest Configuration

When tests are added, create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

## Priority Test Targets

Files with the most testable pure logic (no mocking needed):

1. **`src/lib/api-key-auth.ts`** - `parseApiKeyFromRequest`, `hashApiKeySecret`, `formatApiKeyDisplaySuffix`, `generateApiKeySecretPart` are all pure functions
2. **`src/lib/nav-item-matches-path.ts`** - single pure function with clear edge cases
3. **`src/lib/utils.ts`** - `cn()` class merging utility

Files requiring mocks but high value:

4. **`src/lib/with-api-key.ts`** - middleware pattern, mock db + auth
5. **`src/lib/api-keys-server.ts`** - CRUD operations, mock db + Clerk auth
6. **`src/lib/dashboard-server.ts`** - aggregation queries, mock db + Clerk auth

---

*Testing analysis: 2026-04-12*
