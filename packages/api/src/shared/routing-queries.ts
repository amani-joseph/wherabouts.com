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

/**
 * Public routing profile. The API speaks `driving|walking|cycling`; OSRM speaks
 * `car|foot|bike`. The Caddy front routes on the OSRM `{profile}` path segment,
 * so this mapping is what selects the car/foot/bike graph backend.
 */
export type RoutingProfile = "driving" | "walking" | "cycling";

const OSRM_PROFILE: Record<RoutingProfile, string> = {
	driving: "car",
	walking: "foot",
	cycling: "bike",
};

interface OsrmResponse {
	code: string;
	routes?: {
		distance: number;
		duration: number;
		geometry: GeoJsonLineString;
	}[];
}

/**
 * Shared OSRM call plumbing. Builds `/{service}/v1/{osrmProfile}/{coords}`
 * against `options.baseUrl`, attaches the bearer token, and returns parsed JSON
 * — throwing `RoutingError("unavailable")` on transport failure or a non-200
 * response. `fetchImpl` must already be bound to its global (Workers' native
 * fetch throws "Illegal invocation" otherwise).
 */
async function osrmRequest(
	service: "route" | "table",
	profile: RoutingProfile,
	coords: string,
	query: Record<string, string>,
	options: OsrmOptions
): Promise<unknown> {
	const url = new URL(
		`/${service}/v1/${OSRM_PROFILE[profile]}/${coords}`,
		options.baseUrl
	);
	for (const [key, value] of Object.entries(query)) {
		url.searchParams.set(key, value);
	}

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

	return await response.json();
}

/** Call OSRM's route service for the given profile and map the result to our envelope. */
export async function fetchOsrmRoute(
	from: LatLng,
	to: LatLng,
	options: OsrmOptions,
	profile: RoutingProfile = "driving"
): Promise<DirectionsResult> {
	// OSRM coordinate order is lon,lat (not lat,lng).
	const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
	const body = (await osrmRequest(
		"route",
		profile,
		coords,
		{ overview: "full", geometries: "geojson" },
		options
	)) as OsrmResponse;

	const route = body.code === "Ok" ? body.routes?.[0] : undefined;
	if (!route) {
		throw new RoutingError(
			"no_route",
			"No route between the given points for this profile."
		);
	}

	return {
		distance_m: Math.round(route.distance),
		duration_s: Math.round(route.duration),
		geometry: route.geometry,
	};
}
