// Single source of truth for the executable API-explorer endpoint ids.
//
// This module is intentionally dependency-free so it can be imported from the
// web package's drift-guard test. Importing the full `api-explorer.ts` proxy
// module would transitively pull in `serverEnv` (and other server-only deps),
// which fail env validation in the browser-package test environment.
export const EXPLORER_ENDPOINT_ID_LIST = [
	"addresses.autocomplete",
	"addresses.byId",
	"addresses.geocode",
	"addresses.nearby",
	"addresses.reverse",
	"devices.location.push",
	"devices.zones",
	"geocode.batch.poll",
	"geocode.batch.results",
	"geocode.batch.submit",
	"regions.classify",
	"webhooks.create",
	"webhooks.delete",
	"webhooks.list",
	"webhooks.reactivate",
	"zones.addresses",
	"zones.contains",
	"zones.create",
	"zones.delete",
	"zones.get",
	"zones.list",
	"zones.update",
] as const;

export type ExplorerEndpointId = (typeof EXPLORER_ENDPOINT_ID_LIST)[number];

export const EXPLORER_ENDPOINT_IDS: ReadonlySet<string> = new Set(
	EXPLORER_ENDPOINT_ID_LIST
);
