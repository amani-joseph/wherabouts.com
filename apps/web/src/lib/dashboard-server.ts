import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";
import { apiKeys, apiUsageDaily } from "@wherabouts.com/database/schema";
import { and, eq, gte, isNull, sql, sum } from "drizzle-orm";
import { getDb } from "@/lib/db";

export interface DashboardStats {
	activeKeys: number;
	endpointBreakdown: { endpoint: string; count: number }[];
	recentKeys: {
		id: string;
		name: string;
		displayLabel: string;
		lastUsedAt: string | null;
	}[];
	recentRequests: number;
	totalRequests: number;
}

export const getDashboardStats = createServerFn({ method: "GET" }).handler(
	async (): Promise<DashboardStats> => {
		const { userId } = await auth();
		if (!userId) {
			return {
				activeKeys: 0,
				totalRequests: 0,
				recentRequests: 0,
				endpointBreakdown: [],
				recentKeys: [],
			};
		}

		const db = getDb();

		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
		const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

		const [
			activeKeysResult,
			totalUsageResult,
			recentUsageResult,
			endpointResult,
			recentKeysResult,
		] = await Promise.all([
			// Count active keys
			db
				.select({ count: sql<number>`count(*)::int` })
				.from(apiKeys)
				.where(and(eq(apiKeys.clerkUserId, userId), isNull(apiKeys.revokedAt))),

			// Total all-time requests
			db
				.select({ total: sum(apiUsageDaily.requestCount) })
				.from(apiUsageDaily)
				.where(eq(apiUsageDaily.clerkUserId, userId)),

			// Last 30 days requests
			db
				.select({ total: sum(apiUsageDaily.requestCount) })
				.from(apiUsageDaily)
				.where(
					and(
						eq(apiUsageDaily.clerkUserId, userId),
						gte(apiUsageDaily.usageDate, thirtyDaysAgoStr!)
					)
				),

			// Endpoint breakdown (last 30 days)
			db
				.select({
					endpoint: apiUsageDaily.endpoint,
					count: sum(apiUsageDaily.requestCount),
				})
				.from(apiUsageDaily)
				.where(
					and(
						eq(apiUsageDaily.clerkUserId, userId),
						gte(apiUsageDaily.usageDate, thirtyDaysAgoStr!)
					)
				)
				.groupBy(apiUsageDaily.endpoint)
				.orderBy(sql`sum(${apiUsageDaily.requestCount}) desc`),

			// Recent keys with display info
			db
				.select({
					id: apiKeys.id,
					name: apiKeys.name,
					secretDisplaySuffix: apiKeys.secretDisplaySuffix,
					lastUsedAt: apiKeys.lastUsedAt,
				})
				.from(apiKeys)
				.where(and(eq(apiKeys.clerkUserId, userId), isNull(apiKeys.revokedAt)))
				.orderBy(apiKeys.createdAt)
				.limit(5),
		]);

		return {
			activeKeys: activeKeysResult[0]?.count ?? 0,
			totalRequests: Number(totalUsageResult[0]?.total ?? 0),
			recentRequests: Number(recentUsageResult[0]?.total ?? 0),
			endpointBreakdown: endpointResult.map((r) => ({
				endpoint: r.endpoint,
				count: Number(r.count ?? 0),
			})),
			recentKeys: recentKeysResult.map((r) => ({
				id: r.id,
				name: r.name,
				displayLabel: `wh_${r.id.split("-")[0]}…${r.secretDisplaySuffix}`,
				lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
			})),
		};
	}
);
