import { createFileRoute } from "@tanstack/react-router";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@wherabouts.com/ui/components/card";

export const Route = createFileRoute("/_protected/batch")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Batch geocoding</CardTitle>
				<CardDescription>Coming in a later phase.</CardDescription>
			</CardHeader>
		</Card>
	);
}
