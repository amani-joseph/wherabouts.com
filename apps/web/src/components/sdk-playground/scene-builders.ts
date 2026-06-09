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
