import type { CallOptions, Requester } from "../shared-types.ts";

export interface RegionsClassifyParams {
	lat: number;
	layers?: string;
	lng: number;
}

export interface RegionMatch {
	code: string;
	name: string;
}

export interface RegionsClassifyResponse {
	query: { lat: number; lng: number };
	regions: Record<string, RegionMatch>;
}

export interface RegionsResource {
	classify(
		params: RegionsClassifyParams,
		options?: CallOptions
	): Promise<RegionsClassifyResponse>;
}

export const createRegions = (request: Requester): RegionsResource => ({
	classify: (params, options) =>
		request<RegionsClassifyResponse>({
			method: "GET",
			path: "/api/v1/regions",
			query: { lat: params.lat, lng: params.lng, layers: params.layers },
			...options,
		}),
});
