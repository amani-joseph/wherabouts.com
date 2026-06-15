// @wherabouts/react — React hooks for the Wherabouts location API

export type { StorageLike } from "./autocomplete-cache.ts";
export type {
	AutocompleteCacheConfig,
	AutocompleteStatus,
	UseAutocompleteOptions,
	UseAutocompleteResult,
} from "./use-autocomplete.ts";
// biome-ignore lint/performance/noBarrelFile: this is the package's public entry point — a single barrel is the intended module surface.
export { deriveStatus, useAutocomplete } from "./use-autocomplete.ts";

export type {
	LatLng,
	UseReverseGeocodeResult,
} from "./use-reverse-geocode.ts";
export { useReverseGeocode } from "./use-reverse-geocode.ts";

export type { UseZoneContainsResult } from "./use-zone-contains.ts";
export { useZoneContains } from "./use-zone-contains.ts";
