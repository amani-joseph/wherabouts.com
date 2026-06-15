import {
	type KeyboardEvent,
	type MouseEvent,
	useCallback,
	useReducer,
} from "react";

/**
 * Headless WAI-ARIA combobox helper for autocomplete dropdowns. Provides the
 * keyboard state machine (↑/↓/Home/End/Enter/Esc, wrapping) and ARIA prop
 * getters so an input + listbox is accessible by default. Bring your own
 * markup and data; this hook owns only the open/active-option state.
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
		case "close":
		case "select":
			return INITIAL_COMBOBOX_STATE;
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

export interface ComboboxInputProps {
	"aria-activedescendant": string | undefined;
	"aria-autocomplete": "list";
	"aria-controls": string;
	"aria-expanded": boolean;
	role: "combobox";
}

export interface ComboboxListboxProps {
	id: string;
	role: "listbox";
}

export interface ComboboxItemProps {
	"aria-selected": boolean;
	id: string;
	role: "option";
}

const listboxId = (id: string) => `${id}-listbox`;
const optionId = (id: string, index: number) => `${id}-option-${index}`;

/** Build the ARIA attributes for the combobox input — pure. */
export function buildInputProps(
	id: string,
	state: ComboboxState
): ComboboxInputProps {
	return {
		role: "combobox",
		"aria-autocomplete": "list",
		"aria-expanded": state.isOpen,
		"aria-controls": listboxId(id),
		"aria-activedescendant":
			state.isOpen && state.activeIndex >= 0
				? optionId(id, state.activeIndex)
				: undefined,
	};
}

/** Build the ARIA attributes for the listbox container — pure. */
export function buildListboxProps(id: string): ComboboxListboxProps {
	return { id: listboxId(id), role: "listbox" };
}

/** Build the ARIA attributes for an option at `index` — pure. */
export function buildItemProps(
	id: string,
	index: number,
	state: ComboboxState
): ComboboxItemProps {
	return {
		role: "option",
		id: optionId(id, index),
		"aria-selected": state.activeIndex === index,
	};
}

export interface UseComboboxOptions {
	/** Number of options currently rendered (drives wrapping/bounds). */
	count: number;
	/** Stable id root; option/listbox ids derive from it. */
	id: string;
	/** Called when an option is chosen via Enter or pointer. */
	onSelect?: (index: number) => void;
}

export interface UseComboboxResult {
	activeIndex: number;
	close: () => void;
	getInputProps: () => ComboboxInputProps & {
		onBlur: () => void;
		onFocus: () => void;
		onKeyDown: (event: KeyboardEvent) => void;
	};
	getItemProps: (index: number) => ComboboxItemProps & {
		onMouseDown: (event: MouseEvent) => void;
		onMouseEnter: () => void;
	};
	getListboxProps: () => ComboboxListboxProps;
	isOpen: boolean;
	open: () => void;
	reset: () => void;
	setActiveIndex: (index: number) => void;
}

export function useCombobox(options: UseComboboxOptions): UseComboboxResult {
	const { id, count, onSelect } = options;
	const [state, dispatch] = useReducer(comboboxReducer, INITIAL_COMBOBOX_STATE);

	const open = useCallback(() => dispatch({ type: "open" }), []);
	const close = useCallback(() => dispatch({ type: "close" }), []);
	const reset = useCallback(() => dispatch({ type: "reset" }), []);
	const setActiveIndex = useCallback(
		(index: number) => dispatch({ type: "set", index }),
		[]
	);

	const getInputProps = useCallback(
		() => ({
			...buildInputProps(id, state),
			onFocus: () => dispatch({ type: "open" }),
			onBlur: () => dispatch({ type: "close" }),
			onKeyDown: (event: KeyboardEvent) => {
				const action = keyToAction(event.key, count);
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
			},
		}),
		[id, state, count, onSelect]
	);

	const getListboxProps = useCallback(() => buildListboxProps(id), [id]);

	const getItemProps = useCallback(
		(index: number) => ({
			...buildItemProps(id, index, state),
			onMouseEnter: () => dispatch({ type: "set", index }),
			onMouseDown: (event: MouseEvent) => {
				// Keep input focus so selection isn't cancelled by blur.
				event.preventDefault();
				onSelect?.(index);
				dispatch({ type: "select" });
			},
		}),
		[id, state, onSelect]
	);

	return {
		isOpen: state.isOpen,
		activeIndex: state.activeIndex,
		open,
		close,
		reset,
		setActiveIndex,
		getInputProps,
		getListboxProps,
		getItemProps,
	};
}
