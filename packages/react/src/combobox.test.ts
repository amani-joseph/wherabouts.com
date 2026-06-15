import { describe, expect, it } from "vitest";
import {
	buildInputProps,
	buildItemProps,
	buildListboxProps,
	type ComboboxState,
	comboboxReducer,
	keyToAction,
} from "./combobox.ts";

const CLOSED: ComboboxState = { isOpen: false, activeIndex: -1 };

describe("keyToAction", () => {
	it("maps navigation and dismissal keys", () => {
		expect(keyToAction("ArrowDown", 3)).toEqual({ type: "next", count: 3 });
		expect(keyToAction("ArrowUp", 3)).toEqual({ type: "prev", count: 3 });
		expect(keyToAction("Home", 3)).toEqual({ type: "first", count: 3 });
		expect(keyToAction("End", 3)).toEqual({ type: "last", count: 3 });
		expect(keyToAction("Escape", 3)).toEqual({ type: "close" });
		expect(keyToAction("Enter", 3)).toEqual({ type: "select" });
	});

	it("ignores unrelated keys", () => {
		expect(keyToAction("a", 3)).toBeNull();
		expect(keyToAction("Tab", 3)).toBeNull();
	});
});

describe("comboboxReducer", () => {
	it("opens and selects the first item on ArrowDown from closed", () => {
		expect(comboboxReducer(CLOSED, { type: "next", count: 3 })).toEqual({
			isOpen: true,
			activeIndex: 0,
		});
	});

	it("opens to the last item on ArrowUp from closed", () => {
		expect(comboboxReducer(CLOSED, { type: "prev", count: 3 })).toEqual({
			isOpen: true,
			activeIndex: 2,
		});
	});

	it("wraps forward past the end back to the first item", () => {
		expect(
			comboboxReducer(
				{ isOpen: true, activeIndex: 2 },
				{ type: "next", count: 3 }
			)
		).toEqual({ isOpen: true, activeIndex: 0 });
	});

	it("wraps backward past the start to the last item", () => {
		expect(
			comboboxReducer(
				{ isOpen: true, activeIndex: 0 },
				{ type: "prev", count: 3 }
			)
		).toEqual({ isOpen: true, activeIndex: 2 });
	});

	it("is a no-op when navigating an empty list", () => {
		expect(comboboxReducer(CLOSED, { type: "next", count: 0 })).toEqual(CLOSED);
	});

	it("closes and clears the active item on close/select", () => {
		const open: ComboboxState = { isOpen: true, activeIndex: 1 };
		expect(comboboxReducer(open, { type: "close" })).toEqual(CLOSED);
		expect(comboboxReducer(open, { type: "select" })).toEqual(CLOSED);
	});

	it("sets the active index on pointer hover and opens", () => {
		expect(comboboxReducer(CLOSED, { type: "set", index: 2 })).toEqual({
			isOpen: true,
			activeIndex: 2,
		});
	});
});

describe("ARIA prop builders", () => {
	it("links the input to the listbox and active option", () => {
		const props = buildInputProps("addr", { isOpen: true, activeIndex: 1 });
		expect(props.role).toBe("combobox");
		expect(props["aria-autocomplete"]).toBe("list");
		expect(props["aria-expanded"]).toBe(true);
		expect(props["aria-controls"]).toBe("addr-listbox");
		expect(props["aria-activedescendant"]).toBe("addr-option-1");
	});

	it("omits aria-activedescendant when closed or nothing is active", () => {
		expect(
			buildInputProps("addr", { isOpen: true, activeIndex: -1 })[
				"aria-activedescendant"
			]
		).toBeUndefined();
		expect(
			buildInputProps("addr", { isOpen: false, activeIndex: 1 })[
				"aria-activedescendant"
			]
		).toBeUndefined();
	});

	it("builds listbox and option props with matching ids", () => {
		expect(buildListboxProps("addr")).toEqual({
			id: "addr-listbox",
			role: "listbox",
		});
		const item = buildItemProps("addr", 1, { isOpen: true, activeIndex: 1 });
		expect(item.id).toBe("addr-option-1");
		expect(item.role).toBe("option");
		expect(item["aria-selected"]).toBe(true);
		expect(
			buildItemProps("addr", 0, { isOpen: true, activeIndex: 1 })[
				"aria-selected"
			]
		).toBe(false);
	});
});
