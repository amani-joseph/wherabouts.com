import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@wherabouts.com/ui/components/badge";
import { Button } from "@wherabouts.com/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@wherabouts.com/ui/components/card";
import {
	FolderOpenIcon,
	MapPinIcon,
	MoreHorizontalIcon,
	PlusIcon,
} from "lucide-react";

export const Route = createFileRoute("/_protected/projects")({
	component: RouteComponent,
});

const projects = [
	{
		name: "Delivery App",
		description: "Real-time address autocomplete for delivery routing",
		endpoints: ["autocomplete", "reverse"],
		requests: "45.2K",
		status: "active" as const,
		created: "Mar 2, 2026",
	},
	{
		name: "Fleet Tracker",
		description: "Vehicle location tracking and geofencing",
		endpoints: ["reverse", "nearby"],
		requests: "32.1K",
		status: "active" as const,
		created: "Jan 15, 2026",
	},
	{
		name: "Store Locator",
		description: "Find nearby retail locations by coordinates",
		endpoints: ["nearby"],
		requests: "18.7K",
		status: "active" as const,
		created: "Feb 20, 2026",
	},
	{
		name: "Address Validator",
		description: "Bulk address verification for CRM data cleanup",
		endpoints: ["autocomplete", "addresses"],
		requests: "8.4K",
		status: "paused" as const,
		created: "Dec 10, 2025",
	},
];

function RouteComponent() {
	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="font-semibold text-2xl tracking-tight">Projects</h1>
					<p className="text-muted-foreground text-sm">
						Organize your API usage by application or use case
					</p>
				</div>
				<Button>
					<PlusIcon className="size-4" />
					New Project
				</Button>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{projects.map((project) => (
					<Card className="group relative" key={project.name}>
						<CardHeader>
							<div className="flex items-start justify-between">
								<div className="flex items-center gap-3">
									<div className="flex size-10 items-center justify-center rounded-lg bg-muted">
										<FolderOpenIcon className="size-5 text-muted-foreground" />
									</div>
									<div>
										<CardTitle className="text-base">{project.name}</CardTitle>
										<CardDescription className="text-xs">
											Created {project.created}
										</CardDescription>
									</div>
								</div>
								<Button className="size-8" size="icon" variant="ghost">
									<MoreHorizontalIcon className="size-4" />
								</Button>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-muted-foreground text-sm">
								{project.description}
							</p>
							<div className="flex flex-wrap gap-1.5">
								{project.endpoints.map((ep) => (
									<Badge
										className="font-mono text-xs"
										key={ep}
										variant="secondary"
									>
										/{ep}
									</Badge>
								))}
							</div>
							<div className="flex items-center justify-between border-t pt-3 text-sm">
								<div className="flex items-center gap-1.5 text-muted-foreground">
									<MapPinIcon className="size-3.5" />
									{project.requests} requests/mo
								</div>
								<Badge
									variant={
										project.status === "active" ? "default" : "secondary"
									}
								>
									{project.status}
								</Badge>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
