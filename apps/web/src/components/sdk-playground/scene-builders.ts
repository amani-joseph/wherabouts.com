import {
	EMPTY_SCENE,
	lngLatFromLatLngString,
	lngLatFromParts,
	type MapFeature,
	type MapScene,
} from "./map-scene.ts";

export function sceneFromInputs(
	endpointId: string,
	paramValues: Record<string, string>
): MapScene {
	const features: MapFeature[] = [];

	if (endpointId === "routing.directions") {
		const from = lngLatFromLatLngString(paramValues.from ?? "");
		if (from) {
			features.push({
				kind: "marker",
				lngLat: from,
				label: "from",
				role: "from",
			});
		}
		const to = lngLatFromLatLngString(paramValues.to ?? "");
		if (to) {
			features.push({ kind: "marker", lngLat: to, label: "to", role: "to" });
		}
		return { features };
	}

	if (endpointId === "addresses.nearby") {
		const center = lngLatFromParts(paramValues.lat, paramValues.lng);
		if (center) {
			features.push({
				kind: "marker",
				lngLat: center,
				label: "center",
				role: "center",
			});
			const radiusM = Number(paramValues.radius);
			if (Number.isFinite(radiusM) && radiusM > 0) {
				features.push({ kind: "circle", center, radiusM });
			}
		}
		return { features };
	}

	if (endpointId === "addresses.reverse") {
		const point = lngLatFromParts(paramValues.lat, paramValues.lng);
		if (point) {
			features.push({
				kind: "marker",
				lngLat: point,
				label: "point",
				role: "point",
			});
		}
		return { features };
	}

	return EMPTY_SCENE;
}

// --- result parsing helpers (defensive: input is unknown) -----------------

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: null;
}

function markerFromLatLngFields(
	value: unknown,
	role: "result"
): MapFeature | null {
	const rec = asRecord(value);
	if (!rec) {
		return null;
	}
	const lat = rec.latitude;
	const lng = rec.longitude;
	if (typeof lat === "number" && typeof lng === "number") {
		return { kind: "marker", lngLat: [lng, lat], label: role, role };
	}
	return null;
}

function markerFromLatLngObject(
	value: unknown,
	label: "from" | "to"
): MapFeature | null {
	const rec = asRecord(value);
	if (!rec) {
		return null;
	}
	const lat = rec.lat;
	const lng = rec.lng;
	if (typeof lat === "number" && typeof lng === "number") {
		return { kind: "marker", lngLat: [lng, lat], label, role: label };
	}
	return null;
}

function isLngLatArray(value: unknown): value is [number, number] {
	return (
		Array.isArray(value) &&
		value.length === 2 &&
		typeof value[0] === "number" &&
		typeof value[1] === "number"
	);
}

function polygonFromGeometry(value: unknown): MapFeature | null {
	const rec = asRecord(value);
	if (!rec || rec.type !== "Polygon" || !Array.isArray(rec.coordinates)) {
		return null;
	}
	const rings: [number, number][][] = [];
	for (const ring of rec.coordinates) {
		if (!Array.isArray(ring)) {
			return null;
		}
		const points = ring.filter(isLngLatArray);
		if (points.length > 0) {
			rings.push(points);
		}
	}
	return rings.length > 0 ? { kind: "polygon", rings } : null;
}

type ResultParser = (rec: Record<string, unknown>) => MapFeature[];

function parseRoutingDirections(rec: Record<string, unknown>): MapFeature[] {
	const features: MapFeature[] = [];
	const geometry = asRecord(rec.geometry);
	if (geometry && Array.isArray(geometry.coordinates)) {
		const coords = geometry.coordinates.filter(isLngLatArray);
		if (coords.length > 0) {
			features.push({ kind: "line", coordinates: coords });
		}
	}
	const query = asRecord(rec.query);
	if (query) {
		const from = markerFromLatLngObject(query.from, "from");
		if (from) {
			features.push(from);
		}
		const to = markerFromLatLngObject(query.to, "to");
		if (to) {
			features.push(to);
		}
	}
	return features;
}

function parseAddressEnvelope(rec: Record<string, unknown>): MapFeature[] {
	const marker = markerFromLatLngFields(rec.address, "result");
	return marker ? [marker] : [];
}

function parseAddressTopLevel(rec: Record<string, unknown>): MapFeature[] {
	const marker = markerFromLatLngFields(rec, "result");
	return marker ? [marker] : [];
}

function parseAddressList(rec: Record<string, unknown>): MapFeature[] {
	if (!Array.isArray(rec.results)) {
		return [];
	}
	const features: MapFeature[] = [];
	for (const row of rec.results) {
		const marker = markerFromLatLngFields(row, "result");
		if (marker) {
			features.push(marker);
		}
	}
	return features;
}

function parseZoneGet(rec: Record<string, unknown>): MapFeature[] {
	const polygon = polygonFromGeometry(rec.geometry);
	return polygon ? [polygon] : [];
}

function parseZoneList(rec: Record<string, unknown>): MapFeature[] {
	if (!Array.isArray(rec.zones)) {
		return [];
	}
	const features: MapFeature[] = [];
	for (const zone of rec.zones) {
		const zoneRec = asRecord(zone);
		const polygon = zoneRec ? polygonFromGeometry(zoneRec.geometry) : null;
		if (polygon) {
			features.push(polygon);
		}
	}
	return features;
}

const RESULT_PARSERS: Record<string, ResultParser> = {
	"routing.directions": parseRoutingDirections,
	"addresses.geocode": parseAddressEnvelope,
	"addresses.reverse": parseAddressEnvelope,
	"addresses.byId": parseAddressTopLevel,
	"addresses.autocomplete": parseAddressList,
	"addresses.nearby": parseAddressList,
	"zones.get": parseZoneGet,
	"zones.list": parseZoneList,
};

export function sceneFromResult(endpointId: string, result: unknown): MapScene {
	const rec = asRecord(result);
	if (!rec) {
		return EMPTY_SCENE;
	}
	const parser = RESULT_PARSERS[endpointId];
	if (!parser) {
		return EMPTY_SCENE;
	}
	return { features: parser(rec) };
}
