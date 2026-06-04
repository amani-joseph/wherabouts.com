import { autocompleteAddresses } from "@wherabouts.com/database/queries";
import { batchGeocodeJobs } from "@wherabouts.com/database/schema";
import { db } from "@wherabouts.com/api";
import { eq } from "drizzle-orm";

export interface BatchGeocodeMessage {
	type: "batch-geocode";
	jobId: string;
	addresses: string[];
	projectId: string;
}

export interface BatchGeocodeResult {
	input: string;
	matched: boolean;
	address?: {
		id: number;
		formattedAddress: string;
		latitude: number;
		longitude: number;
		country: string;
		state: string;
		locality: string;
		postcode: string;
	};
	error?: string;
}

export async function processBatchGeocodeMessage(
	msg: BatchGeocodeMessage,
	// R2Bucket comes from @cloudflare/workers-types; use structural typing here
	env: { GEOCODE_RESULTS: R2Bucket }
): Promise<void> {
	const results: BatchGeocodeResult[] = [];

	for (const address of msg.addresses) {
		try {
			const { results: matches } = await autocompleteAddresses(db, address, { limit: 1 });
			if (matches.length > 0) {
				const m = matches[0]!;
				results.push({
					input: address,
					matched: true,
					address: {
						id: m.id,
						formattedAddress: m.formattedAddress,
						latitude: m.latitude,
						longitude: m.longitude,
						country: m.country,
						state: m.state,
						locality: m.locality,
						postcode: m.postcode,
					},
				});
			} else {
				results.push({ input: address, matched: false });
			}
		} catch (err) {
			results.push({
				input: address,
				matched: false,
				error: err instanceof Error ? err.message : "Unknown error",
			});
		}
	}

	const r2Key = `geocode-jobs/${msg.projectId}/${msg.jobId}.json`;
	await env.GEOCODE_RESULTS.put(r2Key, JSON.stringify(results), {
		httpMetadata: { contentType: "application/json" },
	});

	await db
		.update(batchGeocodeJobs)
		.set({
			status: "completed",
			processedCount: results.length,
			resultsR2Key: r2Key,
			completedAt: new Date(),
		})
		.where(eq(batchGeocodeJobs.id, msg.jobId));
}
