# Hero Section Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build three reviewable hero-section variants (Live Demo, Code Snippet, Capability Grid) behind a dev-only preview route, so the user can compare them in-browser before picking one to ship.

**Architecture:** Extract the existing hero's shared visual primitives (badge, CTAs, background glow, globe backdrop, motion variants) into a `shared.tsx` module. Extract the existing animated address-autocomplete demo into its own `address-demo.tsx` module unchanged in behavior, plus a small pure helper for the new rotating capability tagline. Build two new self-contained visual modules (`code-demo.tsx` for the tabbed request/response panel, `capability-grid.tsx` for the 4-up grid). Compose three variant components (`hero-demo.tsx`, `hero-code.tsx`, `hero-grid.tsx`) from these pieces. Add a thin dev-only route, `_public/hero-preview.tsx`, that reads a `hero` search param via a pure, unit-tested resolver function and renders the matching variant. The existing `hero.tsx` / `index.tsx` are left untouched — wiring a chosen variant into the real homepage is a follow-up, out of scope here.

**Tech Stack:** React 19, TanStack Start/Router (file-based routes, `validateSearch`), Motion (`motion/react`), Tailwind v4, Lucide icons, Vitest + Testing Library (`@vitest-environment jsdom`), Biome/Ultracite.

## Global Constraints

- Tabs/indent: tabs. Quotes: double quotes. Enforced by Ultracite/Biome — run `pnpm dlx ultracite fix` before each commit if unsure.
- Named exports preferred over default exports, except React components default-exported from shadcn-style blocks (existing convention in `hero-15/*`).
- Use `@/` path alias for intra-app imports.
- Use `cn()` from `@/lib/utils` for conditional class composition; never raw string concatenation.
- No new npm dependencies — build with `lucide-react`, `motion/react`, and existing Tailwind utilities already in the codebase.
- No `console.log`/`debugger` statements.
- Dark theme only; verify no broken contrast in new components.
- Every new file must pass `pnpm dlx ultracite check` with no new errors.
- This is a review/preview feature — do not modify `apps/web/src/components/shadcn-space/blocks/hero-15/hero.tsx` or `apps/web/src/routes/index.tsx`.

---

### Task 1: Extract shared hero primitives into `shared.tsx`

**Files:**
- Create: `apps/web/src/components/shadcn-space/blocks/hero-15/variants/shared.tsx`
- Test: `apps/web/src/components/shadcn-space/blocks/hero-15/variants/shared.test.tsx`

**Interfaces:**
- Produces: `heroContainerVariants: Variants`, `heroItemVariants: Variants` (motion variants objects), `HeroBadge({ label }: { label: string })`, `HeroCtas()`, `HeroBackgroundGlow()`, `HeroGlobeBackdrop()` — all named exports.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/shadcn-space/blocks/hero-15/variants/shared.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
	HeroBadge,
	HeroCtas,
} from "./shared.tsx";

afterEach(() => cleanup());

describe("HeroBadge", () => {
	it("renders the provided label text", () => {
		render(<HeroBadge label="Location & geocoding API — US, Australia & expanding" />);
		expect(
			screen.getByText("Location & geocoding API — US, Australia & expanding")
		).toBeInTheDocument();
	});
});

