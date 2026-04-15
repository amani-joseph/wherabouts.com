import { createFileRoute } from "@tanstack/react-router";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@wherabouts.com/ui/components/card";
import { Progress } from "@wherabouts.com/ui/components/progress";
import { Skeleton } from "@wherabouts.com/ui/components/skeleton";
import {
	BarChart3Icon,
	GlobeIcon,
	MapPinIcon,
	ShieldCheckIcon,
	ZapIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { orpcClient } from "@/lib/orpc";
import { PLATFORM_SLOS } from "@/lib/platform-slos";

type DashboardStats = Awaited<ReturnType<typeof orpcClient.dashboard.getStats>>;

export const Route = createFileRoute("/_protected/analytics")({
	component: RouteComponent,
});

function AnalyticsLoadingSkeleton() {
	return (
		<>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{[1, 2, 3, 4].map((card) => (
					<Card key={card}>
						<CardHeader className="pb-2">
							<Skeleton className="h-4 w-24" />
						</CardHeader>
						<CardContent className="space-y-2">
							<Skeleton className="h-8 w-20" />
							<Skeleton className="h-3 w-32" />
						</CardContent>
					</Card>
				))}
			</div>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{[1, 2].map((card) => (
					<Card key={card}>
						<CardHeader>
							<Skeleton className="h-5 w-40" />
						</CardHeader>
						<CardContent className="space-y-3">
							{[1, 2, 3].map((row) => (
								<Skeleton className="h-10 w-full" key={row} />
							))}
						</CardContent>
					</Card>
				))}
			</div>
		</>
	);
}

function EmptyAnalyticsState() {
	return (
		<Card className="border-dashed">
			<CardContent className="py-10 text-center">
				<p className="font-medium text-sm">No analytics yet</p>
				<p className="mt-2 text-muted-foreground text-sm">
					Make a production request or run an explorer test to start populating
					live usage data.
				</p>
			</CardContent>
		</Card>
	);
}

function RouteComponent() {
	const [stats, setStats] = useState<DashboardStats | null>(null);
	const [loading, setLoading] = useState(true);

	const fetchStats = useCallback(async () => {
		try {
			const result = await orpcClient.dashboard.getStats();
			setStats(result);
		} catch {
			setStats(null);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchStats();
	}, [fetchStats]);

	const endpointUsage = useMemo(() => {
		if (!stats || stats.recentRequests === 0) {
			return [];
		}

		return stats.endpointBreakdown.map((endpoint) => ({
			name: endpoint.endpoint,
			calls: endpoint.count,
			pct: Math.round((endpoint.count / stats.recentRequests) * 100),
		}));
	}, [stats]);

	const hasUsage =
		(stats?.recentRequests ?? 0) > 0 || (stats?.explorerTestRequests ?? 0) > 0;
	let content = <EmptyAnalyticsState />;

	if (loading) {
		content = <AnalyticsLoadingSkeleton />;
	} else if (hasUsage && stats) {
		content = (
			<>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardDescription>Total Requests</CardDescription>
							<ZapIcon className="size-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">
								{stats.totalRequests.toLocaleString()}
							</p>
							<p className="text-muted-foreground text-xs">
								all production traffic
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardDescription>Production Requests (30d)</CardDescription>
							<BarChart3Icon className="size-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">
								{stats.recentRequests.toLocaleString()}
							</p>
							<p className="text-muted-foreground text-xs">
								live dashboard-backed usage
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardDescription>Explorer Test Traffic</CardDescription>
							<ShieldCheckIcon className="size-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">
								{stats.explorerTestRequests.toLocaleString()}
							</p>
							<p className="text-muted-foreground text-xs">
								separate from production billing
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardDescription>Endpoints Used</CardDescription>
							<MapPinIcon className="size-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">
								{stats.endpointBreakdown.length}
							</p>
							<p className="text-muted-foreground text-xs">
								across the public address API
							</p>
						</CardContent>
					</Card>
				</div>

				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<BarChart3Icon className="size-5" />
								Requests by Endpoint
							</CardTitle>
							<CardDescription>
								Production request distribution over the last 30 days
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{endpointUsage.length > 0 ? (
								endpointUsage.map((endpoint) => (
									<div className="space-y-1.5" key={endpoint.name}>
										<div className="flex items-center justify-between text-sm">
											<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
												{endpoint.name}
											</code>
											<span className="text-muted-foreground">
												{endpoint.calls.toLocaleString()} calls ({endpoint.pct}
												%)
											</span>
										</div>
										<Progress className="h-2" value={endpoint.pct} />
									</div>
								))
							) : (
								<p className="text-muted-foreground text-sm">
									Production requests will appear here once live traffic is
									recorded.
								</p>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<GlobeIcon className="size-5" />
								Platform Observability Baseline
							</CardTitle>
							<CardDescription>
								Current Phase 1 measurement surfaces and published targets
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="rounded-md border px-4 py-3">
								<p className="font-medium text-sm">Health check target</p>
								<p className="mt-1 text-muted-foreground text-sm">
									`/api/health` should respond within{" "}
									{PLATFORM_SLOS.healthcheckMaxLatencyMs}ms.
								</p>
							</div>
							<div className="rounded-md border px-4 py-3">
								<p className="font-medium text-sm">Public API latency target</p>
								<p className="mt-1 text-muted-foreground text-sm">
									P95 latency target: {PLATFORM_SLOS.publicApiP95LatencyMs}ms.
								</p>
							</div>
							<div className="rounded-md border px-4 py-3">
								<p className="font-medium text-sm">Uptime target</p>
								<p className="mt-1 text-muted-foreground text-sm">
									Availability target: {PLATFORM_SLOS.uptimeTargetPct}% uptime.
								</p>
							</div>
							<p className="text-muted-foreground text-sm leading-6">
								Latency is currently exposed through `Server-Timing` headers on
								core API responses and the public health endpoint. Richer
								historical latency charts are intentionally deferred until a
								later platform phase.
							</p>
						</CardContent>
					</Card>
				</div>
			</>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">Analytics</h1>
				<p className="text-muted-foreground text-sm">
					Live request volume and baseline platform observability for your API
					keys
				</p>
			</div>

			{content}
		</div>
	);
}
