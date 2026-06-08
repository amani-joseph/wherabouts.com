import type { CallOptions, Requester } from "../shared-types.ts";

export interface DirectionsParams {
	from?: string;
	fromAddressId?: number;
	profile?: "driving";
	to?: string;
	toAddressId?: number;
}

export interface DirectionsGeometry {
	coordinates: [number, number][];
	type: "LineString";
}

export interface DirectionsResponse {
	distance_m: number;
	duration_s: number;
	geometry: DirectionsGeometry;
	query: {
		from: { lat: number; lng: number };
		profile: string;
		to: { lat: number; lng: number };
	};
}

export interface RoutingResource {
	directions(
		params: DirectionsParams,
		options?: CallOptions
	): Promise<DirectionsResponse>;
}

export const createRouting = (request: Requester): RoutingResource => ({
	directions: (params, options) =>
		request<DirectionsResponse>({
			method: "GET",
			path: "/api/v1/routing/directions",
			query: {
				from: params.from,
				to: params.to,
				fromAddressId: params.fromAddressId,
				toAddressId: params.toAddressId,
				profile: params.profile,
			},
			...options,
		}),
});
