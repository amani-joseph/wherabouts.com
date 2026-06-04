import { db, decryptSecret } from "@wherabouts.com/api";
import { webhookSubscriptions } from "@wherabouts.com/database/schema";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { hmacSign } from "./hmac.ts";

// Re-export for consumers that import from this module.
export { hmacSign } from "./hmac.ts";

export interface WebhookDeliveryMessage {
	type: "webhook-delivery";
	projectId: string;
	deviceId: string;
	lat: number;
	lng: number;
	zoneId: number;
	zoneName: string;
	event: "entry" | "exit";
	timestamp: string;
}

const MAX_ATTEMPTS = 3;
const DELIVERY_TIMEOUT_MS = 10_000;

async function deliverOnce(
	url: string,
	body: string,
	signature: string,
	attempt: number
): Promise<boolean> {
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Wherabouts-Signature": signature,
				"X-Wherabouts-Attempt": String(attempt),
			},
			body,
			signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
		});
		return res.ok;
	} catch {
		return false;
	}
}

export async function processWebhookDeliveryMessage(
	msg: WebhookDeliveryMessage
): Promise<void> {
	// Find matching subscriptions: same project, active, not failing,
	// zone-specific (zoneId match) OR project-wide (zoneId null),
	// and subscribed to this event type.
	const subs = await db
		.select()
		.from(webhookSubscriptions)
		.where(
			and(
				eq(webhookSubscriptions.projectId, msg.projectId),
				eq(webhookSubscriptions.active, true),
				eq(webhookSubscriptions.failing, false),
				or(
					eq(webhookSubscriptions.zoneId, msg.zoneId),
					isNull(webhookSubscriptions.zoneId)
				),
				sql`${msg.event} = ANY(${webhookSubscriptions.events})`
			)
		);

	const payload = JSON.stringify({
		event: msg.event,
		zone: { id: msg.zoneId, name: msg.zoneName },
		device: { id: msg.deviceId, lat: msg.lat, lng: msg.lng },
		timestamp: msg.timestamp,
	});

	// allSettled isolates per-subscription failures: a DB error on one sub must
	// not reject the whole batch, which would let CF Queue re-deliver the message
	// and double-fire webhooks to subs that already succeeded.
	await Promise.allSettled(
		subs.map(async (sub) => {
			let secret: string;
			try {
				secret = decryptSecret(sub.secretEnc);
			} catch {
				// Corrupt secret — cannot sign; mark failing and skip.
				await db
					.update(webhookSubscriptions)
					.set({ failing: true })
					.where(eq(webhookSubscriptions.id, sub.id));
				return;
			}

			const signature = await hmacSign(secret, payload);

			let delivered = false;
			for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
				delivered = await deliverOnce(sub.url, payload, signature, attempt);
				if (delivered) {
					break;
				}
			}

			if (!delivered) {
				await db
					.update(webhookSubscriptions)
					.set({ failing: true })
					.where(eq(webhookSubscriptions.id, sub.id));
			}
		})
	);
}
