import type { Database } from "@wherabouts.com/database";
import { addresses } from "@wherabouts.com/database/schema";
import { eq } from "drizzle-orm";

export interface LatLng {
	lat: number;
	lng: number;
}

export interface GeoJsonLineString {
	coordinates: [number, number][];
	type: "LineString";
}

export interface DirectionsResult {
	distance_m: number;
	duration_s: number;
	geometry: GeoJsonLineString;
}

export type RoutingErrorKind = "no_route" | "unavailable";

export class RoutingError extends Error {
	readonly kind: RoutingErrorKind;
	constructor(kind: RoutingErrorKind, message: string) {
		super(message);
		this.name = "RoutingError";
		this.kind = kind;
	}
}

const LAT_MAX = 90;
const LNG_MAX = 180;

/** Parse a `"lat,lng"` string. Returns null when malformed or out of range. */
export function parseLatLng(raw: string): LatLng | null {
	const parts = raw.split(",");
	if (parts.length !== 2) {
		return null;
	}
	const lat = Number(parts[0]);
	const lng = Number(parts[1]);
	if (!(Number.isFinite(lat) && Number.isFinite(lng))) {
		return null;
	}
	if (Math.abs(lat) > LAT_MAX || Math.abs(lng) > LNG_MAX) {
		return null;
	}
	return { lat, lng };
}

/** Resolve a G-NAF address id to coordinates. Returns null if not found. */
export async function resolveAddressCoords(
	db: Database,
	id: number
): Promise<LatLng | null> {
	const rows = await db
		.select({ latitude: addresses.latitude, longitude: addresses.longitude })
		.from(addresses)
		.where(eq(addresses.id, id))
		.limit(1);
	const row = rows[0];
	if (!row) {
		return null;
	}
	return { lat: row.latitude, lng: row.longitude };
}

interface OsrmOptions {
	authToken: string;
	baseUrl: string;
	fetchImpl: typeof fetch;
}

interface OsrmResponse {
	code: string;
	routes?: {
		distance: number;
		duration: number;
		geometry: GeoJsonLineString;
	}[];
}

/** Call OSRM's driving route service and map the result to our envelope. */
export async function fetchOsrmRoute(
	from: LatLng,
	to: LatLng,
	options: OsrmOptions
): Promise<DirectionsResult> {
	// OSRM coordinate order is lon,lat (not lat,lng).
	const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
	const url = new URL(`/route/v1/driving/${coords}`, options.baseUrl);
	url.searchParams.set("overview", "full");
	url.searchParams.set("geometries", "geojson");

	let response: Response;
	try {
		response = await options.fetchImpl(url, {
			headers: { authorization: `Bearer ${options.authToken}` },
		});
	} catch (error) {
		throw new RoutingError(
			"unavailable",
			`OSRM request failed: ${(error as Error).message}`
		);
	}

	if (!response.ok) {
		throw new RoutingError(
			"unavailable",
			`OSRM returned status ${response.status}`
		);
	}

	const body = (await response.json()) as OsrmResponse;
	const route = body.code === "Ok" ? body.routes?.[0] : undefined;
	if (!route) {
		throw new RoutingError(
			"no_route",
			"No drivable route between the given points."
		);
	}

	return {
		distance_m: Math.round(route.distance),
		duration_s: Math.round(route.duration),
		geometry: route.geometry,
	};
}
