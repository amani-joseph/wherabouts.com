import { describe, expect, it } from "vitest";
import { estimateMonthlyCost } from "./pricing-estimate";

describe("estimateMonthlyCost", () => {
	it("is free at or below the free allotment", () => {
		expect(estimateMonthlyCost(0)).toEqual({
			billableRequests: 0,
			monthlyCostUsd: 0,
		});
		expect(estimateMonthlyCost(10_000)).toEqual({
			billableRequests: 0,
			monthlyCostUsd: 0,
		});
	});

	it("charges $1.00 per 1,000 requests beyond the free allotment", () => {
		// 50,000 requests => 40,000 billable => $40.00
		expect(estimateMonthlyCost(50_000)).toEqual({
			billableRequests: 40_000,
			monthlyCostUsd: 40,
		});
	});

	it("rounds the cost to cents", () => {
		// 10,500 requests => 500 billable => $0.50
		expect(estimateMonthlyCost(10_500).monthlyCostUsd).toBe(0.5);
		// 10,001 => 1 billable => $0.001 => rounds to $0.00
		expect(estimateMonthlyCost(10_001).monthlyCostUsd).toBe(0);
	});

	it("honours custom allotment and rate overrides", () => {
		expect(
			estimateMonthlyCost(2000, { freeAllotment: 0, ratePer1kUsd: 2 })
		).toEqual({ billableRequests: 2000, monthlyCostUsd: 4 });
	});

	it("clamps invalid input to zero", () => {
		expect(estimateMonthlyCost(-100)).toEqual({
			billableRequests: 0,
			monthlyCostUsd: 0,
		});
		expect(estimateMonthlyCost(Number.NaN)).toEqual({
			billableRequests: 0,
			monthlyCostUsd: 0,
		});
	});
});
