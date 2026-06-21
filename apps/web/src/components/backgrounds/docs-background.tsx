import { RouteBackground } from "./route-background";

/**
 * Docs — "the coordinate grid". A static cartographic graph-paper grid sits far
 * behind the reading column at very low opacity, masked to fade out behind body
 * text so it never costs readability. No motion at all (docs are read, not
 * admired) — the calmest member of the background suite, sharing the dotted/grid
 * primitive used on Pricing and Coverage at a lighter dose for brand cohesion.
 */
export function DocsBackground() {
	return (
		<RouteBackground>
			{/* Faint coordinate grid: brighter majors every 96px, fine minors every
			    24px. Masked to a soft pool near the top so dense prose stays clean. */}
			<div className="absolute inset-0 opacity-[0.5] [background-image:linear-gradient(color-mix(in_oklab,var(--foreground)_5%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklab,var(--foreground)_5%,transparent)_1px,transparent_1px),linear-gradient(color-mix(in_oklab,var(--foreground)_2.5%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklab,var(--foreground)_2.5%,transparent)_1px,transparent_1px)] [background-size:96px_96px,96px_96px,24px_24px,24px_24px] [mask-image:radial-gradient(120%_55%_at_50%_0%,#000_25%,transparent_80%)]" />

			{/* A whisper of brand green at the very top edge to tie into the suite. */}
			<div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_oklab,var(--primary)_7%,transparent)_0%,transparent_70%)]" />
		</RouteBackground>
	);
}
