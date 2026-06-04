import { ORPCError } from "@orpc/server";
import { autocompleteAddresses } from "@wherabouts.com/database/queries";
import { batchGeocodeJobs } from "@wherabouts.com/database/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { o as baseBuilder } from "../../builder.ts";
import { apiKeyAuth, usageMiddleware } from "../public-middleware.ts";
import type { ValidatedApiKey } from "../../api-key-auth.ts";

// ---------------------------------------------------------------------------
// Query builder (pure, exported for unit tests)
// ---------------------------------------------------------------------------

export function buildGeocodeQuery(
	input:
		| { structured: "false"; q: string }
		| {
				structured: "true";
				street: string;
				locality: string;
				state?: string;
		  }
): string {
	if (input.structured !== "true") {
		return input.q;
	}
	return [input.street, input.locality, input.state].filter(Boolean).join(", ");
}

// ---------------------------------------------------------------------------
// Input schema — uses string literals since GET query params are always strings.
// Preprocess adds structured:"false" when the param is absent so callers can
// use plain ?q=... without explicitly passing structured=false.
// ---------------------------------------------------------------------------

const geocodeInput = z.preprocess(
	(data: unknown) => {
		if (
			typeof data === "object" &&
			data !== null &&
			!("structured" in (data as Record<string, unknown>))
		) {
			return { ...(data as Record<string, unknown>), structured: "false" };
		}
		return data;
	},
	z.discriminatedUnion("structured", [
		z.object({
			structured: z.literal("true"),
			street: z.string().min(1, "Parameter 'street' is required in structured mode."),
			locality: z.string().min(1, "Parameter 'locality' is required in structured mode."),
			state: z.string().optional(),
			postcode: z.string().optional(),
			country: z.string().optional(),
		}),
		z.object({
			structured: z.literal("false"),
			q: z.string().min(5, "Query parameter 'q' must be at least 5 characters."),
			country: z.string().optional(),
			state: z.string().optional(),
		}),
	])
);

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const forwardGeocode = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("addresses.geocode"))
	.route({
		method: "GET",
		path: "/api/v1/addresses/geocode",
		summary: "Forward geocode an address",
		tags: ["addresses"],
	})
	.input(geocodeInput)
	.handler(async ({ input, context }) => {
		const isStructured = input.structured === "true";

		// Build the query string
		let query: string;
		let country: string | undefined;
		let state: string | undefined;

		if (isStructured) {
			query = buildGeocodeQuery({
				structured: "true",
				street: input.street,
				locality: input.locality,
				state: input.state,
			});
			country = input.country;
			state = input.state;
		} else {
			query = buildGeocodeQuery({ structured: "false", q: input.q });
			country = input.country;
			state = input.state;
		}

		const { results } = await autocompleteAddresses(context.db, query, {
			country,
			state,
			limit: 1,
		});

		if (results.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "No address found matching the query.",
			});
		}

		// biome-ignore lint: length check above guarantees existence
		const result = results[0]!;

		return {
			address: {
				id: result.id,
				formattedAddress: result.formattedAddress,
				streetAddress: result.streetAddress,
				locality: result.locality,
				state: result.state,
				postcode: result.postcode,
				country: result.country,
				latitude: result.latitude,
				longitude: result.longitude,
			},
			matchType: isStructured ? ("structured" as const) : ("fuzzy" as const),
		};
	});

// ---------------------------------------------------------------------------
// Batch geocoding handlers
// ---------------------------------------------------------------------------

