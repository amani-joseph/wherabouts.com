import type { CallOptions, Requester } from "../shared-types.ts";

// --- Types ---

export interface ZoneRecord {
	createdAt: string;
	description: string | null;
	id: number;
	metadata: Record<string, unknown> | null;
	name: string;
	projectId: string;
	updatedAt: string;
}

export interface ZoneWithGeometry extends ZoneRecord {
	geometry: {
		type: string;
		coordinates: number[][][];
	};
}

// --- GeoJSON Polygon geometry ---

export interface GeoJsonPolygon {
	coordinates: number[][][];
	type: "Polygon";
}

// --- Param interfaces ---

export interface ZoneListParams {
	limit?: number;
	page?: number;
}

export interface ZoneContainsParams {
	lat: number;
	lng: number;
}

export interface ZoneAddressesParams {
	limit?: number;
	page?: number;
}

export interface ZoneCreateBody {
	description?: string;
	geometry: GeoJsonPolygon;
	metadata?: Record<string, unknown>;
	name: string;
}

export interface ZoneUpdateBody {
	description?: string;
	geometry?: GeoJsonPolygon;
	metadata?: Record<string, unknown>;
	name?: string;
}

// --- Response interfaces ---

export interface ZoneListResponse {
	count: number;
	page: number;
	zones: ZoneRecord[];
}

export interface ZoneDeleteResponse {
	success: true;
}

export interface ZoneContainsResponse {
	count: number;
	query: { lat: number; lng: number };
	zones: ZoneRecord[];
}

export interface ZoneAddressesResponse {
	count: number;
	query: { id: number; limit: number; page: number };
	results: Array<{
		buildingName: string | null;
		country: string;
		flatNumber: string | null;
		flatType: string | null;
		id: number;
		latitude: number;
		locality: string;
		longitude: number;
		numberFirst: string | null;
		numberLast: string | null;
		postcode: string;
		state: string;
		streetName: string;
		streetType: string | null;
	}>;
	truncated: boolean;
}

// --- Resource interface ---

export interface ZonesResource {
	addresses(
		id: number,
		params?: ZoneAddressesParams,
		options?: CallOptions
	): Promise<ZoneAddressesResponse>;
	contains(
		params: ZoneContainsParams,
		options?: CallOptions
	): Promise<ZoneContainsResponse>;
	create(body: ZoneCreateBody, options?: CallOptions): Promise<ZoneRecord>;
	delete(id: number, options?: CallOptions): Promise<ZoneDeleteResponse>;
	get(id: number, options?: CallOptions): Promise<ZoneWithGeometry>;
	list(
		params?: ZoneListParams,
		options?: CallOptions
	): Promise<ZoneListResponse>;
	update(
		id: number,
		body: ZoneUpdateBody,
		options?: CallOptions
	): Promise<ZoneRecord>;
}

// --- Factory ---

export const createZones = (request: Requester): ZonesResource => ({
	create: (body, options) =>
		request<ZoneRecord>({
			method: "POST",
			path: "/api/v1/zones",
			body,
			...options,
		}),

	list: (params, options) =>
		request<ZoneListResponse>({
			method: "GET",
			path: "/api/v1/zones",
			query: { page: params?.page, limit: params?.limit },
			...options,
		}),

	get: (id, options) =>
		request<ZoneWithGeometry>({
			method: "GET",
			path: `/api/v1/zones/${id}`,
			...options,
		}),

	update: (id, body, options) =>
		request<ZoneRecord>({
			method: "PUT",
			path: `/api/v1/zones/${id}`,
			body,
			...options,
		}),

	delete: (id, options) =>
		request<ZoneDeleteResponse>({
			method: "DELETE",
			path: `/api/v1/zones/${id}`,
			...options,
		}),

	contains: (params, options) =>
		request<ZoneContainsResponse>({
			method: "GET",
			path: "/api/v1/zones/contains",
			query: { lat: params.lat, lng: params.lng },
			...options,
		}),

	addresses: (id, params, options) =>
		request<ZoneAddressesResponse>({
			method: "GET",
			path: `/api/v1/zones/${id}/addresses`,
			query: { page: params?.page, limit: params?.limit },
			...options,
		}),
});
