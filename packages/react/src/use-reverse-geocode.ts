import type { ReverseGeocodeAddress, WheraboutsClient } from "@wherabouts/sdk";
import { useEffect, useRef, useState } from "react";

export interface LatLng {
	lat: number;
	lng: number;
}

export interface UseReverseGeocodeResult {
	address: ReverseGeocodeAddress | null;
	distance: number | null;
	error: Error | null;
	loading: boolean;
}

export function useReverseGeocode(
	client: WheraboutsClient,
	coords: LatLng | null
): UseReverseGeocodeResult {
	const [address, setAddress] = useState<ReverseGeocodeAddress | null>(null);
	const [distance, setDistance] = useState<number | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		if (abortRef.current) {
			abortRef.current.abort();
		}

		if (!coords) {
			setAddress(null);
			setDistance(null);
			setLoading(false);
			setError(null);
			return;
		}

		const controller = new AbortController();
		abortRef.current = controller;
		setLoading(true);
		setError(null);

		client.addresses
			.reverse(coords, { signal: controller.signal })
			.then((res) => {
				if (!controller.signal.aborted) {
					setAddress(res.address);
					setDistance(res.distance);
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

	return { address, distance, loading, error };
}