export const batchGeocodeSubmit = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("addresses.batch"))
	.route({
		method: "POST",
		path: "/api/v1/geocode/batch",
		summary: "Submit batch geocoding job",
		tags: ["addresses"],
	})
	.input(
		z.object({
			addresses: z
				.array(z.string().min(5))
				.min(1)
				.max(1000, "Maximum 1,000 addresses per job"),
		})
	)
	.handler(async ({ input, context }) => {
		const ctx = context as typeof context & {
			validatedApiKey: ValidatedApiKey;
			// CF binding — available in Worker env, may be absent in tests
			// biome-ignore lint: Queue type from @cloudflare/workers-types not in this package's tsconfig
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			env?: { BATCH_GEOCODE_QUEUE?: any };
		};
		const projectId = ctx.validatedApiKey.projectId;
		if (!projectId) {
			throw new ORPCError("UNAUTHORIZED", {
				message: "No project associated with this API key.",
			});
		}

		const [job] = await context.db
			.insert(batchGeocodeJobs)
			.values({
				projectId,
				apiKeyId: ctx.validatedApiKey.apiKeyId,
				status: "pending",
				inputCount: input.addresses.length,
			})
			.returning({ id: batchGeocodeJobs.id });

		if (ctx.env?.BATCH_GEOCODE_QUEUE) {
			try {
				await ctx.env.BATCH_GEOCODE_QUEUE.send({
					type: "batch-geocode",
					jobId: job!.id,
					addresses: input.addresses,
					projectId,
				});
				await context.db
					.update(batchGeocodeJobs)
					.set({ status: "processing" })
					.where(eq(batchGeocodeJobs.id, job!.id));
			} catch (err) {
				await context.db
					.update(batchGeocodeJobs)
					.set({ status: "failed", error: "Failed to enqueue job." })
					.where(eq(batchGeocodeJobs.id, job!.id));
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to enqueue batch job. Please retry.",
				});
			}
		}

		const finalStatus = ctx.env?.BATCH_GEOCODE_QUEUE ? "processing" : "pending";
		return {
			jobId: job!.id,
			status: finalStatus,
			inputCount: input.addresses.length,
		};
	});

export const batchGeocodePoll = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("addresses.batch.poll"))
	.route({
		method: "GET",
		path: "/api/v1/geocode/batch/{jobId}",
		summary: "Poll batch geocoding job",
		tags: ["addresses"],
	})
	.input(z.object({ jobId: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const ctx = context as typeof context & { validatedApiKey: ValidatedApiKey };
		const projectId = ctx.validatedApiKey.projectId;
		if (!projectId) {
			throw new ORPCError("UNAUTHORIZED", {
				message: "No project associated with this API key.",
			});
		}

		const [job] = await context.db
			.select()
			.from(batchGeocodeJobs)
			.where(
				and(
					eq(batchGeocodeJobs.id, input.jobId),
					eq(batchGeocodeJobs.projectId, projectId)
				)
			)
			.limit(1);

		if (!job) {
			throw new ORPCError("NOT_FOUND", { message: "Job not found." });
		}

		return {
			jobId: job.id,
			status: job.status,
			inputCount: job.inputCount,
			processedCount: job.processedCount,
			completedAt: job.completedAt,
			error: job.error,
			downloadUrl:
				job.status === "completed"
					? `/api/v1/geocode/batch/${job.id}/results`
					: null,
		};
	});

export const batchGeocodeResults = baseBuilder
	.use(apiKeyAuth)
	.use(usageMiddleware("addresses.batch.results"))
	.route({
		method: "GET",
		path: "/api/v1/geocode/batch/{jobId}/results",
		summary: "Download batch geocoding results",
		tags: ["addresses"],
	})
	.input(z.object({ jobId: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const ctx = context as typeof context & {
			validatedApiKey: ValidatedApiKey;
			// biome-ignore lint: R2Bucket type from @cloudflare/workers-types not in this package's tsconfig
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			env?: { GEOCODE_RESULTS?: any };
		};
		const projectId = ctx.validatedApiKey.projectId;
		if (!projectId) {
			throw new ORPCError("UNAUTHORIZED", {
				message: "No project associated with this API key.",
			});
		}

		const [job] = await context.db
			.select({
				status: batchGeocodeJobs.status,
				resultsR2Key: batchGeocodeJobs.resultsR2Key,
			})
			.from(batchGeocodeJobs)
			.where(
				and(
					eq(batchGeocodeJobs.id, input.jobId),
					eq(batchGeocodeJobs.projectId, projectId)
				)
			)
			.limit(1);

		if (!job) {
			throw new ORPCError("NOT_FOUND", { message: "Job not found." });
		}
		if (job.status !== "completed" || !job.resultsR2Key) {
			throw new ORPCError("NOT_FOUND", {
				message: `Results not ready. Job status: ${job.status}`,
			});
		}
		if (!ctx.env?.GEOCODE_RESULTS) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Storage binding unavailable.",
			});
		}

		const obj = await ctx.env.GEOCODE_RESULTS.get(job.resultsR2Key);
		if (!obj) {
			throw new ORPCError("NOT_FOUND", { message: "Results file not found." });
		}

		// biome-ignore lint: obj is any (R2Bucket not in this package's tsconfig)
		const results = (await obj.json()) as unknown[];
		return { results, count: results.length };
	});
