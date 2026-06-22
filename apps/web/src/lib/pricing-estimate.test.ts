import { describe, expect, it } from "vitest";
import { estimateMonthlyCost } from "./pricing-estimate";

describe("estimateMonthlyCost", () => {
	it("is free at or below the free allotment", () => {
		expect(estimateMonthlyCost(0)).toEqual({
			billableRequests: 0,
			monthlyCostUsd: 0,
		});
		expect(estimateMonthlyCost(15_000)).toEqual({
			billableRequests: 0,
			monthlyCostUsd: 0,
		});
	});

	it("charges $0.70 per 1,000 requests beyond the free allotment", () => {
		// 50,000 requests => 35,000 billable => $24.50
		expect(estimateMonthlyCost(50_000)).toEqual({
			billableRequests: 35_000,
			monthlyCostUsd: 24.5,
		});
	});

	it("rounds the cost to cents", () => {
		// 15,500 requests => 500 billable => $0.35
		expect(estimateMonthlyCost(15_500).monthlyCostUsd).toBe(0.35);
		// 15,001 => 1 billable => $0.0007 => rounds to $0.00
		expect(estimateMonthlyCost(15_001).monthlyCostUsd).toBe(0);
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
