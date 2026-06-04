import { createFileRoute } from "@tanstack/react-router";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@wherabouts.com/ui/components/card";
import { MapCanvas } from "@/components/map/map-canvas";

export const Route = createFileRoute("/_protected/zones")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Zones</CardTitle>
				<CardDescription>
					Geofence management is coming in the next phase. Map foundation below.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div style={{ height: 420 }}>
					<MapCanvas />
				</div>
			</CardContent>
		</Card>
	);
}
