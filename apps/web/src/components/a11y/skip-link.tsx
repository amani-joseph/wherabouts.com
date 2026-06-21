/**
 * Keyboard skip link (WCAG 2.4.1 "Bypass Blocks"). Visually hidden until
 * focused, it's the first thing a keyboard user tabs to on any page and jumps
 * focus past the sidebar / top nav straight to the main content region.
 *
 * The target `#main-content` is the `<main>` landmark rendered by AppShell
 * (protected routes) and the post-nav wrapper in the public layout. Both carry
 * `tabIndex={-1}` so the fragment focus actually lands there.
 */
export function SkipLink() {
	return (
		<a
			className="sr-only fixed top-2 left-2 z-[100] -translate-y-full rounded-md bg-background px-4 py-2 font-medium text-foreground text-sm shadow-lg outline-none ring-2 ring-ring transition-transform focus:not-sr-only focus:translate-y-0"
			href="#main-content"
		>
			Skip to main content
		</a>
	);
}
