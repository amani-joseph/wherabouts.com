import { useEffect, useState } from "react";

export interface UseAddressGeolocationResult {
	error: GeolocationPositionError | null;
	lat: number | undefined;
	lng: number | undefined;
	loading: boolean;
}

export function useAddressGeolocation(
	enabled: boolean
): UseAddressGeolocationResult {
	const [lat, setLat] = useState<number | undefined>(undefined);
	const [lng, setLng] = useState<number | undefined>(undefined);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<GeolocationPositionError | null>(null);

	useEffect(() => {
		if (!enabled) {
			return;
		}

		// SSR safety check
		if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
			return;
		}

		setLoading(true);

		const controller = new AbortController();

		navigator.geolocation.getCurrentPosition(
			(position) => {
				if (!controller.signal.aborted) {
					setLat(position.coords.latitude);
					setLng(position.coords.longitude);
					setError(null);
					setLoading(false);
				}
			},
			(err) => {
				if (!controller.signal.aborted) {
					setError(err);
					setLoading(false);
				}
			}
		);

		return () => {
			controller.abort();
		};
	}, [enabled]);

	return { lat, lng, loading, error };
}
