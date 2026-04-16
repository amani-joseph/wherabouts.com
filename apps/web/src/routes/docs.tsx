import { createFileRoute } from "@tanstack/react-router";
import { DocsPage } from "@/components/docs-page";

export const Route = createFileRoute("/docs")({
	component: RouteComponent,
});

function RouteComponent() {
	return <DocsPage />;
}
