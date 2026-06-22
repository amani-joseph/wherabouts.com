/**
 * Pure cost model for the usage-based meter shown on the pricing page.
 *
 * Source of truth for the defaults: the `free_allotment` default in
 * packages/database/src/schema/billing.ts (15,000) and the Stripe metered
 * price of $0.0007/request ($0.70 per 1,000). Keep in sync with the meter.
 */

const DEFAULT_FREE_ALLOTMENT = 15_000;
const DEFAULT_RATE_PER_1K_USD = 0.7;
const REQUESTS_PER_PRICING_UNIT = 1000;
const CENTS_PER_DOLLAR = 100;

export interface PricingEstimate {
	/** Requests beyond the free allotment that are actually billed. */
	billableRequests: number;
	/** Estimated monthly charge in USD, rounded to cents. */
	monthlyCostUsd: number;
}

export interface PricingEstimateOptions {
	freeAllotment?: number;
	ratePer1kUsd?: number;
}

/** Estimate the monthly charge for a given request volume. */
export function estimateMonthlyCost(
	requestsPerMonth: number,
	options: PricingEstimateOptions = {}
): PricingEstimate {
	const freeAllotment = options.freeAllotment ?? DEFAULT_FREE_ALLOTMENT;
	const ratePer1kUsd = options.ratePer1kUsd ?? DEFAULT_RATE_PER_1K_USD;

	// Treat negative/NaN volumes as zero so the UI can pass raw input safely.
	const requests =
		Number.isFinite(requestsPerMonth) && requestsPerMonth > 0
			? requestsPerMonth
			: 0;

	const billableRequests = Math.max(0, requests - freeAllotment);
	const rawCost = (billableRequests / REQUESTS_PER_PRICING_UNIT) * ratePer1kUsd;
	const monthlyCostUsd =
		Math.round(rawCost * CENTS_PER_DOLLAR) / CENTS_PER_DOLLAR;

	return { billableRequests, monthlyCostUsd };
}
