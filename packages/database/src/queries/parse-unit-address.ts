export interface ParsedUnitAddress {
	levelNumber: string | null;
	streetNumber: string;
	streetNumberLast: string | null;
	streetQuery: string;
	unitNumber: string;
	unitNumberLast: string | null;
}

const UNIT_ADDRESS_REGEX = new RegExp(
	[
		"^\\s*",
		"(?:(?:level|lvl|l)\\.?\\s*(\\d+[a-z]?)[\\s,]+)?",
		"(?:(?:apartment|townhouse|villa|suite|unit|shop|flat|apt|ste|u)\\.?\\s*)?",
		"(\\d+[a-z]?)(?:\\s*-\\s*(\\d+[a-z]?))?",
		"\\s*/\\s*",
		"(\\d+[a-z]?)(?:\\s*-\\s*(\\d+[a-z]?))?",
		"(?:[\\s,]+(.+?))?",
		"\\s*$",
	].join(""),
	"i"
);

export function parseUnitAddress(input: string): ParsedUnitAddress | null {
	const match = UNIT_ADDRESS_REGEX.exec(input);
	if (!match) {
		return null;
	}

	const [, levelNumber, unitFirst, unitLast, streetFirst, streetLast, street] =
		match;

	if (!(unitFirst && streetFirst)) {
		return null;
	}

	return {
		unitNumber: unitFirst.toUpperCase(),
		unitNumberLast: unitLast ? unitLast.toUpperCase() : null,
		streetNumber: streetFirst.toUpperCase(),
		streetNumberLast: streetLast ? streetLast.toUpperCase() : null,
		levelNumber: levelNumber ? levelNumber.toUpperCase() : null,
		streetQuery: street ? street.trim() : "",
	};
}
