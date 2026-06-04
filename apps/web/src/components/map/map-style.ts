/**
 * MapLibre style resolution. With a MapTiler key we use their vector "streets"
 * style; without one we fall back to a free raster OpenStreetMap style so maps
 * still render in dev/CI that hasn't set the key.
 */

export type MapStyle = string | object;

/** A self-contained raster style using OSM tiles — no API key required. */
export const FALLBACK_STYLE = {
	version: 8,
	sources: {
		osm: {
			type: "raster",
			tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
			tileSize: 256,
			attribution: "© OpenStreetMap contributors",
		},
	},
	layers: [{ id: "osm", type: "raster", source: "osm" }],
} as const;

export function buildMapStyleUrl(maptilerKey: string | undefined): MapStyle {
	if (!maptilerKey) {
		return FALLBACK_STYLE;
	}
	return `https://api.maptiler.com/maps/streets-v2/style.json?key=${maptilerKey}`;
}
