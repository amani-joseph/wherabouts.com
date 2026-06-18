/**
 * Country name / alias / ISO code → ISO-2, scoped to the loaded countries
 * (AU + US + the intl ingest set). Exact, case-insensitive match only; no fuzzy
 * matching (a mis-detected country becomes a wrong hard filter). See design §4.2.
 */
const COUNTRY_NAME_TO_ISO: Record<string, string> = {
	"united states": "US",
	"united states of america": "US",
	usa: "US",
	"u.s.": "US",
	"u.s.a.": "US",
	us: "US",
	australia: "AU",
	au: "AU",
	"united kingdom": "GB",
	"great britain": "GB",
	uk: "GB",
	gb: "GB",
	france: "FR",
	fr: "FR",
	germany: "DE",
	de: "DE",
	spain: "ES",
	es: "ES",
	italy: "IT",
	it: "IT",
	netherlands: "NL",
	nl: "NL",
	belgium: "BE",
	be: "BE",
	austria: "AT",
	at: "AT",
	switzerland: "CH",
	ch: "CH",
	portugal: "PT",
	pt: "PT",
	poland: "PL",
	pl: "PL",
	denmark: "DK",
	dk: "DK",
	norway: "NO",
	no: "NO",
	finland: "FI",
	fi: "FI",
	canada: "CA",
	ca: "CA",
};

export function matchCountry(text: string): string | null {
	return COUNTRY_NAME_TO_ISO[text.trim().toLowerCase()] ?? null;
}
