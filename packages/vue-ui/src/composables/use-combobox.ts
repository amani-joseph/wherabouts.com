import { reactive, readonly } from "vue";

/**
 * Headless WAI-ARIA combobox helper for autocomplete dropdowns — Vue port of the
 * react package's `useCombobox`. Owns the keyboard state machine
 * (↑/↓/Home/End/Enter/Esc, wrapping) and ARIA attribute getters. Bring your own
 * markup and data.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
 */

export interface ComboboxState {
	/** Index of the visually-active option, or -1 when none is active. */
	activeIndex: number;
	isOpen: boolean;
}

export type ComboboxAction =
	| { type: "next"; count: number }
	| { type: "prev"; count: number }
	| { type: "first"; count: number }
	| { type: "last"; count: number }
	| { type: "set"; index: number }
	| { type: "open" }
	| { type: "close" }
	| { type: "select" }
	| { type: "reset" };

export const INITIAL_COMBOBOX_STATE: ComboboxState = {
	isOpen: false,
	activeIndex: -1,
};

/** Pure transition function for the combobox keyboard state machine. */
export function comboboxReducer(
	state: ComboboxState,
	action: ComboboxAction
): ComboboxState {
	switch (action.type) {
		case "next": {
			if (action.count === 0) {
				return state;
			}
			const activeIndex =
				state.activeIndex >= action.count - 1 ? 0 : state.activeIndex + 1;
			return { isOpen: true, activeIndex };
		}
		case "prev": {
			if (action.count === 0) {
				return state;
			}
			const activeIndex =
				state.activeIndex <= 0 ? action.count - 1 : state.activeIndex - 1;
			return { isOpen: true, activeIndex };
		}
		case "first":
			return action.count === 0 ? state : { isOpen: true, activeIndex: 0 };
		case "last":
			return action.count === 0
				? state
				: { isOpen: true, activeIndex: action.count - 1 };
		case "set":
			return { isOpen: true, activeIndex: action.index };
		case "open":
			return { ...state, isOpen: true };
		default:
			return INITIAL_COMBOBOX_STATE;
	}
}

/** Map a keyboard key to a combobox action, or null when it is irrelevant. */
export function keyToAction(key: string, count: number): ComboboxAction | null {
	switch (key) {
		case "ArrowDown":
			return { type: "next", count };
		case "ArrowUp":
			return { type: "prev", count };
		case "Home":
			return { type: "first", count };
		case "End":
			return { type: "last", count };
		case "Escape":
			return { type: "close" };
		case "Enter":
			return { type: "select" };
		default:
			return null;
	}
}

const listboxId = (id: string) => `${id}-listbox`;
const optionId = (id: string, index: number) => `${id}-option-${index}`;

export interface UseComboboxOptions {
	/** Number of options currently rendered (getter so it stays reactive). */
	count: () => number;
	/** Stable id root; option/listbox ids derive from it. */
	id: string;
	/** Called when an option is chosen via Enter or pointer. */
	onSelect?: (index: number) => void;
}

export function useCombobox(options: UseComboboxOptions) {
	const { id, count, onSelect } = options;
	const state = reactive<ComboboxState>({ ...INITIAL_COMBOBOX_STATE });

	const dispatch = (action: ComboboxAction): void => {
		const next = comboboxReducer(state, action);
		state.isOpen = next.isOpen;
		state.activeIndex = next.activeIndex;
	};

	const open = () => dispatch({ type: "open" });
	const close = () => dispatch({ type: "close" });
	const reset = () => dispatch({ type: "reset" });
	const setActiveIndex = (index: number) => dispatch({ type: "set", index });

	const listboxIdValue = listboxId(id);

	const inputAria = () => ({
		role: "combobox" as const,
		"aria-autocomplete": "list" as const,
		"aria-expanded": state.isOpen,
		"aria-controls": listboxIdValue,
		"aria-activedescendant":
			state.isOpen && state.activeIndex >= 0
				? optionId(id, state.activeIndex)
				: undefined,
	});

	const onKeyDown = (event: KeyboardEvent): void => {
		const action = keyToAction(event.key, count());
		if (!action) {
			return;
		}
		if (action.type === "select") {
			if (state.activeIndex >= 0) {
				event.preventDefault();
				onSelect?.(state.activeIndex);
			}
			dispatch({ type: "select" });
			return;
		}
		event.preventDefault();
		dispatch(action);
	};

	const itemId = (index: number) => optionId(id, index);
	const isActive = (index: number) => state.activeIndex === index;

	const onItemMouseEnter = (index: number) => dispatch({ type: "set", index });
	const onItemMouseDown = (event: MouseEvent, index: number): void => {
		// Keep input focus so selection isn't cancelled by blur.
		event.preventDefault();
		onSelect?.(index);
		dispatch({ type: "select" });
	};

	return {
		state: readonly(state),
		listboxId: listboxIdValue,
		open,
		close,
		reset,
		setActiveIndex,
		inputAria,
		onKeyDown,
		onFocus: open,
		onBlur: close,
		itemId,
		isActive,
		onItemMouseEnter,
		onItemMouseDown,
	};
}
