import type { Requester } from "../shared-types.ts";

// --- Types (mirrored from types.ts) ---

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
		params?: ZoneAddressesParams
	): Promise<ZoneAddressesResponse>;
	contains(params: ZoneContainsParams): Promise<ZoneContainsResponse>;
	create(body: ZoneCreateBody): Promise<ZoneRecord>;
	delete(id: number): Promise<ZoneDeleteResponse>;
	get(id: number): Promise<ZoneWithGeometry>;
	list(params?: ZoneListParams): Promise<ZoneListResponse>;
	update(id: number, body: ZoneUpdateBody): Promise<ZoneRecord>;
}

// --- Factory ---

export const createZones = (request: Requester): ZonesResource => ({
	create: (body) =>
		request<ZoneRecord>({
			method: "POST",
			path: "/api/v1/zones",
			body,
		}),

	list: (params?) =>
		request<ZoneListResponse>({
			method: "GET",
			path: "/api/v1/zones",
			query: { page: params?.page, limit: params?.limit },
		}),

	get: (id) =>
		request<ZoneWithGeometry>({
			method: "GET",
			path: `/api/v1/zones/${id}`,
		}),

	update: (id, body) =>
		request<ZoneRecord>({
			method: "PUT",
			path: `/api/v1/zones/${id}`,
			body,
		}),

	delete: (id) =>
		request<ZoneDeleteResponse>({
			method: "DELETE",
			path: `/api/v1/zones/${id}`,
		}),

	contains: (params) =>
		request<ZoneContainsResponse>({
			method: "GET",
			path: "/api/v1/zones/contains",
			query: { lat: params.lat, lng: params.lng },
		}),

	addresses: (id, params?) =>
		request<ZoneAddressesResponse>({
			method: "GET",
			path: `/api/v1/zones/${id}/addresses`,
			query: { page: params?.page, limit: params?.limit },
		}),
});
