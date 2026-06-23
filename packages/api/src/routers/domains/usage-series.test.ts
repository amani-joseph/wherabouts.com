import { describe, expect, it } from "vitest";
import {
	buildDateAxis,
	buildTimeSeries,
	type UsageRow,
} from "./usage-series.ts";

const now = new Date("2026-06-22T09:00:00Z");

describe("buildDateAxis", () => {
	it("returns an inclusive UTC day axis ending today, oldest first", () => {
		const axis = buildDateAxis(7, now);
		expect(axis).toHaveLength(7);
		expect(axis[0]).toBe("2026-06-16");
		expect(axis.at(-1)).toBe("2026-06-22");
	});
});

describe("buildTimeSeries", () => {
	const rows: UsageRow[] = [
		{ usageDate: "2026-06-22", endpoint: "addresses.autocomplete", count: 100 },
		{ usageDate: "2026-06-22", endpoint: "addresses.geocode", count: 40 },
		{ usageDate: "2026-06-21", endpoint: "addresses.autocomplete", count: 60 },
		{ usageDate: "2026-06-20", endpoint: "routing.directions", count: 25 },
	];

	it("zero-fills the axis and buckets unknown endpoints into other", () => {
		const ts = buildTimeSeries(rows, "7d", now);
		expect(ts.series).toHaveLength(7);
		const today = ts.series.at(-1);
		expect(today?.date).toBe("2026-06-22");
		expect(today?.autocomplete).toBe(100);
		expect(today?.geocode).toBe(40);
		expect(today?.total).toBe(140);
		// routing.directions is not a named series -> other
		const jun20 = ts.series.find((p) => p.date === "2026-06-20");
		expect(jun20?.other).toBe(25);
		// days with no traffic are present and zeroed
		expect(ts.series.find((p) => p.date === "2026-06-17")?.total).toBe(0);
	});

	it("computes range-scoped summary metrics", () => {
		const ts = buildTimeSeries(rows, "7d", now);
		expect(ts.summary.totalRequests).toBe(225);
		expect(ts.summary.requestsToday).toBe(140);
		expect(ts.summary.avgPerDay).toBe(Math.round(225 / 7));
		expect(ts.summary.peakDay).toEqual({ date: "2026-06-22", count: 140 });
		expect(ts.summary.mostActive?.key).toBe("autocomplete");
		expect(ts.summary.mostActive?.count).toBe(160);
	});

	it("returns all-zero series and null summary parts with no rows", () => {
		const ts = buildTimeSeries([], "30d", now);
		expect(ts.series).toHaveLength(30);
		expect(ts.summary.totalRequests).toBe(0);
		expect(ts.summary.peakDay).toBeNull();
		expect(ts.summary.mostActive).toBeNull();
	});
});
