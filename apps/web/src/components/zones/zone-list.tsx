import { Button } from "@wherabouts.com/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@wherabouts.com/ui/components/card";
import type { ZoneWithGeometryRow } from "@wherabouts.com/api/shared/zone-queries";
import { MapPinIcon, TrashIcon } from "lucide-react";

export interface ZoneListProps {
	zones: ZoneWithGeometryRow[];
	selectedId: number | null;
	onSelect: (id: number) => void;
	onDelete: (id: number) => void;
}

export function ZoneList({ zones, selectedId, onSelect, onDelete }: ZoneListProps) {
	if (zones.length === 0) {
		return (
			<Card>
				<CardContent className="py-8 text-center text-muted-foreground text-sm">
					No zones yet. Draw a polygon on the map to create one.
				</CardContent>
			</Card>
		);
	}
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm">Zones ({zones.length})</CardTitle>
			</CardHeader>
			<CardContent className="space-y-1">
				{zones.map((zone) => (
					<div
						className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${
							zone.id === selectedId ? "bg-accent" : "hover:bg-accent/50"
						}`}
						key={zone.id}
					>
						<button
							className="flex flex-1 items-center gap-2 text-left"
							onClick={() => onSelect(zone.id)}
							type="button"
						>
							<MapPinIcon className="size-4 text-muted-foreground" />
							<span className="truncate">{zone.name}</span>
						</button>
						<Button
							aria-label={`Delete ${zone.name}`}
							onClick={() => onDelete(zone.id)}
							size="icon"
							variant="ghost"
						>
							<TrashIcon className="size-4" />
						</Button>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
