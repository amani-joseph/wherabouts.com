import type { WheraboutsClient, ZoneRecord } from "@wherabouts/sdk";
import { useEffect, useRef, useState } from "react";

import type { LatLng } from "./use-reverse-geocode.ts";

export interface UseZoneContainsResult {
	error: Error | null;
	loading: boolean;
	zones: ZoneRecord[];
}

export function useZoneContains(
	client: WheraboutsClient,
	coords: LatLng | null
): UseZoneContainsResult {
	const [zones, setZones] = useState<ZoneRecord[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		if (abortRef.current) {
			abortRef.current.abort();
		}

		if (!coords) {
			setZones([]);
			setLoading(false);
			setError(null);
			return;
		}

		const controller = new AbortController();
		abortRef.current = controller;
		setLoading(true);
		setError(null);

		client.zones
			.contains(coords, { signal: controller.signal })
			.then((res) => {
				if (!controller.signal.aborted) {
					setZones(res.zones);
				}
			})
			.catch((e: unknown) => {
				if (!controller.signal.aborted) {
					setError(e instanceof Error ? e : new Error(String(e)));
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoading(false);
				}
			});

		return () => {
			controller.abort();
		};
	}, [coords?.lat, coords?.lng, client]);

	return { zones, loading, error };
}
