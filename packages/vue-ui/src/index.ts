// biome-ignore lint/performance/noBarrelFile: public entry point
export type {
  AddressWithParsed,
  AddressI18nStrings,
  AddressSuggestionInput,
} from "./types";
export { toAddressWithParsed } from "./utils/parse-address";
export { cn } from "./utils/cn";

// Vue 3 SFC components coming in Phase 2
// export { default as AddressAutocomplete } from "./components/AddressAutocomplete.vue";
// export { default as AddressFormField } from "./components/AddressFormField.vue";
// export { default as ReverseGeocodeInput } from "./components/ReverseGeocodeInput.vue";
// export { default as ForwardGeocodeInput } from "./components/ForwardGeocodeInput.vue";
// export { default as AddressFieldGroup } from "./components/AddressFieldGroup.vue";
