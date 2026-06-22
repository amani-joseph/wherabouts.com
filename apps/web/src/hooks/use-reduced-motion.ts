import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Reports the user's OS "reduce motion" preference (WCAG 2.3.3). SSR-safe:
 * returns `false` on the server and the first client render (so markup matches),
 * then syncs to the real value and subscribes to changes.
 *
 * Use it to gate any decorative animation: when `true`, render the static
 * composition with motion disabled — never a blank background.
 */
export function useReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) {
			return;
		}
		const mql = window.matchMedia(QUERY);
		setReduced(mql.matches);
		const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, []);

	return reduced;
}
