// ---------------------------------------------------------------------------
// Pure geocode query builder.
//
// Kept in its own module — free of env/db/middleware imports — so it can be
// unit-tested without loading `serverEnv` (which validates DATABASE_URL etc. at
// import time and otherwise crashes the test suite). Imported by geocode.ts.
// ---------------------------------------------------------------------------

export type GeocodeQueryInput =
	| { structured: "false"; q: string }
	| {
			structured: "true";
			street: string;
			locality: string;
			state?: string;
	  };

export function buildGeocodeQuery(input: GeocodeQueryInput): string {
	if (input.structured !== "true") {
		return input.q;
	}
	return [input.street, input.locality, input.state].filter(Boolean).join(", ");
}
