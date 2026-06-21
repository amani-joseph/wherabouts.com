import { RouteBackground } from "./route-background";

/**
 * Pricing — "the control room". A soft spotlight rakes in from the top so the
 * single pricing card reads as the lit focal point, over a faint graticule of
 * brand-green dots. Pure CSS (SSR-safe, no canvas); motion is a slow ambient
 * drift that the global reduced-motion net + `motion-safe:` neutralise.
 *
 * Colors come from theme tokens (`--primary` = brand green, hue 162) so the
 * effect tracks the design system instead of hardcoded hex.
 */
export function PricingBackground() {
	return (
		<RouteBackground>
			{/* z-0 — base vertical wash from graphite to the page background. */}
			<div className="absolute inset-0 bg-[radial-gradient(125%_90%_at_50%_-20%,color-mix(in_oklab,var(--primary)_8%,var(--background))_0%,var(--background)_55%)]" />

			{/* z-10 — graticule dot texture, faded out toward the content. */}
			<div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(color-mix(in_oklab,var(--primary)_70%,transparent)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(70%_55%_at_50%_0%,#000,transparent)]" />

			{/* z-20 — the spotlight cone. Static under reduced motion; gentle drift
			    otherwise. blur-3xl keeps it soft so it never competes with text. */}
			<div className="absolute top-[-18rem] left-1/2 h-[42rem] w-[58rem] -translate-x-1/2 rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,transparent_0deg,color-mix(in_oklab,var(--primary)_22%,transparent)_90deg,transparent_180deg,color-mix(in_oklab,var(--primary)_22%,transparent)_270deg,transparent_360deg)] opacity-40 blur-[120px] motion-safe:animate-[pricing-spotlight_14s_ease-in-out_infinite_alternate]" />

			{/* z-30 — scrim: darken behind the content column for AA contrast. */}
			<div className="absolute inset-0 bg-[radial-gradient(80%_50%_at_50%_45%,transparent_0%,color-mix(in_oklab,var(--background)_75%,transparent)_70%,var(--background)_100%)]" />

			<style>{`
				@keyframes pricing-spotlight {
					0%   { transform: translateX(-50%) rotate(-6deg) scale(1); opacity: .35; }
					100% { transform: translateX(-50%) rotate(6deg) scale(1.05); opacity: .5; }
				}
			`}</style>
		</RouteBackground>
	);
}
