import { createFileRoute } from "@tanstack/react-router";
import { ApiExplorer } from "@/components/api-explorer";

export const Route = createFileRoute("/_protected/api-docs")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">API Docs</h1>
				<p className="text-muted-foreground text-sm">
					Explore and test the Wherabouts API endpoints
				</p>
			</div>
			<ApiExplorer />
		</div>
	);
}