describe("HeroCtas", () => {
	it("renders Get API access and Read the docs links with correct hrefs", () => {
		render(<HeroCtas />);
		const getAccess = screen.getByRole("link", { name: /get api access/i });
		const readDocs = screen.getByRole("link", { name: /read the docs/i });
		expect(getAccess).toHaveAttribute("href", "/sign-up");
		expect(readDocs).toHaveAttribute("href", "/docs");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/components/shadcn-space/blocks/hero-15/variants/shared.test.tsx`
Expected: FAIL with "Cannot find module './shared.tsx'" (file doesn't exist yet)

- [ ] **Step 3: Write the implementation**

```tsx
// apps/web/src/components/shadcn-space/blocks/hero-15/variants/shared.tsx
"use client";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { motion, type Variants } from "motion/react";
import { GlobeDemo } from "@/components/globe-demo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const heroContainerVariants: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.15,
			delayChildren: 0.1,
		},
	},
};

export const heroItemVariants: Variants = {
	hidden: { opacity: 0, y: 20 },
	visible: {
		opacity: 1,
		y: 0,
		transition: {
			duration: 0.8,
			ease: [0.21, 0.47, 0.32, 0.98],
		},
	},
};

export function HeroBadge({ label }: { label: string }) {
	return (
		<motion.div
			className="flex w-fit items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1"
			variants={heroItemVariants}
		>
			<div className="h-1 w-1 rounded-full bg-teal-400" />
			<p className="font-normal text-foreground text-sm">{label}</p>
			<ArrowRight className="text-foreground" size={16} />
		</motion.div>
	);
}

export function HeroCtas() {
	return (
		<motion.div
			className="flex flex-wrap justify-center gap-2 pt-2"
			variants={heroItemVariants}
		>
			<Link
				className={cn(
					buttonVariants({ variant: "default" }),
					"h-auto cursor-pointer rounded-full px-5 py-2.5 md:px-6 md:py-3.5"
				)}
				to="/sign-up"
			>
				Get API access
			</Link>
			<Link
				className={cn(
					buttonVariants({ variant: "outline" }),
					"inline-flex h-auto cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-foreground md:px-6 md:py-3.5"
				)}
				to="/docs"
			>
				Read the docs
				<ArrowRight className="text-foreground" size={16} />
			</Link>
		</motion.div>
	);
}

export function HeroBackgroundGlow() {
	return (
		<div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
			<div className="absolute top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl md:h-72 md:w-72" />
			<div className="absolute bottom-0 left-1/2 h-96 w-208 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.18),rgba(6,32,86,0.04)_52%,transparent_76%)]" />
			<div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-b from-transparent via-background/30 to-background" />
		</div>
	);
}

export function HeroGlobeBackdrop() {
	return (
		<div className="pointer-events-none absolute inset-x-0 -bottom-32 z-0 flex justify-center overflow-hidden opacity-85">
			<GlobeDemo
				className="-translate-x-8 md:-translate-x-12"
				decorative
				globeHeightClassName="h-[20rem] sm:h-[30rem] md:h-[60rem]"
			/>
			<div className="pointer-events-none absolute inset-0 bg-linear-to-b from-background/50 via-transparent to-background" />
		</div>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/components/shadcn-space/blocks/hero-15/variants/shared.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Lint and commit**

```bash
pnpm dlx ultracite fix apps/web/src/components/shadcn-space/blocks/hero-15/variants/shared.tsx apps/web/src/components/shadcn-space/blocks/hero-15/variants/shared.test.tsx
git add apps/web/src/components/shadcn-space/blocks/hero-15/variants/shared.tsx apps/web/src/components/shadcn-space/blocks/hero-15/variants/shared.test.tsx
git commit -m "feat(hero): extract shared hero primitives for variant components"
```

---

### Task 2: Extract the live address demo into `address-demo.tsx` with a capability-tag helper

**Files:**
- Create: `apps/web/src/components/shadcn-space/blocks/hero-15/variants/address-demo.tsx`
- Test: `apps/web/src/components/shadcn-space/blocks/hero-15/variants/address-demo.test.tsx`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `AddressDemoInput({ onScenarioChange }: { onScenarioChange?: (scenarioIndex: number) => void })` (default export), `CAPABILITY_TAGS: readonly string[]`, `getCapabilityTag(scenarioIndex: number): string` — named exports, used by Task 3.

This task moves `AddressDemoInput` and all its supporting code (types, `DEMO_SCENARIOS`, timing constants, phase labels, helper functions, sub-components) verbatim from `apps/web/src/components/shadcn-space/blocks/hero-15/hero.tsx` lines 1-571 into the new file, with one addition: an `onScenarioChange` callback prop fired whenever the scenario index changes, and a new pure helper `getCapabilityTag`.

- [ ] **Step 1: Write the failing test (pure helper only — animation internals are exercised manually per the spec's verification section, not via timer-based unit tests)**

```tsx
// apps/web/src/components/shadcn-space/blocks/hero-15/variants/address-demo.test.tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { CAPABILITY_TAGS, getCapabilityTag } from "./address-demo.tsx";

describe("getCapabilityTag", () => {
	it("returns a tag for index 0", () => {
		expect(getCapabilityTag(0)).toBe(CAPABILITY_TAGS[0]);
	});

	it("wraps around using modulo for out-of-range indexes", () => {
		expect(getCapabilityTag(CAPABILITY_TAGS.length)).toBe(CAPABILITY_TAGS[0]);
		expect(getCapabilityTag(CAPABILITY_TAGS.length + 1)).toBe(
			CAPABILITY_TAGS[1]
		);
	});

	it("exposes at least 3 distinct capability tags", () => {
		expect(CAPABILITY_TAGS.length).toBeGreaterThanOrEqual(3);
		expect(new Set(CAPABILITY_TAGS).size).toBe(CAPABILITY_TAGS.length);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/components/shadcn-space/blocks/hero-15/variants/address-demo.test.tsx`
Expected: FAIL with "Cannot find module './address-demo.tsx'"

- [ ] **Step 3: Write the implementation**

Copy the full content of `apps/web/src/components/shadcn-space/blocks/hero-15/hero.tsx` lines 1-571 (everything from the imports through the closing brace of `AddressDemoInput`) into the new file verbatim, then apply these two changes:

1. Replace the import line `import { GlobeDemo } from "@/components/globe-demo";` — remove it (no longer used in this file).
2. Add the capability-tag helpers and the `onScenarioChange` prop, as shown below (insert near the top, after the existing type/const declarations, and modify `AddressDemoInput`'s signature and effect):

```tsx
// Insert after the DEMO_SCENARIOS declaration (around original line 84):
export const CAPABILITY_TAGS = [
	"Now resolving: address autocomplete",
	"Now resolving: rooftop geocoding",
	"Now resolving: typo-tolerant matching",
] as const satisfies readonly string[];

export function getCapabilityTag(scenarioIndex: number): string {
	const normalizedIndex =
		((scenarioIndex % CAPABILITY_TAGS.length) + CAPABILITY_TAGS.length) %
		CAPABILITY_TAGS.length;
	return CAPABILITY_TAGS[normalizedIndex];
}
```

```tsx
// Modify the AddressDemoInput function signature (originally `function AddressDemoInput() {`):
interface AddressDemoInputProps {
	onScenarioChange?: (scenarioIndex: number) => void;
}

export default function AddressDemoInput({
	onScenarioChange,
}: AddressDemoInputProps) {
	// ...unchanged body...

	// Inside the existing useEffect, after `setScenarioIndex(nextScenarioIndex)`-equivalent
	// line is invoked by playDemoScenario via its setScenarioIndex callback, wrap that
	// callback so it also notifies the parent:
```

Concretely, change the `setScenarioIndex` argument passed into `playDemoScenario` from the bare state setter to a wrapper:

```tsx
await playDemoScenario({
	isCancelled,
	scenario,
	scenarioIndex: currentScenarioIndex,
	setHighlightedIndex,
	setIsPanelOpen,
	setPhase,
	setScenarioIndex: (nextIndex: number) => {
		setScenarioIndex(nextIndex);
		onScenarioChange?.(nextIndex);
	},
	setSelectedIndex,
	setValue,
});
```

Also call `onScenarioChange?.(0)` once synchronously before the loop starts (mirroring the existing `let nextScenarioIndex = 0;` initialization), so consumers get an initial value even before the first scenario completes:

```tsx
const task = async () => {
	onScenarioChange?.(0);
	while (!isCancelled()) {
		// ...unchanged...
	}
};
```

Keep every other line (the demo scenarios, timing constants, sub-components `DemoSuggestionRow`, `DemoSuggestionsPanel`, helper functions) exactly as in the original file.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/components/shadcn-space/blocks/hero-15/variants/address-demo.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Lint and commit**

```bash
pnpm dlx ultracite fix apps/web/src/components/shadcn-space/blocks/hero-15/variants/address-demo.tsx apps/web/src/components/shadcn-space/blocks/hero-15/variants/address-demo.test.tsx
git add apps/web/src/components/shadcn-space/blocks/hero-15/variants/address-demo.tsx apps/web/src/components/shadcn-space/blocks/hero-15/variants/address-demo.test.tsx
git commit -m "feat(hero): extract address demo into reusable module with capability tags"
```

---

### Task 3: Build Variant A — `hero-demo.tsx`

**Files:**
- Create: `apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-demo.tsx`
- Test: `apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-demo.test.tsx`

**Interfaces:**
- Consumes: `heroContainerVariants`, `heroItemVariants`, `HeroBadge`, `HeroCtas`, `HeroBackgroundGlow`, `HeroGlobeBackdrop` (Task 1); `AddressDemoInput`, `getCapabilityTag` (Task 2).
- Produces: `HeroDemoVariant()` default export, consumed by Task 8 (the preview route).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-demo.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HeroDemoVariant from "./hero-demo.tsx";

afterEach(() => cleanup());

describe("HeroDemoVariant", () => {
	it("renders the headline, badge, and CTAs", () => {
		render(<HeroDemoVariant />);
		expect(
			screen.getByText(/production-ready apis for every location workflow/i)
		).toBeInTheDocument();
		expect(
			screen.getByText(/location & geocoding api/i)
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /get api access/i })
		).toBeInTheDocument();
	});

	it("renders the live address search demo", () => {
		render(<HeroDemoVariant />);
		expect(
			screen.getByLabelText(/example address autocomplete/i)
		).toBeInTheDocument();
	});

	it("renders an initial capability tag", () => {
		render(<HeroDemoVariant />);
		expect(screen.getByText(/now resolving:/i)).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/components/shadcn-space/blocks/hero-15/variants/hero-demo.test.tsx`
Expected: FAIL with "Cannot find module './hero-demo.tsx'"

- [ ] **Step 3: Write the implementation**

```tsx
// apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-demo.tsx
"use client";
import { motion } from "motion/react";
import { useState } from "react";
import AddressDemoInput, { getCapabilityTag } from "./address-demo.tsx";
import {
	HeroBackgroundGlow,
	HeroBadge,
	HeroCtas,
	HeroGlobeBackdrop,
	heroContainerVariants,
	heroItemVariants,
} from "./shared.tsx";

export default function HeroDemoVariant() {
	const [scenarioIndex, setScenarioIndex] = useState(0);

	return (
		<section className="relative" id="top">
			<motion.div
				animate="visible"
				className="relative mx-auto flex min-h-[70vh] max-w-7xl flex-col items-center justify-center gap-3 px-4 py-6 text-center md:min-h-[85vh] md:gap-6 md:py-14 lg:px-8 xl:px-16"
				initial="hidden"
				variants={heroContainerVariants}
			>
				<HeroBackgroundGlow />

				<div className="relative z-10 flex max-w-3xl flex-col items-center justify-center gap-3 text-center md:gap-4">
					<HeroBadge label="Location & geocoding API — US, Australia & expanding" />
					<div className="flex flex-col items-center gap-3 text-center">
						<motion.h1
							className="max-w-7xl overflow-visible text-wrap text-balance rounded-[1rem] border border-white/10 bg-background/70 px-3 py-2 text-center font-normal text-foreground text-lg tracking-tight shadow-[0_28px_90px_-52px_rgba(0,0,0,1)] ring-1 ring-white/5 backdrop-blur-xl sm:text-xl md:px-4 md:py-3 md:text-2xl"
							variants={heroItemVariants}
						>
							Production-ready APIs for every location workflow
						</motion.h1>
						<motion.p
							className="max-w-2xl text-pretty font-normal text-foreground text-sm sm:text-base md:text-lg"
							variants={heroItemVariants}
						>
							Address autocomplete, geocoding, geofencing, routing, device
							tracking, and webhooks — ship location features without the
							complexity.
						</motion.p>
					</div>
					<motion.div
						className="w-full max-w-2xl pt-2 md:pt-4"
						variants={heroItemVariants}
					>
						<AddressDemoInput onScenarioChange={setScenarioIndex} />
						<p className="mt-3 text-center font-medium text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
							{getCapabilityTag(scenarioIndex)}
						</p>
					</motion.div>
				</div>
				<HeroCtas />
				<HeroGlobeBackdrop />
			</motion.div>
		</section>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/components/shadcn-space/blocks/hero-15/variants/hero-demo.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Lint and commit**

```bash
pnpm dlx ultracite fix apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-demo.tsx apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-demo.test.tsx
git add apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-demo.tsx apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-demo.test.tsx
git commit -m "feat(hero): build Variant A live-demo hero with rotating capability tag"
```

---

### Task 4: Build the tabbed code-snippet panel — `code-demo.tsx`

**Files:**
- Create: `apps/web/src/components/shadcn-space/blocks/hero-15/variants/code-demo.tsx`
- Test: `apps/web/src/components/shadcn-space/blocks/hero-15/variants/code-demo.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `CODE_TABS: readonly CodeTab[]` (with `CodeTab = { id: string; label: string; method: "GET" | "POST"; path: string; response: string }`), `CodeDemoPanel()` default export, consumed by Task 5.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/shadcn-space/blocks/hero-15/variants/code-demo.test.tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CODE_TABS, default as CodeDemoPanel } from "./code-demo.tsx";

afterEach(() => cleanup());

describe("CODE_TABS", () => {
	it("defines at least 3 endpoints with unique ids", () => {
		expect(CODE_TABS.length).toBeGreaterThanOrEqual(3);
		expect(new Set(CODE_TABS.map((tab) => tab.id)).size).toBe(
			CODE_TABS.length
		);
	});
});

describe("CodeDemoPanel", () => {
	it("renders all tab labels and the first tab's response by default", () => {
		render(<CodeDemoPanel />);
		for (const tab of CODE_TABS) {
			expect(screen.getByRole("tab", { name: tab.label })).toBeInTheDocument();
		}
		expect(screen.getByText(CODE_TABS[0].path)).toBeInTheDocument();
	});

	it("switches the displayed response when a tab is clicked", () => {
		render(<CodeDemoPanel />);
		fireEvent.click(screen.getByRole("tab", { name: CODE_TABS[1].label }));
		expect(screen.getByText(CODE_TABS[1].path)).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/components/shadcn-space/blocks/hero-15/variants/code-demo.test.tsx`
Expected: FAIL with "Cannot find module './code-demo.tsx'"

- [ ] **Step 3: Write the implementation**

```tsx
// apps/web/src/components/shadcn-space/blocks/hero-15/variants/code-demo.tsx
"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface CodeTab {
	id: string;
	label: string;
	method: "GET" | "POST";
	path: string;
	response: string;
}

export const CODE_TABS: readonly CodeTab[] = [
	{
		id: "autocomplete",
		label: "Autocomplete",
		method: "GET",
		path: "/v1/addresses/autocomplete?query=1600+Amphitheatre",
		response: `{
  "results": [
    {
      "label": "1600 Amphitheatre Pkwy, Mountain View, CA 94043",
      "confidence": "exact"
    }
  ]
}`,
	},
	{
		id: "geocode",
		label: "Geocode",
		method: "GET",
		path: "/v1/addresses/geocode?query=10+Downing+St,+London",
		response: `{
  "lat": 51.503396,
  "lon": -0.127764,
  "formattedAddress": "10 Downing St, London SW1A 2AA"
}`,
	},
	{
		id: "geofence",
		label: "Geofence check",
		method: "POST",
		path: "/v1/geofences/check",
		response: `{
  "inside": true,
  "geofenceId": "warehouse-12",
  "distanceMeters": 0
}`,
	},
] as const satisfies readonly CodeTab[];

const TAB_CYCLE_MS = 4000;

export default function CodeDemoPanel() {
	const [activeId, setActiveId] = useState(CODE_TABS[0].id);

	useEffect(() => {
		const intervalId = setInterval(() => {
			setActiveId((currentId) => {
				const currentIndex = CODE_TABS.findIndex(
					(tab) => tab.id === currentId
				);
				const nextIndex = (currentIndex + 1) % CODE_TABS.length;
				return CODE_TABS[nextIndex].id;
			});
		}, TAB_CYCLE_MS);

		return () => clearInterval(intervalId);
	}, []);

	const activeTab =
		CODE_TABS.find((tab) => tab.id === activeId) ?? CODE_TABS[0];

	return (
		<div className="w-full max-w-xl overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.82))] shadow-[0_34px_90px_-48px_rgba(0,0,0,1)] backdrop-blur-xl">
			<div className="flex items-center gap-1 border-b border-white/10 px-2 pt-2">
				{CODE_TABS.map((tab) => (
					<button
						aria-selected={tab.id === activeId}
						className={cn(
							"rounded-t-lg px-3 py-2 font-medium text-xs transition-colors",
							tab.id === activeId
								? "bg-white/8 text-foreground"
								: "text-muted-foreground hover:text-foreground"
						)}
						key={tab.id}
						onClick={() => setActiveId(tab.id)}
						role="tab"
						type="button"
					>
						{tab.label}
					</button>
				))}
			</div>
			<div className="px-4 py-4 text-left">
				<p className="font-mono text-[11px] text-cyan-300">
					{activeTab.method} {activeTab.path}
				</p>
				<pre className="mt-3 overflow-x-auto font-mono text-[12px] text-foreground/90">
					{activeTab.response}
				</pre>
			</div>
		</div>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/components/shadcn-space/blocks/hero-15/variants/code-demo.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Lint and commit**

```bash
pnpm dlx ultracite fix apps/web/src/components/shadcn-space/blocks/hero-15/variants/code-demo.tsx apps/web/src/components/shadcn-space/blocks/hero-15/variants/code-demo.test.tsx
git add apps/web/src/components/shadcn-space/blocks/hero-15/variants/code-demo.tsx apps/web/src/components/shadcn-space/blocks/hero-15/variants/code-demo.test.tsx
git commit -m "feat(hero): build tabbed code-snippet demo panel for Variant B"
```

---

### Task 5: Build Variant B — `hero-code.tsx`

**Files:**
- Create: `apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-code.tsx`
- Test: `apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-code.test.tsx`

**Interfaces:**
- Consumes: `heroContainerVariants`, `heroItemVariants`, `HeroBadge`, `HeroCtas`, `HeroBackgroundGlow` (Task 1); `CodeDemoPanel` (Task 4).
- Produces: `HeroCodeVariant()` default export, consumed by Task 8.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-code.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HeroCodeVariant from "./hero-code.tsx";

afterEach(() => cleanup());

describe("HeroCodeVariant", () => {
	it("renders the headline, badge, CTAs, and code panel", () => {
		render(<HeroCodeVariant />);
		expect(
			screen.getByText(/production-ready apis for every location workflow/i)
		).toBeInTheDocument();
		expect(
			screen.getByText(/location & geocoding api/i)
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /get api access/i })
		).toBeInTheDocument();
		expect(
			screen.getByRole("tab", { name: /autocomplete/i })
		).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/components/shadcn-space/blocks/hero-15/variants/hero-code.test.tsx`
Expected: FAIL with "Cannot find module './hero-code.tsx'"

- [ ] **Step 3: Write the implementation**

```tsx
// apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-code.tsx
"use client";
import { motion } from "motion/react";
import CodeDemoPanel from "./code-demo.tsx";
import {
	HeroBackgroundGlow,
	HeroBadge,
	HeroCtas,
	heroContainerVariants,
	heroItemVariants,
} from "./shared.tsx";

export default function HeroCodeVariant() {
	return (
		<section className="relative" id="top">
			<motion.div
				animate="visible"
				className="relative mx-auto flex min-h-[70vh] max-w-7xl flex-col items-center justify-center gap-8 px-4 py-6 md:min-h-[85vh] md:py-14 lg:flex-row lg:gap-12 lg:px-8 xl:px-16"
				initial="hidden"
				variants={heroContainerVariants}
			>
				<HeroBackgroundGlow />

				<div className="relative z-10 flex max-w-xl flex-col items-center gap-3 text-center md:gap-4 lg:items-start lg:text-left">
					<HeroBadge label="Location & geocoding API — US, Australia & expanding" />
					<motion.h1
						className="text-balance font-normal text-foreground text-2xl tracking-tight md:text-3xl"
						variants={heroItemVariants}
					>
						Production-ready APIs for every location workflow
					</motion.h1>
					<motion.p
						className="max-w-lg text-pretty font-normal text-foreground text-sm sm:text-base md:text-lg"
						variants={heroItemVariants}
					>
						Address autocomplete, geocoding, geofencing, routing, device
						tracking, and webhooks — ship location features without the
						complexity.
					</motion.p>
					<HeroCtas />
				</div>

				<motion.div
					className="relative z-10 flex w-full max-w-xl justify-center"
					variants={heroItemVariants}
				>
					<CodeDemoPanel />
				</motion.div>
			</motion.div>
		</section>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/components/shadcn-space/blocks/hero-15/variants/hero-code.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Lint and commit**

```bash
pnpm dlx ultracite fix apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-code.tsx apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-code.test.tsx
git add apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-code.tsx apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-code.test.tsx
git commit -m "feat(hero): build Variant B split code-snippet hero"
```

---

### Task 6: Build the capability grid — `capability-grid.tsx`

**Files:**
- Create: `apps/web/src/components/shadcn-space/blocks/hero-15/variants/capability-grid.tsx`
- Test: `apps/web/src/components/shadcn-space/blocks/hero-15/variants/capability-grid.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `CAPABILITIES: readonly Capability[]` (with `Capability = { id: string; title: string; description: string }`), `CapabilityGrid()` default export, consumed by Task 7.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/shadcn-space/blocks/hero-15/variants/capability-grid.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CAPABILITIES, default as CapabilityGrid } from "./capability-grid.tsx";

afterEach(() => cleanup());

describe("CAPABILITIES", () => {
	it("defines exactly 4 capabilities with unique ids", () => {
		expect(CAPABILITIES).toHaveLength(4);
		expect(new Set(CAPABILITIES.map((cap) => cap.id)).size).toBe(4);
	});
});

describe("CapabilityGrid", () => {
	it("renders a card for every capability", () => {
		render(<CapabilityGrid />);
		for (const capability of CAPABILITIES) {
			expect(screen.getByText(capability.title)).toBeInTheDocument();
			expect(screen.getByText(capability.description)).toBeInTheDocument();
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/components/shadcn-space/blocks/hero-15/variants/capability-grid.test.tsx`
Expected: FAIL with "Cannot find module './capability-grid.tsx'"

- [ ] **Step 3: Write the implementation**

```tsx
// apps/web/src/components/shadcn-space/blocks/hero-15/variants/capability-grid.tsx
import { MapPin, Navigation, Radar, Shapes } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Capability {
	id: string;
	title: string;
	description: string;
	icon: LucideIcon;
}

export const CAPABILITIES: readonly Capability[] = [
	{
		id: "geocoding",
		title: "Geocoding",
		description: "Resolve any address to a rooftop-accurate lat/lon.",
		icon: MapPin,
	},
	{
		id: "geofencing",
		title: "Geofencing",
		description: "Trigger events the instant a user enters or exits a zone.",
		icon: Shapes,
	},
	{
		id: "routing",
		title: "Routing",
		description: "Calculate optimal routes and travel times between points.",
		icon: Navigation,
	},
	{
		id: "tracking",
		title: "Device tracking",
		description: "Stream live device locations with low-latency webhooks.",
		icon: Radar,
	},
] as const satisfies readonly Capability[];

export default function CapabilityGrid() {
	return (
		<div className="grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{CAPABILITIES.map((capability) => {
				const Icon = capability.icon;
				return (
					<div
						className="flex flex-col items-start gap-2 rounded-[1.25rem] border border-white/10 bg-background/70 p-4 text-left shadow-[0_18px_40px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl"
						key={capability.id}
					>
						<div className="flex size-9 items-center justify-center rounded-full border border-border/70 bg-background/60 text-foreground">
							<Icon className="size-4" />
						</div>
						<p className="font-medium text-foreground text-sm">
							{capability.title}
						</p>
						<p className="text-muted-foreground text-xs">
							{capability.description}
						</p>
					</div>
				);
			})}
		</div>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/components/shadcn-space/blocks/hero-15/variants/capability-grid.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Lint and commit**

```bash
pnpm dlx ultracite fix apps/web/src/components/shadcn-space/blocks/hero-15/variants/capability-grid.tsx apps/web/src/components/shadcn-space/blocks/hero-15/variants/capability-grid.test.tsx
git add apps/web/src/components/shadcn-space/blocks/hero-15/variants/capability-grid.tsx apps/web/src/components/shadcn-space/blocks/hero-15/variants/capability-grid.test.tsx
git commit -m "feat(hero): build 4-up capability grid for Variant C"
```

---

### Task 7: Build Variant C — `hero-grid.tsx`

**Files:**
- Create: `apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-grid.tsx`
- Test: `apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-grid.test.tsx`

**Interfaces:**
- Consumes: `heroContainerVariants`, `heroItemVariants`, `HeroBadge`, `HeroCtas`, `HeroBackgroundGlow` (Task 1); `CapabilityGrid` (Task 6).
- Produces: `HeroGridVariant()` default export, consumed by Task 8.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-grid.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CAPABILITIES } from "./capability-grid.tsx";
import HeroGridVariant from "./hero-grid.tsx";

afterEach(() => cleanup());

describe("HeroGridVariant", () => {
	it("renders the headline, badge, CTAs, and all capability cards", () => {
		render(<HeroGridVariant />);
		expect(
			screen.getByText(/production-ready apis for every location workflow/i)
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /get api access/i })
		).toBeInTheDocument();
		for (const capability of CAPABILITIES) {
			expect(screen.getByText(capability.title)).toBeInTheDocument();
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/components/shadcn-space/blocks/hero-15/variants/hero-grid.test.tsx`
Expected: FAIL with "Cannot find module './hero-grid.tsx'"

- [ ] **Step 3: Write the implementation**

```tsx
// apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-grid.tsx
"use client";
import { motion } from "motion/react";
import CapabilityGrid from "./capability-grid.tsx";
import {
	HeroBackgroundGlow,
	HeroBadge,
	HeroCtas,
	heroContainerVariants,
	heroItemVariants,
} from "./shared.tsx";

export default function HeroGridVariant() {
	return (
		<section className="relative" id="top">
			<motion.div
				animate="visible"
				className="relative mx-auto flex min-h-[70vh] max-w-7xl flex-col items-center justify-center gap-6 px-4 py-6 text-center md:min-h-[85vh] md:gap-8 md:py-14 lg:px-8 xl:px-16"
				initial="hidden"
				variants={heroContainerVariants}
			>
				<HeroBackgroundGlow />

				<div className="relative z-10 flex max-w-2xl flex-col items-center gap-3 text-center md:gap-4">
					<HeroBadge label="Location & geocoding API — US, Australia & expanding" />
					<motion.h1
						className="text-balance font-normal text-foreground text-2xl tracking-tight md:text-3xl"
						variants={heroItemVariants}
					>
						Production-ready APIs for every location workflow
					</motion.h1>
					<motion.p
						className="max-w-xl text-pretty font-normal text-foreground text-sm sm:text-base md:text-lg"
						variants={heroItemVariants}
					>
						One API platform covering address autocomplete, geocoding,
						geofencing, routing, and device tracking.
					</motion.p>
					<HeroCtas />
				</div>

				<motion.div className="relative z-10 w-full" variants={heroItemVariants}>
					<CapabilityGrid />
				</motion.div>
			</motion.div>
		</section>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/components/shadcn-space/blocks/hero-15/variants/hero-grid.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Lint and commit**

```bash
pnpm dlx ultracite fix apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-grid.tsx apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-grid.test.tsx
git add apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-grid.tsx apps/web/src/components/shadcn-space/blocks/hero-15/variants/hero-grid.test.tsx
git commit -m "feat(hero): build Variant C capability-grid hero"
```

---

### Task 8: Build the preview route with a pure, tested variant resolver

**Files:**
- Create: `apps/web/src/lib/hero-preview-variant.ts`
- Create: `apps/web/src/routes/_public/hero-preview.tsx`
- Test: `apps/web/src/lib/hero-preview-variant.test.ts`

**Interfaces:**
- Consumes: `HeroDemoVariant` (Task 3), `HeroCodeVariant` (Task 5), `HeroGridVariant` (Task 7).
- Produces: `resolveHeroVariant(search: Record<string, unknown>): HeroPreviewSearch` where `HeroPreviewSearch = { hero: "demo" | "code" | "grid" }`. Nothing downstream consumes this — it's the final task.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/hero-preview-variant.test.ts
import { describe, expect, it } from "vitest";
import { resolveHeroVariant } from "./hero-preview-variant.ts";

describe("resolveHeroVariant", () => {
	it("defaults to demo when no hero param is given", () => {
		expect(resolveHeroVariant({})).toEqual({ hero: "demo" });
	});

	it("accepts demo, code, and grid", () => {
		expect(resolveHeroVariant({ hero: "demo" })).toEqual({ hero: "demo" });
		expect(resolveHeroVariant({ hero: "code" })).toEqual({ hero: "code" });
		expect(resolveHeroVariant({ hero: "grid" })).toEqual({ hero: "grid" });
	});

	it("falls back to demo for an unrecognized value", () => {
		expect(resolveHeroVariant({ hero: "not-a-variant" })).toEqual({
			hero: "demo",
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/lib/hero-preview-variant.test.ts`
Expected: FAIL with "Cannot find module './hero-preview-variant.ts'"

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/lib/hero-preview-variant.ts
export type HeroVariantId = "demo" | "code" | "grid";

export interface HeroPreviewSearch {
	hero: HeroVariantId;
}

const VALID_VARIANTS: readonly HeroVariantId[] = ["demo", "code", "grid"];

function isHeroVariantId(value: unknown): value is HeroVariantId {
	return (
		typeof value === "string" &&
		VALID_VARIANTS.includes(value as HeroVariantId)
	);
}

export function resolveHeroVariant(
	search: Record<string, unknown>
): HeroPreviewSearch {
	if (isHeroVariantId(search.hero)) {
		return { hero: search.hero };
	}
	return { hero: "demo" };
}
```

```tsx
// apps/web/src/routes/_public/hero-preview.tsx
import { createFileRoute } from "@tanstack/react-router";
import CodeDemoVariant from "@/components/shadcn-space/blocks/hero-15/variants/hero-code.tsx";
import HeroDemoVariant from "@/components/shadcn-space/blocks/hero-15/variants/hero-demo.tsx";
import HeroGridVariant from "@/components/shadcn-space/blocks/hero-15/variants/hero-grid.tsx";
import { resolveHeroVariant } from "@/lib/hero-preview-variant.ts";

export const Route = createFileRoute("/_public/hero-preview")({
	component: RouteComponent,
	validateSearch: resolveHeroVariant,
});

function RouteComponent() {
	const { hero } = Route.useSearch();

	if (hero === "code") {
		return <CodeDemoVariant />;
	}

	if (hero === "grid") {
		return <HeroGridVariant />;
	}

	return <HeroDemoVariant />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/lib/hero-preview-variant.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Regenerate the route tree, typecheck, and manually verify in the browser**

```bash
pnpm --filter web exec tsr generate
pnpm --filter web exec tsc --noEmit
pnpm --filter web dev
```

With the dev server running, open each of the following in a browser and confirm the hero renders, animations run, and both CTAs link correctly:
- `http://localhost:3001/hero-preview` (defaults to Variant A — Live Demo)
- `http://localhost:3001/hero-preview?hero=demo`
- `http://localhost:3001/hero-preview?hero=code`
- `http://localhost:3001/hero-preview?hero=grid`

Check responsive behavior by resizing the viewport to mobile (~375px), tablet (~768px), and desktop (~1440px) widths for each variant.

- [ ] **Step 6: Run the full test suite and lint, then commit**

```bash
pnpm --filter web exec vitest run src/components/shadcn-space/blocks/hero-15/variants src/lib/hero-preview-variant.test.ts
pnpm dlx ultracite fix apps/web/src/lib/hero-preview-variant.ts apps/web/src/routes/_public/hero-preview.tsx apps/web/src/lib/hero-preview-variant.test.ts
git add apps/web/src/lib/hero-preview-variant.ts apps/web/src/routes/_public/hero-preview.tsx apps/web/src/lib/hero-preview-variant.test.ts apps/web/src/routeTree.gen.ts
git commit -m "feat(hero): add dev preview route for comparing hero variants"
```

---

## Self-Review Notes

- **Spec coverage:** Variant A (Task 3), Variant B (Tasks 4-5), Variant C (Tasks 6-7), shared chrome (Task 1), preview route with default + 3 variant params (Task 8) — all spec sections covered. SEO work is explicitly out of scope per the spec and not included here.
- **Type consistency:** `getCapabilityTag(scenarioIndex: number): string` (Task 2) is consumed with matching signature in Task 3. `CodeTab`/`CODE_TABS` (Task 4) and `Capability`/`CAPABILITIES` (Task 6) types are consumed as-defined in Tasks 5 and 7. `resolveHeroVariant` return shape `{ hero: HeroVariantId }` matches `Route.useSearch()` usage in Task 8.
- **No placeholders:** every step has complete, runnable code; no TODOs.
