import { ORPCError } from "@orpc/server";
import { batchGeocodeJobs } from "@wherabouts.com/database/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../../procedures.ts";
import { requireProjectOwnership } from "../../shared/project-ownership.ts";

const projectIdInput = z.object({ projectId: z.string().uuid() });

export const geocodeRouter = {
	batchSubmit: protectedProcedure
		.input(
			projectIdInput.extend({
				addresses: z
					.array(z.string().min(5))
					.min(1)
					.max(1000, "Maximum 1,000 addresses per job"),
			})
		)
		.handler(async ({ context, input }) => {
			const projectId = await requireProjectOwnership(
				context.db,
				input.projectId,
				context.session.user.id
			);
			const ctx = context as typeof context & {
				// biome-ignore lint/suspicious/noExplicitAny: CF Queue binding not typed in this package
				env?: { BATCH_GEOCODE_QUEUE?: any };
			};
			const [job] = await context.db
				.insert(batchGeocodeJobs)
				.values({
					projectId,
					apiKeyId: null,
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
				} catch {
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
		}),

	batchPoll: protectedProcedure
		.input(projectIdInput.extend({ jobId: z.string().uuid() }))
		.handler(async ({ context, input }) => {
			const projectId = await requireProjectOwnership(
				context.db,
				input.projectId,
				context.session.user.id
			);
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
			};
		}),

	batchResults: protectedProcedure
		.input(projectIdInput.extend({ jobId: z.string().uuid() }))
		.handler(async ({ context, input }) => {
			const projectId = await requireProjectOwnership(
				context.db,
				input.projectId,
				context.session.user.id
			);
			const ctx = context as typeof context & {
				// biome-ignore lint/suspicious/noExplicitAny: R2 binding not typed in this package
				env?: { GEOCODE_RESULTS?: any };
			};
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

			// biome-ignore lint/suspicious/noExplicitAny: R2 object typed as any
			const results = (await (obj as any).json()) as unknown[];
			return { results, count: results.length };
		}),

	batchList: protectedProcedure
		.input(
			projectIdInput.extend({
				limit: z.number().int().min(1).max(50).default(20),
			})
		)
		.handler(async ({ context, input }) => {
			const projectId = await requireProjectOwnership(
				context.db,
				input.projectId,
				context.session.user.id
			);
			const jobs = await context.db
				.select({
					id: batchGeocodeJobs.id,
					status: batchGeocodeJobs.status,
					inputCount: batchGeocodeJobs.inputCount,
					processedCount: batchGeocodeJobs.processedCount,
					createdAt: batchGeocodeJobs.createdAt,
					completedAt: batchGeocodeJobs.completedAt,
				})
				.from(batchGeocodeJobs)
				.where(eq(batchGeocodeJobs.projectId, projectId))
				.orderBy(desc(batchGeocodeJobs.createdAt))
				.limit(input.limit);
			return { jobs, count: jobs.length };
		}),
};
