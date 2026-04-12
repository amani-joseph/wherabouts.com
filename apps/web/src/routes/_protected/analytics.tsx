import { createFileRoute } from "@tanstack/react-router";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@wherabouts.com/ui/components/card";
import { Progress } from "@wherabouts.com/ui/components/progress";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@wherabouts.com/ui/components/tabs";
import {
	BarChart3Icon,
	GlobeIcon,
	MapPinIcon,
	TrendingUpIcon,
	ZapIcon,
} from "lucide-react";

export const Route = createFileRoute("/_protected/analytics")({
	component: RouteComponent,
});

const stats = [
	{
		label: "Total Requests",
		value: "128,402",
		change: "+12.5%",
		icon: <ZapIcon className="size-4" />,
	},
	{
		label: "Success Rate",
		value: "99.7%",
		change: "+0.2%",
		icon: <TrendingUpIcon className="size-4" />,
	},
	{
		label: "Avg Latency",
		value: "42ms",
		change: "-8ms",
		icon: <GlobeIcon className="size-4" />,
	},
	{
		label: "Unique Addresses",
		value: "34,891",
		change: "+2,340",
		icon: <MapPinIcon className="size-4" />,
	},
];

const endpointUsage = [
	{ name: "/autocomplete", calls: 68_420, pct: 53 },
	{ name: "/reverse", calls: 31_200, pct: 24 },
	{ name: "/nearby", calls: 18_100, pct: 14 },
	{ name: "/addresses/{id}", calls: 10_682, pct: 9 },
];

const recentActivity = [
	{
		time: "2 min ago",
		endpoint: "/autocomplete",
		status: 200,
		latency: "38ms",
	},
	{ time: "5 min ago", endpoint: "/reverse", status: 200, latency: "45ms" },
	{ time: "8 min ago", endpoint: "/nearby", status: 200, latency: "52ms" },
	{ time: "12 min ago", endpoint: "/autocomplete", status: 429, latency: "—" },
	{
		time: "15 min ago",
		endpoint: "/addresses/abc123",
		status: 200,
		latency: "31ms",
	},
];

function RouteComponent() {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">Analytics</h1>
				<p className="text-muted-foreground text-sm">
					Monitor your API usage, performance, and trends
				</p>
			</div>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{stats.map((stat) => (
					<Card key={stat.label}>
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardDescription>{stat.label}</CardDescription>
							<span className="text-muted-foreground">{stat.icon}</span>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">{stat.value}</p>
							<p className="text-muted-foreground text-xs">
								{stat.change} from last month
							</p>
						</CardContent>
					</Card>
				))}
			</div>

			<Tabs defaultValue="endpoints">
				<TabsList>
					<TabsTrigger value="endpoints">Endpoint Usage</TabsTrigger>
					<TabsTrigger value="activity">Recent Activity</TabsTrigger>
				</TabsList>

				<TabsContent className="mt-4" value="endpoints">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<BarChart3Icon className="size-5" />
								Requests by Endpoint
							</CardTitle>
							<CardDescription>
								Distribution of API calls across endpoints this month
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{endpointUsage.map((ep) => (
								<div className="space-y-1.5" key={ep.name}>
									<div className="flex items-center justify-between text-sm">
										<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
											{ep.name}
										</code>
										<span className="text-muted-foreground">
											{ep.calls.toLocaleString()} calls ({ep.pct}%)
										</span>
									</div>
									<Progress className="h-2" value={ep.pct} />
								</div>
							))}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent className="mt-4" value="activity">
					<Card>
						<CardHeader>
							<CardTitle>Recent Requests</CardTitle>
							<CardDescription>
								Latest API activity across all endpoints
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{recentActivity.map((req, i) => (
									<div
										className="flex items-center justify-between rounded-md border px-4 py-3"
										key={i}
									>
										<div className="flex items-center gap-3">
											<span
												className={`inline-flex size-2 rounded-full ${req.status === 200 ? "bg-green-500" : "bg-amber-500"}`}
											/>
											<code className="font-mono text-sm">{req.endpoint}</code>
										</div>
										<div className="flex items-center gap-4 text-muted-foreground text-sm">
											<span>{req.latency}</span>
											<span className="w-20 text-right">{req.time}</span>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
