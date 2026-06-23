/**
 * Pure transforms for the analytics usage time-series. Kept separate from the
 * oRPC handler so the zero-fill / bucketing / summary logic is unit-testable
 * without a database. The dashboard procedure runs the SQL and feeds rows here.
 */

/** The five first-class endpoints charted as named, colored series. */
export const USAGE_SERIES = [
	{
		key: "autocomplete",
		label: "Autocomplete",
		endpoint: "addresses.autocomplete",
	},
	{ key: "geocode", label: "Geocode", endpoint: "addresses.geocode" },
	{ key: "reverse", label: "Reverse Geocode", endpoint: "addresses.reverse" },
	{ key: "nearby", label: "Nearby Search", endpoint: "addresses.nearby" },
	{ key: "classify", label: "Classify", endpoint: "regions.classify" },
] as const;

/** Everything not in USAGE_SERIES is bucketed here so totals stay truthful. */
export const OTHER_SERIES = { key: "other", label: "Other" } as const;

export type UsageSeriesKey =
	| (typeof USAGE_SERIES)[number]["key"]
	| typeof OTHER_SERIES.key;

export const USAGE_RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type UsageRange = keyof typeof USAGE_RANGES;

const ENDPOINT_TO_KEY = new Map<string, UsageSeriesKey>(
	USAGE_SERIES.map((s) => [s.endpoint, s.key])
);
const ALL_KEYS: UsageSeriesKey[] = [
	...USAGE_SERIES.map((s) => s.key),
	OTHER_SERIES.key,
];

export interface UsageRow {
	count: number;
	endpoint: string;
	usageDate: string;
}

export type UsagePoint = { date: string; total: number } & Record<
	UsageSeriesKey,
	number
>;

export interface UsageSummary {
	avgPerDay: number;
	mostActive: { key: UsageSeriesKey; label: string; count: number } | null;
	peakDay: { date: string; count: number } | null;
	requestsToday: number;
	totalRequests: number;
}

export interface UsageTimeSeries {
	days: number;
	perSeriesTotals: Record<UsageSeriesKey, number>;
	range: UsageRange;
	series: UsagePoint[];
	summary: UsageSummary;
}

/** UTC `YYYY-MM-DD` for a Date. */
function isoDate(d: Date): string {
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/** Inclusive UTC day axis ending today, oldest first. */
export function buildDateAxis(days: number, now: Date): string[] {
	const axis: string[] = [];
	for (let i = days - 1; i >= 0; i--) {
		axis.push(
			isoDate(
				new Date(
					Date.UTC(
						now.getUTCFullYear(),
						now.getUTCMonth(),
						now.getUTCDate() - i
					)
				)
			)
		);
	}
	return axis;
}

const emptyPoint = (date: string): UsagePoint => ({
	date,
	total: 0,
	autocomplete: 0,
	geocode: 0,
	reverse: 0,
	nearby: 0,
	classify: 0,
	other: 0,
});

const labelFor = (key: UsageSeriesKey): string =>
	USAGE_SERIES.find((s) => s.key === key)?.label ?? OTHER_SERIES.label;

/**
 * Zero-fill the day axis, bucket each row into its series (unknown endpoints →
 * "other"), and derive the range-scoped summary metrics.
 */
export function buildTimeSeries(
	rows: UsageRow[],
	range: UsageRange,
	now: Date
): UsageTimeSeries {
	const days = USAGE_RANGES[range];
	const axis = buildDateAxis(days, now);
	const byDate = new Map<string, UsagePoint>(
		axis.map((d) => [d, emptyPoint(d)])
	);
	const todayStr = axis.at(-1) ?? isoDate(now);

	const perSeriesTotals = Object.fromEntries(
		ALL_KEYS.map((k) => [k, 0])
	) as Record<UsageSeriesKey, number>;

	for (const row of rows) {
		const point = byDate.get(row.usageDate);
		if (!point) {
			continue;
		}
		const key = ENDPOINT_TO_KEY.get(row.endpoint) ?? OTHER_SERIES.key;
		point[key] += row.count;
		point.total += row.count;
		perSeriesTotals[key] += row.count;
	}

	const series = axis.map((d) => byDate.get(d) ?? emptyPoint(d));
	const totalRequests = series.reduce((sum, p) => sum + p.total, 0);
	const requestsToday = byDate.get(todayStr)?.total ?? 0;

	let peakDay: UsageSummary["peakDay"] = null;
	for (const p of series) {
		if (p.total > 0 && (!peakDay || p.total > peakDay.count)) {
			peakDay = { date: p.date, count: p.total };
		}
	}

	let mostActive: UsageSummary["mostActive"] = null;
	for (const key of ALL_KEYS) {
		const count = perSeriesTotals[key];
		if (count > 0 && (!mostActive || count > mostActive.count)) {
			mostActive = { key, label: labelFor(key), count };
		}
	}

	return {
		range,
		days,
		series,
		perSeriesTotals,
		summary: {
			totalRequests,
			requestsToday,
			avgPerDay: days > 0 ? Math.round(totalRequests / days) : 0,
			peakDay,
			mostActive,
		},
	};
}
