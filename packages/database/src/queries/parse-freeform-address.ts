import { isDirectional } from "./address-abbreviations.ts";
import { matchCountry } from "./country-codes.ts";

export interface ParsedFreeformAddress {
	cleaned: string;
	confidence: "high" | "low";
	countryCode: string | null;
	directional: string | null;
	houseNumber: string | null;
	locality: string | null;
	postcode: string | null;
	region: string | null;
	segments: string[];
	streetTokens: string[];
}

// US ZIP, AU/EU 4-digit, CA. Anchored fragments tried against a segment's tokens.
const POSTCODE_PATTERNS: RegExp[] = [
	/^\d{5}(?:-\d{4})?$/, // US
	/^\d{4}$/, // AU + much of EU
	/^[A-Z]\d[A-Z]$/, // CA outward (paired with a second token below)
];
const UK_OUTWARD = /^[A-Z]{1,2}\d[A-Z\d]?$/;
const UK_INWARD = /^\d[A-Z]{2}$/;
const HOUSE_NUMBER = /^\d+[A-Z]?(?:-\d+[A-Z]?)?$/;
const WHITESPACE = /\s+/;
// 2-letter US/AU region codes (rerank only; not exhaustive by design).
const REGION_CODES = new Set([
	"AL",
	"AK",
	"AZ",
	"AR",
	"CA",
	"CO",
	"CT",
	"DE",
	"FL",
	"GA",
	"HI",
	"ID",
	"IL",
	"IN",
	"IA",
	"KS",
	"KY",
	"LA",
	"ME",
	"MD",
	"MA",
	"MI",
	"MN",
	"MS",
	"MO",
	"MT",
	"NE",
	"NV",
	"NH",
	"NJ",
	"NM",
	"NY",
	"NC",
	"ND",
	"OH",
	"OK",
	"OR",
	"PA",
	"RI",
	"SC",
	"SD",
	"TN",
	"TX",
	"UT",
	"VT",
	"VA",
	"WA",
	"WV",
	"WI",
	"WY",
	"NSW",
	"VIC",
	"QLD",
	"SA",
	"TAS",
	"NT",
	"ACT",
]);

function extractPostcodeAndRegion(tokens: string[]): {
	postcode: string | null;
	region: string | null;
	rest: string[];
} {
	const rest = [...tokens];
	let postcode: string | null = null;
	let region: string | null = null;

	// UK: two-token "SW1A 2AA" at the end.
	if (rest.length >= 2) {
		const last = rest.at(-1) as string;
		const prev = rest.at(-2) as string;
		if (UK_INWARD.test(last) && UK_OUTWARD.test(prev)) {
			postcode = `${prev} ${last}`;
			rest.splice(rest.length - 2, 2);
		}
	}

	if (!postcode) {
		for (let i = rest.length - 1; i >= 0; i--) {
			if (POSTCODE_PATTERNS.some((re) => re.test(rest[i] as string))) {
				postcode = rest[i] as string;
				rest.splice(i, 1);
				break;
			}
		}
	}

	for (let i = rest.length - 1; i >= 0; i--) {
		if (REGION_CODES.has(rest[i] as string)) {
			region = rest[i] as string;
			rest.splice(i, 1);
			break;
		}
	}

	return { postcode, region, rest };
}

export function parseFreeformAddress(input: string): ParsedFreeformAddress {
	const upper = input.trim().toUpperCase();
	const rawSegments = upper
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);

	if (rawSegments.length === 0) {
		return {
			houseNumber: null,
			directional: null,
			streetTokens: [],
			locality: null,
			region: null,
			postcode: null,
			countryCode: null,
			segments: rawSegments,
			cleaned: upper,
			confidence: "low",
		};
	}

	const segments = [...rawSegments];

	// 1. Country — only from the final segment.
	let countryCode: string | null = null;
	const lastCountry = matchCountry(segments.at(-1) as string);
	if (lastCountry) {
		countryCode = lastCountry;
		segments.pop();
	}

	// 2. Postcode + region — only from the (new) trailing segment's tokens.
	let postcode: string | null = null;
	let region: string | null = null;
	if (segments.length > 0) {
		const tailTokens = (segments.at(-1) as string)
			.split(WHITESPACE)
			.filter(Boolean);
		const extracted = extractPostcodeAndRegion(tailTokens);
		postcode = extracted.postcode;
		region = extracted.region;
		if (extracted.rest.length === 0) {
			segments.pop();
		} else {
			segments[segments.length - 1] = extracted.rest.join(" ");
		}
	}

	// 3. Street segment = first remaining; locality = the rest joined.
	let houseNumber: string | null = null;
	let directional: string | null = null;
	let streetTokens: string[] = [];
	let locality: string | null = null;

	if (segments.length > 0) {
		const streetTokensRaw = (segments[0] as string)
			.split(WHITESPACE)
			.filter(Boolean);
		if (
			streetTokensRaw.length > 0 &&
			HOUSE_NUMBER.test(streetTokensRaw[0] as string)
		) {
			houseNumber = streetTokensRaw.shift() as string;
		}
		if (
			streetTokensRaw.length > 0 &&
			isDirectional(streetTokensRaw[0] as string)
		) {
			directional = streetTokensRaw.shift() as string;
		}
		streetTokens = streetTokensRaw;

		const localitySegments = segments.slice(1);
		if (localitySegments.length > 0) {
			locality = localitySegments.join(" ");
		}
	}

	const cleaned = [
		houseNumber,
		directional,
		...streetTokens,
		locality,
		region,
		postcode,
	]
		.filter(Boolean)
		.join(" ");

	const confidence: "high" | "low" =
		countryCode || postcode || rawSegments.length >= 2 ? "high" : "low";

	return {
		houseNumber,
		directional,
		streetTokens,
		locality,
		region,
		postcode,
		countryCode,
		segments: rawSegments,
		cleaned: cleaned || upper,
		confidence,
	};
}
