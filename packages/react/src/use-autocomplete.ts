import type { AddressSuggestion, WheraboutsClient } from "@wherabouts/sdk";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseAutocompleteOptions {
	country?: string;
	debounceMs?: number;
	limit?: number;
	state?: string;
}

export interface UseAutocompleteResult {
	error: Error | null;
	loading: boolean;
	query: string;
	results: AddressSuggestion[];
	setQuery: (q: string) => void;
}

export function useAutocomplete(
	client: WheraboutsClient,
	options: UseAutocompleteOptions = {}
): UseAutocompleteResult {
	const { debounceMs = 300, limit, country, state } = options;

	const [query, setQuery] = useState("");
	const [results, setResults] = useState<AddressSuggestion[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const abortRef = useRef<AbortController | null>(null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Stable setter — consumers can safely pass this to input onChange
	const handleSetQuery = useCallback((q: string) => {
		setQuery(q);
	}, []);

	useEffect(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
		}
		if (abortRef.current) {
			abortRef.current.abort();
		}

		if (!query.trim()) {
			setResults([]);
			setLoading(false);
			setError(null);
			return;
		}

		setLoading(true);

		timerRef.current = setTimeout(async () => {
			const controller = new AbortController();
			abortRef.current = controller;
			setError(null);

			try {
				const res = await client.addresses.autocomplete(
					{ q: query, limit, country, state },
					{ signal: controller.signal }
				);
				if (!controller.signal.aborted) {
					setResults(res.results);
				}
			} catch (e) {
				if (!controller.signal.aborted) {
					setError(e instanceof Error ? e : new Error(String(e)));
					setResults([]);
				}
			} finally {
				if (!controller.signal.aborted) {
					setLoading(false);
				}
			}
		}, debounceMs);

		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
			if (abortRef.current) {
				abortRef.current.abort();
			}
		};
	}, [query, debounceMs, limit, country, state, client]);

	return { query, setQuery: handleSetQuery, results, loading, error };
}
