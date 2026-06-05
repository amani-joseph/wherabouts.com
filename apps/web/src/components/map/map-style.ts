/**
 * MapLibre basemap resolution for the (dark) dashboard. We use a dark vector
 * style everywhere for visual consistency. Without a MapTiler key we use the
 * free, no-key, CORS-open OpenFreeMap dark style (also used by the batch
 * results map); with a key we use MapTiler's dark style.
 */

export type MapStyle = string;

/** Free, no-key, CORS-open dark vector basemap (ships glyphs/labels). */
export const OPENFREEMAP_DARK = "https://tiles.openfreemap.org/styles/dark";
/** Light counterpart (for any future light-themed surface). */
export const OPENFREEMAP_LIGHT = "https://tiles.openfreemap.org/styles/positron";

export function buildMapStyleUrl(maptilerKey?: string): MapStyle {
	if (maptilerKey) {
		return `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${maptilerKey}`;
	}
	return OPENFREEMAP_DARK;
}
