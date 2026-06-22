import type { BillingOwner } from "./account.ts";

/**
 * Minimal structural type of the Cloudflare DurableObjectNamespace we call.
 * Typed loosely so this package needs no @cloudflare/workers-types dependency.
 */
export interface UsageMeterNamespace {
	get(id: unknown): {
		fetch(input: string, init?: RequestInit): Promise<Response>;
	};
	idFromName(name: string): unknown;
}

export interface MeterResult {
	billingAccountId: string;
	blocked: boolean;
	currentPeriodRequests: number;
}

/**
 * Durable Object instance key — one meter per billing owner. Derived from the
 * owner (not the account id) so the gate needs no Postgres lookup on the hot
 * path; the DO resolves/seeds the account itself on first use.
 */
export function usageMeterName(owner: BillingOwner): string {
	return owner.teamId ? `team:${owner.teamId}` : `user:${owner.userId}`;
}

async function callMeter(
	ns: UsageMeterNamespace,
	owner: BillingOwner,
	action: "peek" | "increment"
): Promise<MeterResult> {
	const stub = ns.get(ns.idFromName(usageMeterName(owner)));
	// Hostname is arbitrary — DO fetch routes by stub, not URL authority. The
	// path selects the action; the body carries the owner for first-use seeding.
	const res = await stub.fetch(`https://usage-meter/${action}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(owner),
	});
	if (!res.ok) {
		throw new Error(`usage meter ${action} failed: ${res.status}`);
	}
	return (await res.json()) as MeterResult;
}

export const usageMeterPeek = (ns: UsageMeterNamespace, owner: BillingOwner) =>
	callMeter(ns, owner, "peek");

export const usageMeterIncrement = (
	ns: UsageMeterNamespace,
	owner: BillingOwner
) => callMeter(ns, owner, "increment");
