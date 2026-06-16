import type { WheraboutsClient } from "@wherabouts/sdk";
import { useEffect, useState } from "react";

export interface GeocodeAddress {
	formattedAddress: string;
	id: number;
	latitude: number;
	longitude: number;
}

export interface UseForwardGeocodeResult {
	data: GeocodeAddress | null;
	error: Error | null;
	loading: boolean;
}

const toGeocodeAddress = (
	address: GeocodeAddress | null | undefined
): GeocodeAddress | null =>
	address
		? {
				id: address.id,
				formattedAddress: address.formattedAddress,
				latitude: address.latitude,
				longitude: address.longitude,
			}
		: null;

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
				if (controller.signal.aborted) {
					return;
				}
				// The forward geocode endpoint returns a single { address } object
				// (matching the SDK's ForwardGeocodeResponse), not a results array.
				setData(toGeocodeAddress(response.address));
			} catch (err) {
				if (controller.signal.aborted) {
					return;
				}
				setError(err instanceof Error ? err : new Error(String(err)));
				setData(null);
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
