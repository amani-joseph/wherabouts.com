import { describe, expect, it } from "vitest";
import {
	type ComboboxState,
	comboboxReducer,
	INITIAL_COMBOBOX_STATE,
	keyToAction,
} from "./use-combobox";

describe("comboboxReducer", () => {
	const open: ComboboxState = { isOpen: true, activeIndex: 1 };

	it("wraps to the first option when stepping past the last", () => {
		const state: ComboboxState = { isOpen: true, activeIndex: 2 };
		expect(comboboxReducer(state, { type: "next", count: 3 })).toEqual({
			isOpen: true,
			activeIndex: 0,
		});
	});

	it("wraps to the last option when stepping before the first", () => {
		const state: ComboboxState = { isOpen: true, activeIndex: 0 };
		expect(comboboxReducer(state, { type: "prev", count: 3 })).toEqual({
			isOpen: true,
			activeIndex: 2,
		});
	});

	it("is a no-op for next/prev when there are no options", () => {
		expect(comboboxReducer(open, { type: "next", count: 0 })).toBe(open);
		expect(comboboxReducer(open, { type: "prev", count: 0 })).toBe(open);
	});

	it("jumps to first and last", () => {
		expect(comboboxReducer(open, { type: "first", count: 4 })).toEqual({
			isOpen: true,
			activeIndex: 0,
		});
		expect(comboboxReducer(open, { type: "last", count: 4 })).toEqual({
			isOpen: true,
			activeIndex: 3,
		});
	});

	it("closes and selects back to the initial state", () => {
		expect(comboboxReducer(open, { type: "close" })).toEqual(
			INITIAL_COMBOBOX_STATE
		);
		expect(comboboxReducer(open, { type: "select" })).toEqual(
			INITIAL_COMBOBOX_STATE
		);
	});
});

describe("keyToAction", () => {
	it("maps navigation keys to actions", () => {
		expect(keyToAction("ArrowDown", 3)).toEqual({ type: "next", count: 3 });
		expect(keyToAction("ArrowUp", 3)).toEqual({ type: "prev", count: 3 });
		expect(keyToAction("Home", 3)).toEqual({ type: "first", count: 3 });
		expect(keyToAction("End", 3)).toEqual({ type: "last", count: 3 });
		expect(keyToAction("Escape", 3)).toEqual({ type: "close" });
		expect(keyToAction("Enter", 3)).toEqual({ type: "select" });
	});

	it("ignores irrelevant keys", () => {
		expect(keyToAction("a", 3)).toBeNull();
		expect(keyToAction("Tab", 3)).toBeNull();
	});
});
