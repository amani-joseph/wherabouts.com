import { apiKeys, apiUsageDaily } from "@wherabouts.com/database";
import { and, eq, gte, isNull, sql, sum } from "drizzle-orm";
import { protectedProcedure } from "../../procedures.ts";

const REQUEST_SOURCE_PRODUCTION = "production";
const REQUEST_SOURCE_EXPLORER_TEST = "explorer_test";

export const dashboardRouter = {
	getStats: protectedProcedure.handler(async ({ context }) => {
		const authUserId = context.session.user.id;
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
		const thirtyDaysAgoStr =
			thirtyDaysAgo.toISOString().split("T")[0] ?? "1970-01-01";

		const [
			activeKeysResult,
			totalUsageResult,
			recentUsageResult,
			explorerTestUsageResult,
			endpointResult,
			recentKeysResult,
		] = await Promise.all([
			context.db
				.select({ count: sql<number>`count(*)::int` })
				.from(apiKeys)
				.where(and(eq(apiKeys.userId, authUserId), isNull(apiKeys.revokedAt))),
			context.db
				.select({ total: sum(apiUsageDaily.requestCount) })
				.from(apiUsageDaily)
				.where(
					and(
						eq(apiUsageDaily.userId, authUserId),
						eq(apiUsageDaily.requestSource, REQUEST_SOURCE_PRODUCTION)
					)
				),
			context.db
				.select({ total: sum(apiUsageDaily.requestCount) })
				.from(apiUsageDaily)
				.where(
					and(
						eq(apiUsageDaily.userId, authUserId),
						gte(apiUsageDaily.usageDate, thirtyDaysAgoStr),
						eq(apiUsageDaily.requestSource, REQUEST_SOURCE_PRODUCTION)
					)
				),
			context.db
				.select({ total: sum(apiUsageDaily.requestCount) })
				.from(apiUsageDaily)
				.where(
					and(
						eq(apiUsageDaily.userId, authUserId),
						gte(apiUsageDaily.usageDate, thirtyDaysAgoStr),
						eq(apiUsageDaily.requestSource, REQUEST_SOURCE_EXPLORER_TEST)
					)
				),
			context.db
				.select({
					endpoint: apiUsageDaily.endpoint,
					count: sum(apiUsageDaily.requestCount),
				})
				.from(apiUsageDaily)
				.where(
					and(
						eq(apiUsageDaily.userId, authUserId),
						gte(apiUsageDaily.usageDate, thirtyDaysAgoStr),
						eq(apiUsageDaily.requestSource, REQUEST_SOURCE_PRODUCTION)
					)
				)
				.groupBy(apiUsageDaily.endpoint)
				.orderBy(sql`sum(${apiUsageDaily.requestCount}) desc`),
			context.db
				.select({
					id: apiKeys.id,
					name: apiKeys.name,
					secretDisplaySuffix: apiKeys.secretDisplaySuffix,
					lastUsedAt: apiKeys.lastUsedAt,
				})
				.from(apiKeys)
				.where(and(eq(apiKeys.userId, authUserId), isNull(apiKeys.revokedAt)))
				.orderBy(apiKeys.createdAt)
				.limit(5),
		]);

		return {
			activeKeys: activeKeysResult[0]?.count ?? 0,
			explorerTestRequests: Number(explorerTestUsageResult[0]?.total ?? 0),
			totalRequests: Number(totalUsageResult[0]?.total ?? 0),
			recentRequests: Number(recentUsageResult[0]?.total ?? 0),
			endpointBreakdown: endpointResult.map((result) => ({
				endpoint: result.endpoint,
				count: Number(result.count ?? 0),
			})),
			recentKeys: recentKeysResult.map((result) => ({
				id: result.id,
				name: result.name,
				displayLabel: `wh_${result.id.split("-")[0]}…${result.secretDisplaySuffix}`,
				lastUsedAt: result.lastUsedAt?.toISOString() ?? null,
			})),
		};
	}),
};
