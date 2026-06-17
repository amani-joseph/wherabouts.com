import { useMemo, useRef, type ReactNode } from "react";
import type { WheraboutsClient } from "@wherabouts/sdk";
import { useAutocomplete, useCombobox } from "@wherabouts/react";
import type { AddressI18nStrings, AddressWithParsed } from "../types";
import { cn } from "../utils/cn";
import { toAddressWithParsed } from "../utils/parse-address";
import { useAddressGeolocation } from "../hooks/use-address-geolocation";

export interface AddressAutocompleteProps {
	client: WheraboutsClient;
	onQueryChange?: (query: string) => void;
	onSelect?: (address: AddressWithParsed) => void;
	error?: string;
	required?: boolean;
	disabled?: boolean;
	debounceMs?: number;
	minCharsToSearch?: number;
	maxSuggestions?: number;
	enableGeolocation?: boolean;
	userLat?: number;
	userLng?: number;
	sessionToken?: string;
	className?: string;
	placeholder?: string;
	renderSuggestion?: (
		address: AddressWithParsed,
		isActive: boolean
	) => ReactNode;
	renderEmpty?: () => ReactNode;
	renderError?: (error: Error | null) => ReactNode;
	renderLoading?: () => ReactNode;
	i18nStrings?: Partial<AddressI18nStrings>;
	id?: string;
}

const DEFAULT_I18N: AddressI18nStrings = {
	noResults: "No addresses found",
	enterManually: "Enter address manually",
	errorRetry: "Try again",
	geolocationError: "Location access denied",
};

export function AddressAutocomplete({
	client,
	onQueryChange,
	onSelect,
	error: externalError,
	required,
	disabled,
	debounceMs = 300,
	minCharsToSearch = 2,
	maxSuggestions = 5,
	enableGeolocation,
	userLat,
	userLng,
	sessionToken,
	className,
	placeholder,
	renderSuggestion,
	renderEmpty,
	renderError,
	renderLoading,
	i18nStrings: customI18n,
	id: customId,
}: AddressAutocompleteProps) {
	const id = customId ?? "wherabouts-autocomplete";
	const i18n = useMemo(() => ({ ...DEFAULT_I18N, ...customI18n }), [customI18n]);

	// Geolocation
	const { lat: geoLat, lng: geoLng } = useAddressGeolocation(
		enableGeolocation ?? false
	);
	const effectiveLat = userLat ?? geoLat;
	const effectiveLng = userLng ?? geoLng;

	// Autocomplete hook
	const { query, setQuery, results, error: autocompleteError, status } = useAutocomplete(client, {
		debounceMs,
		minLength: minCharsToSearch,
		limit: maxSuggestions,
		lat: effectiveLat,
		lng: effectiveLng,
		sessionToken,
		keepPreviousData: true,
	});

	// Combobox hook for keyboard navigation
	const { getInputProps, getListboxProps, getItemProps, isOpen } = useCombobox({
		id,
		count: results.length,
		onSelect: (index) => {
			const item = results[index];
			if (item) {
				const parsed = toAddressWithParsed(item);
				onSelect?.(parsed);
				setQuery("");
			}
		},
	});

	const inputRef = useRef<HTMLInputElement>(null);

	// Sync external value prop to internal query (only on mount)
	// This allows controlled initial value without fighting the hook's internal state
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional, control initial value only
	// const _unused = useMemo(() => {
	//   if (value !== undefined && !inputRef.current?.value) {
	//     setQuery(value);
	//   }
	// }, []);

	const error = externalError || (status === "error" ? autocompleteError : null);
	const inputProps = getInputProps();

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		// Call the combobox handler with the native event
		// biome-ignore lint/suspicious/noImplicitAnyLet: combobox handler accepts KeyboardEvent
		const handler = inputProps.onKeyDown as any;
		if (handler) {
			handler(e.nativeEvent);
		}
	};

	return (
		<div
			data-slot="address-autocomplete"
			className={cn("relative w-full", className)}
		>
			<input
				{...inputProps}
				ref={inputRef}
				data-slot="address-input"
				type="text"
				value={query}
				placeholder={placeholder ?? i18n.noResults}
				disabled={disabled}
				required={required}
				aria-invalid={error ? "true" : "false"}
				onChange={(e) => {
					setQuery(e.target.value);
					onQueryChange?.(e.target.value);
				}}
				onKeyDown={handleKeyDown}
				className="block h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-foreground text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 dark:bg-input/30"
			/>

			{isOpen && (
				<div
					data-slot="address-dropdown"
					className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-none border border-border bg-popover text-popover-foreground shadow-md"
				>
					<ul
						{...getListboxProps()}
						data-slot="address-listbox"
						className="max-h-80 overflow-y-auto"
					>
						{status === "loading" && (
							<li
								data-slot="address-item"
								data-status="loading"
								className="flex items-center justify-center px-3 py-2 text-muted-foreground text-sm"
							>
								{renderLoading?.() ?? "Loading..."}
							</li>
						)}

						{status === "error" && (
							<li
								data-slot="address-item"
								data-status="error"
								className="flex items-center justify-center px-3 py-2 text-destructive text-sm"
							>
								{renderError?.(error instanceof Error ? error : null) ?? i18n.errorRetry}
							</li>
						)}

						{status === "empty" && (
							<li
								data-slot="address-item"
								data-status="empty"
								className="flex items-center justify-center px-3 py-2 text-muted-foreground text-sm"
							>
								{renderEmpty?.() ?? i18n.noResults}
							</li>
						)}

						{status === "success" &&
							results.map((result, index) => {
								const itemProps = getItemProps(index);
								const ariaSelected = itemProps["aria-selected"] as
									| boolean
									| string
									| undefined;
								const isActive =
									ariaSelected === true ||
									ariaSelected === "true";
								const parsed = toAddressWithParsed(result);

								return (
									<li
										key={result.id}
										{...itemProps}
										data-slot="address-item"
										className="flex cursor-pointer items-center rounded-none px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
										onClick={() => {
											onSelect?.(parsed);
											setQuery("");
										}}
										onMouseDown={(e) => {
											e.preventDefault();
										}}
									>
										{renderSuggestion ? (
											renderSuggestion(parsed, isActive)
										) : (
											<div className="flex-1">
												<div className="font-medium text-foreground text-sm">
													{parsed.streetAddress}
												</div>
												<div className="text-muted-foreground text-xs">
													{parsed.suburb}, {parsed.state}{" "}
													{parsed.postcode}
												</div>
											</div>
										)}
									</li>
								);
							})}
					</ul>

					{/* Wherabouts branding footer */}
					{status === "success" && results.length > 0 && (
						<div
							data-slot="address-powered-by"
							className="border-t border-border bg-muted/40 px-3 py-2"
						>
							<p className="text-muted-foreground text-xs">
								Suggestions powered by{" "}
								<a
									href="https://wherabouts.com"
									target="_blank"
									rel="noopener noreferrer"
									className="font-semibold text-foreground hover:underline"
								>
									Wherabouts
								</a>
							</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
