export interface AddressLabelParts {
	flatNumber: string | null;
	flatType: string | null;
	locality: string;
	numberFirst: string | null;
	numberLast: string | null;
	streetName: string;
	streetType: string | null;
}

/** Title-case a G-NAF uppercase token, e.g. "BOXGROVE" -> "Boxgrove". */
function titleCase(value: string): string {
	return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Compose a human-readable address label from G-NAF parts, e.g.
 * "Unit 16/14 Boxgrove Avenue, Mosman". Missing pieces are dropped.
 */
export function composeAddressLabel(parts: AddressLabelParts): string {
	const streetNumber = parts.numberLast
		? `${parts.numberFirst}-${parts.numberLast}`
		: (parts.numberFirst ?? "");

	let head = "";
	if (parts.flatNumber) {
		const prefix = parts.flatType ? titleCase(parts.flatType) : "Unit";
		head = streetNumber
			? `${prefix} ${parts.flatNumber}/${streetNumber}`
			: `${prefix} ${parts.flatNumber}`;
	} else {
		head = streetNumber;
	}

	const street = [parts.streetName, parts.streetType]
		.filter(Boolean)
		.map((s) => titleCase(s as string))
		.join(" ");

	const line = [head, street].filter(Boolean).join(" ");
	return `${line}, ${titleCase(parts.locality)}`;
}
