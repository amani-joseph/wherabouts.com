import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LANDING_FILES = [
	"components/shadcn-space/blocks/hero-15/hero.tsx",
	"components/shadcn-space/blocks/hero-15/index.tsx",
	"components/shadcn-space/blocks/integration-01/integration.tsx",
	"components/shadcn-space/blocks/feature-15/feature.tsx",
	"components/shadcn-space/blocks/footer-02/footer.tsx",
	"components/landing/capabilities.tsx",
	"components/landing/api-in-action.tsx",
	"routes/index.tsx",
];

describe("landing page content truth", () => {
	for (const rel of LANDING_FILES) {
		const source = readFileSync(join(ROOT, rel), "utf8");

		it(`${rel} has no shadcnspace placeholder assets`, () => {
			expect(source).not.toContain("images.shadcnspace.com");
		});

		it(`${rel} has no dead "#" anchors`, () => {
			expect(source).not.toContain('href="#"');
		});
	}
});
