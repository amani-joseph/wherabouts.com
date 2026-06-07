export interface BoundaryCrossing {
	event: "entry" | "exit";
	zoneId: number;
	zoneName: string;
}

/**
 * Pure function — computes zone boundary crossings between two device states.
 * Exported separately so it can be unit-tested without importing DB/env deps.
 */
export function computeBoundaryCrossings(
	previousZoneIds: number[],
	currentZoneIds: number[],
	zoneNames: Record<number, string>
): BoundaryCrossing[] {
	const prev = new Set(previousZoneIds);
	const curr = new Set(currentZoneIds);
	const crossings: BoundaryCrossing[] = [];

	for (const id of curr) {
		if (!prev.has(id)) {
			crossings.push({
				zoneId: id,
				zoneName: zoneNames[id] ?? "",
				event: "entry",
			});
		}
	}

	for (const id of prev) {
		if (!curr.has(id)) {
			crossings.push({
				zoneId: id,
				zoneName: zoneNames[id] ?? "",
				event: "exit",
			});
		}
	}

	return crossings;
}
