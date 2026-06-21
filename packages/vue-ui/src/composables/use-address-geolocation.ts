import { type MaybeRefOrGetter, ref, toValue, watch } from "vue";

/**
 * Reactive browser geolocation — Vue port of react-ui's `useAddressGeolocation`.
 * When `enabled` is truthy, resolves the device coordinates once for proximity
 * biasing. SSR-safe: no-ops when `navigator.geolocation` is unavailable.
 */
export function useAddressGeolocation(enabled: MaybeRefOrGetter<boolean>) {
	const lat = ref<number | undefined>(undefined);
	const lng = ref<number | undefined>(undefined);
	const loading = ref(false);
	const error = ref<GeolocationPositionError | null>(null);

	watch(
		() => toValue(enabled),
		(isEnabled) => {
			if (!isEnabled) {
				return;
			}
			if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
				return;
			}

			loading.value = true;
			navigator.geolocation.getCurrentPosition(
				(position) => {
					lat.value = position.coords.latitude;
					lng.value = position.coords.longitude;
					error.value = null;
					loading.value = false;
				},
				(err) => {
					error.value = err;
					loading.value = false;
				}
			);
		},
		{ immediate: true }
	);

	return { lat, lng, loading, error };
}
