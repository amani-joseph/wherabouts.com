import { RouteBackground } from "./route-background";

/**
 * Pricing — "the control room". A soft brand-green spotlight pools behind the
 * pricing card so it reads as the lit focal point, over a faint graticule of
 * dots. Pure CSS (SSR-safe, no canvas); the only motion is a slow breathing
 * drift of the glow, neutralised by `motion-safe:` + the global reduced-motion
 * net. Colors come from theme tokens (`--primary` = brand green, hue 162).
 */
export function PricingBackground() {
	return (
		<RouteBackground>
			{/* Base wash — a green glow from the top that fades into the page. */}
			<div className="absolute inset-0 bg-[radial-gradient(125%_85%_at_50%_-10%,color-mix(in_oklab,var(--primary)_18%,var(--background))_0%,var(--background)_60%)]" />

			{/* Graticule dot texture, revealed in the upper/hero band, faded near
			    the card so it never fights the content. */}
			<div className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(color-mix(in_oklab,var(--primary)_75%,transparent)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:radial-gradient(80%_60%_at_50%_0%,#000_10%,transparent_75%)]" />

			{/* The spotlight pool — a strong, soft radial glow seated behind the
			    pricing card (~38% down). A real radial (not a conic) so it actually
			    reads; breathes slowly when motion is allowed. */}
			<div className="absolute top-[6%] left-1/2 h-[36rem] w-[44rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_42%,transparent)_0%,color-mix(in_oklab,var(--primary)_14%,transparent)_45%,transparent_75%)] opacity-70 blur-[40px] motion-safe:animate-[pricing-glow_12s_ease-in-out_infinite_alternate]" />

			{/* A faint cool counter-glow low-right for depth. */}
			<div className="absolute right-[8%] bottom-[6%] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--ring)_22%,transparent),transparent_70%)] opacity-50 blur-[60px]" />

			{/* Bottom seat — only a gentle fade to the page color at the very bottom,
			    so the footer joins cleanly. Does NOT darken the spotlight above. */}
			<div className="absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(to_bottom,transparent,var(--background))]" />

			<style>{`
				@keyframes pricing-glow {
					0%   { transform: translateX(-50%) scale(1);    opacity: .6; }
					100% { transform: translateX(-50%) scale(1.08); opacity: .8; }
				}
			`}</style>
		</RouteBackground>
	);
}
