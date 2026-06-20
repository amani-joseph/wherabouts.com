import type { NavigationSection } from "@/components/shadcn-space/blocks/hero-15/navbar";

// Shared top-nav source of truth for both the landing hero and the
// `_public` layout (pricing, coverage) so the marketing nav stays in sync.
export const navigationData: NavigationSection[] = [
	{
		name: "Dashboard",
		href: "/dashboard",
	},
	{
		name: "Why Wherabouts",
		href: "#why",
		isActive: true,
	},
	{
		name: "Capabilities",
		href: "#capabilities",
	},
	{
		name: "API",
		href: "#api",
	},
	{
		name: "Docs",
		href: "/docs",
	},
	{
		name: "Pricing",
		href: "/pricing",
	},
];
