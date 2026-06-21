// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReducedMotion } from "./use-reduced-motion";

afterEach(() => cleanup());

type Listener = (e: MediaQueryListEvent) => void;

function mockMatchMedia(initial: boolean) {
	let matches = initial;
	const listeners = new Set<Listener>();
	const mql = {
		get matches() {
			return matches;
		},
		media: "(prefers-reduced-motion: reduce)",
		addEventListener: (_: string, cb: Listener) => listeners.add(cb),
		removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
	};
	window.matchMedia = vi
		.fn()
		.mockReturnValue(mql) as unknown as typeof window.matchMedia;
	return {
		emit(next: boolean) {
			matches = next;
			for (const cb of listeners) {
				cb({ matches: next } as MediaQueryListEvent);
			}
		},
		listenerCount: () => listeners.size,
	};
}

function Probe() {
	const reduced = useReducedMotion();
	return <span data-testid="v">{reduced ? "reduced" : "full"}</span>;
}

describe("useReducedMotion", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("reflects the initial matchMedia value", () => {
		mockMatchMedia(true);
		const { getByTestId } = render(<Probe />);
		expect(getByTestId("v").textContent).toBe("reduced");
	});

	it("defaults to full motion when the preference is not set", () => {
		mockMatchMedia(false);
		const { getByTestId } = render(<Probe />);
		expect(getByTestId("v").textContent).toBe("full");
	});

	it("updates live when the preference changes, then unsubscribes", () => {
		const mm = mockMatchMedia(false);
		const { getByTestId, unmount } = render(<Probe />);
		expect(getByTestId("v").textContent).toBe("full");

		act(() => mm.emit(true));
		expect(getByTestId("v").textContent).toBe("reduced");

		unmount();
		expect(mm.listenerCount()).toBe(0);
	});
});
