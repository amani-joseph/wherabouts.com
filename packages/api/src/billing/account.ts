import type { Database } from "@wherabouts.com/database";
import { billingAccounts } from "@wherabouts.com/database";
import type { BillingAccount } from "@wherabouts.com/database";
import { eq } from "drizzle-orm";

export interface BillingOwner {
	ownerType: "team" | "user";
	teamId: string | null;
	userId: string | null;
}

/** Decide which entity owns the bill for a validated API key. */
export function billingOwnerFromKey(key: {
	teamId: string | null;
	userId: string;
}): BillingOwner {
	if (key.teamId) {
		return { ownerType: "team", teamId: key.teamId, userId: null };
	}
	return { ownerType: "user", teamId: null, userId: key.userId };
}

/** First-of-UTC-month string for a date, e.g. "2026-06-01". */
export function utcMonthStart(now: Date): string {
	const y = now.getUTCFullYear();
	const m = String(now.getUTCMonth() + 1).padStart(2, "0");
	return `${y}-${m}-01`;
}

/** True if `now` is in a later UTC month than `periodStart` (or no period yet). */
export function isInNewUtcMonth(periodStart: string | null, now: Date): boolean {
	if (!periodStart) {
		return true;
	}
	return utcMonthStart(now) > `${periodStart.slice(0, 7)}-01`;
}

/** Compute whether an account should be blocked from production traffic. */
export function computeBlocked(account: {
	currentPeriodRequests: number;
	freeAllotment: number;
	hasPaymentMethod: boolean;
}): boolean {
	if (account.hasPaymentMethod) {
		return false;
	}
	return account.currentPeriodRequests >= account.freeAllotment;
}

/**
 * Idempotently fetch or create the billing account for an owner.
 * Neon has no transactions, so we insert-on-conflict-do-nothing then select.
 */
export async function getOrCreateBillingAccount(
	db: Database,
	owner: BillingOwner
): Promise<BillingAccount> {
	const whereOwner = owner.teamId
		? eq(billingAccounts.teamId, owner.teamId)
		: eq(billingAccounts.userId, owner.userId as string);

	await db
		.insert(billingAccounts)
		.values({
			ownerType: owner.ownerType,
			teamId: owner.teamId,
			userId: owner.userId,
			currentPeriodStart: utcMonthStart(new Date()),
		})
		.onConflictDoNothing();

	const [row] = await db
		.select()
		.from(billingAccounts)
		.where(whereOwner)
		.limit(1);

	if (!row) {
		throw new Error("Failed to resolve billing account after upsert");
	}
	return row;
}
