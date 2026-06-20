/**
 * Builds a single-line formatted address from its components.
 *
 * Country-agnostic: empty/nullish parts are dropped rather than emitted as
 * stray spaces or commas. Stateless countries (e.g. Iceland, UK, France) store
 * `state = ''`; without this filtering the old `${locality} ${state} ${postcode}`
 * template produced double spaces ("Reykjanesbær  233"). The locality line keeps
 * the space-delimited `Locality State Postcode` order (matches G-NAF/`search_text`
 * convention) but simply omits whichever parts are absent.
 */
export function formatAddress(
	streetAddress: string,
	parts: {
		locality: string | null;
		state: string | null;
		postcode: string | null;
		country: string | null;
	}
): string {
	const localityLine = [parts.locality, parts.state, parts.postcode]
		.map((part) => part?.trim())
		.filter(Boolean)
		.join(" ");

	return [streetAddress.trim(), localityLine, parts.country?.trim()]
		.filter(Boolean)
		.join(", ");
}
