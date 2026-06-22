import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

/**
 * App-wide screen-reader announcer (WCAG 4.1.3 "Status Messages").
 *
 * Renders two persistent visually-hidden `aria-live` regions and exposes an
 * imperative `announce()` via context. Use it for transient updates that have
 * no natural focus change — async results loading, SPA route changes, "copied
 * to clipboard", etc. — which assistive tech would otherwise miss.
 *
 * Two politeness levels:
 *  - `polite` (default): waits for the user to be idle (most messages).
 *  - `assertive`: interrupts immediately (errors / time-sensitive alerts).
 */
export interface AnnounceOptions {
	/** Interrupt the user instead of waiting for an idle moment. */
	assertive?: boolean;
}

type AnnounceFn = (message: string, options?: AnnounceOptions) => void;

const noop: AnnounceFn = () => {
	// Default when used outside the provider (e.g. unit tests) — silently ignore.
};

const AnnouncerContext = createContext<AnnounceFn>(noop);

/** Access the imperative `announce()` function. Safe outside the provider. */
export function useAnnounce(): AnnounceFn {
	return useContext(AnnouncerContext);
}

export function LiveAnnouncerProvider({ children }: { children: ReactNode }) {
	const [polite, setPolite] = useState("");
	const [assertive, setAssertive] = useState("");

	const announce = useCallback<AnnounceFn>((message, options) => {
		if (!message) {
			return;
		}
		const set = options?.assertive ? setAssertive : setPolite;
		// Clear first, then set on the next frame, so repeating the *same* message
		// still re-fires the live region (identical text alone won't re-announce).
		set("");
		const schedule =
			typeof requestAnimationFrame === "function"
				? requestAnimationFrame
				: (cb: () => void) => setTimeout(cb, 16);
		schedule(() => set(message));
	}, []);

	const value = useMemo(() => announce, [announce]);

	return (
		<AnnouncerContext.Provider value={value}>
			{children}
			{/* <output> carries implicit role="status" + polite live semantics. */}
			<output aria-atomic="true" aria-live="polite" className="sr-only">
				{polite}
			</output>
			<div
				aria-atomic="true"
				aria-live="assertive"
				className="sr-only"
				role="alert"
			>
				{assertive}
			</div>
		</AnnouncerContext.Provider>
	);
}
