import { useEffect, useState } from "react";
import type { WheraboutsClient } from "@wherabouts/sdk";

export interface GeocodeAddress {
	id: number;
	formattedAddress: string;
	latitude: number;
	longitude: number;
}

export interface UseForwardGeocodeResult {
	data: GeocodeAddress | null;
	loading: boolean;
	error: Error | null;
}

export function useForwardGeocode(
	client: WheraboutsClient,
	query: string | null
): UseForwardGeocodeResult {
	const [data, setData] = useState<GeocodeAddress | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		if (!query) {
			setData(null);
			setError(null);
			return;
		}

		const controller = new AbortController();

		async function fetch() {
			setLoading(true);
			setError(null);

			try {
				const response = await client.geocode.forward(
					{ q: query },
					{ signal: controller.signal }
				);

				if (!controller.signal.aborted && response.results.length > 0) {
					const first = response.results[0];
					setData({
						id: first.id,
						formattedAddress: first.formattedAddress,
						latitude: first.latitude,
						longitude: first.longitude,
					});
				}
			} catch (err) {
				if (!controller.signal.aborted) {
					setError(
						err instanceof Error ? err : new Error(String(err))
					);
					setData(null);
				}
			} finally {
				if (!controller.signal.aborted) {
					setLoading(false);
				}
			}
		}

		fetch();

		return () => {
			controller.abort();
		};
	}, [client, query]);

	return { data, loading, error };
}
