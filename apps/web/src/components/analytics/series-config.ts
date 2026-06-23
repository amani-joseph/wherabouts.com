/**
 * Client-side rendering config for the usage chart. Series keys + order mirror
 * the server's `usage-series.ts`; colors map to the design-system `--chart-*`
 * tokens (defined for both light and dark in globals.css) so the chart themes
 * automatically. "Other" uses a neutral token so named endpoints stay prominent.
 */
export interface UsageSeriesDef {
	color: string;
	key: "autocomplete" | "geocode" | "reverse" | "nearby" | "classify" | "other";
	label: string;
}

export const USAGE_SERIES_UI: readonly UsageSeriesDef[] = [
	{ key: "autocomplete", label: "Autocomplete", color: "var(--chart-1)" },
	{ key: "geocode", label: "Geocode", color: "var(--chart-2)" },
	{ key: "reverse", label: "Reverse Geocode", color: "var(--chart-3)" },
	{ key: "nearby", label: "Nearby Search", color: "var(--chart-4)" },
	{ key: "classify", label: "Classify", color: "var(--chart-5)" },
	{ key: "other", label: "Other", color: "var(--muted-foreground)" },
] as const;

export type UsageSeriesKey = UsageSeriesDef["key"];

/** Compact request count, e.g. 1234 -> "1.2K", 2_500_000 -> "2.5M". */
export function formatCompact(value: number): string {
	if (value < 1000) {
		return value.toLocaleString();
	}
	if (value < 1_000_000) {
		return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}K`;
	}
	return `${(value / 1_000_000).toFixed(1)}M`;
}

/** "2026-06-22" -> "Jun 22". */
export function formatAxisDate(iso: string): string {
	const d = new Date(`${iso}T00:00:00Z`);
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	});
}

/** "2026-06-22" -> "Sunday, Jun 22, 2026" for tooltip headers. */
export function formatFullDate(iso: string): string {
	const d = new Date(`${iso}T00:00:00Z`);
	return d.toLocaleDateString("en-US", {
		weekday: "long",
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	});
}
