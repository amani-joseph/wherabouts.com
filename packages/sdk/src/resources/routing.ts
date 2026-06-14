import type { CallOptions, Requester } from "../shared-types.ts";

export type RoutingProfile = "driving" | "walking" | "cycling";

export interface LatLng {
	lat: number;
	lng: number;
}

export interface DirectionsParams {
	from?: string;
	fromAddressId?: number;
	profile?: RoutingProfile;
	to?: string;
	toAddressId?: number;
}

export interface DirectionsGeometry {
	coordinates: [number, number][];
	type: "LineString";
}

export interface IsochronePolygon {
	coordinates: [number, number][][];
	type: "Polygon";
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

// --- matrix (GET) -----------------------------------------------------------

export interface MatrixParams {
	/** Delimited `"lat,lng|lat,lng|<addressId>"` (≤25 points). */
	destinations: string;
	profile?: RoutingProfile;
	/** Delimited `"lat,lng|lat,lng|<addressId>"` (≤25 points). */
	sources: string;
}

export interface MatrixResponse {
	destinations: LatLng[];
	/** Row-major distances in metres; unreachable cells are `null`. */
	distances: (number | null)[][];
	/** Row-major durations in seconds; unreachable cells are `null`. */
	durations: (number | null)[][];
	query: { profile: string };
	sources: LatLng[];
}

// --- isochrone (GET) --------------------------------------------------------

export interface IsochroneParams {
	/** Travel-distance budget in metres (provide exactly one of duration/distance). */
	distanceMeters?: number;
	/** Travel-time budget in seconds (provide exactly one of duration/distance). */
	durationSeconds?: number;
	/** Also return the ABS regions the isochrone overlaps. */
	includeRegions?: boolean;
	/** CSV of region layers to filter the overlap (e.g. `"sa2,lga"`). */
	layers?: string;
	/** `"lat,lng"` or a G-NAF address id (as a string). */
	origin?: string;
	/** Convenience: a G-NAF address id; mapped to `origin` when `origin` is unset. */
	originAddressId?: number;
	profile?: RoutingProfile;
}

export interface IsochroneResponse {
	polygon: IsochronePolygon;
	query: {
		origin: LatLng;
		profile: string;
		durationSeconds?: number;
		distanceMeters?: number;
	};
	regions?: Record<string, { code: string; name: string }>;
}

// --- match (POST) -----------------------------------------------------------

export interface MatchPoint extends LatLng {
	/** GPS accuracy in metres. */
	radius?: number;
	/** UNIX seconds; all-or-none across points, strictly increasing. */
	timestamp?: number;
}

export interface MatchParams {
	coordinates: MatchPoint[];
	gaps?: "split" | "ignore";
	profile?: RoutingProfile;
	tidy?: boolean;
}

export interface Matching {
	confidence: number;
	distance_m: number;
	duration_s: number;
	geometry: DirectionsGeometry;
}

export interface Tracepoint {
	location: [number, number];
	matchings_index: number;
	waypoint_index: number;
}

export interface MatchResponse {
	matchings: Matching[];
	query: { profile: string };
	/** One entry per input point; `null` where OSRM dropped it as an outlier. */
	tracepoints: (Tracepoint | null)[];
}

// --- optimize (POST) --------------------------------------------------------

export interface OptimizeWaypoint {
	addressId?: number;
	lat?: number;
	lng?: number;
}

export interface OptimizeParams {
	destination?: "any" | "last";
	profile?: RoutingProfile;
	roundtrip?: boolean;
	source?: "any" | "first";
	waypoints: OptimizeWaypoint[];
}

export interface OptimizeTrip {
	distance_m: number;
	duration_s: number;
	geometry: DirectionsGeometry;
}

export interface OptimizeResponse {
	query: { profile: string; roundtrip: boolean };
	trips: OptimizeTrip[];
	/** Each input waypoint with its resolved coords and optimised tour position. */
	waypoints: { input_index: number; coords: LatLng; order: number | null }[];
}

export interface RoutingResource {
	directions(
		params: DirectionsParams,
		options?: CallOptions
	): Promise<DirectionsResponse>;
	isochrone(
		params: IsochroneParams,
		options?: CallOptions
	): Promise<IsochroneResponse>;
	match(params: MatchParams, options?: CallOptions): Promise<MatchResponse>;
	matrix(params: MatrixParams, options?: CallOptions): Promise<MatrixResponse>;
	optimize(
		params: OptimizeParams,
		options?: CallOptions
	): Promise<OptimizeResponse>;
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

	matrix: (params, options) =>
		request<MatrixResponse>({
			method: "GET",
			path: "/api/v1/routing/matrix",
			query: {
				sources: params.sources,
				destinations: params.destinations,
				profile: params.profile,
			},
			...options,
		}),

	isochrone: (params, options) =>
		request<IsochroneResponse>({
			method: "GET",
			path: "/api/v1/routing/isochrone",
			query: {
				origin:
					params.origin ??
					(params.originAddressId === undefined
						? undefined
						: String(params.originAddressId)),
				profile: params.profile,
				durationSeconds: params.durationSeconds,
				distanceMeters: params.distanceMeters,
				includeRegions:
					params.includeRegions === undefined
						? undefined
						: String(params.includeRegions),
				layers: params.layers,
			},
			...options,
		}),

	match: (params, options) =>
		request<MatchResponse>({
			method: "POST",
			path: "/api/v1/routing/match",
			body: {
				profile: params.profile,
				coordinates: params.coordinates,
				gaps: params.gaps,
				tidy: params.tidy,
			},
			...options,
		}),

	optimize: (params, options) =>
		request<OptimizeResponse>({
			method: "POST",
			path: "/api/v1/routing/optimize",
			body: {
				profile: params.profile,
				waypoints: params.waypoints,
				roundtrip: params.roundtrip,
				source: params.source,
				destination: params.destination,
			},
			...options,
		}),
});
