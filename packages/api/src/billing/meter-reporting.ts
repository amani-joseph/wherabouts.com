export interface LiveUsage {
	liveCount: number;
	usageDate: string;
}
export interface MeterDelta {
	delta: number;
	liveCount: number;
	usageDate: string;
}

/** UTC date string N days before `now` (0 = today). */
function utcDateMinus(now: Date, days: number): string {
	const d = new Date(now);
	d.setUTCDate(d.getUTCDate() - days);
	return d.toISOString().slice(0, 10);
}

/** The window of dates the cron re-checks each run (today + yesterday UTC). */
export function recentUsageDates(now = new Date()): string[] {
	return [utcDateMinus(now, 1), utcDateMinus(now, 0)];
}

/** Diff live per-date totals against the reported ledger; emit positive deltas. */
export function computeMeterDeltas(
	live: LiveUsage[],
	reported: Map<string, number>
): MeterDelta[] {
	const out: MeterDelta[] = [];
	for (const row of live) {
		const already = reported.get(row.usageDate) ?? 0;
		const delta = row.liveCount - already;
		if (delta > 0) {
			out.push({ usageDate: row.usageDate, delta, liveCount: row.liveCount });
		}
	}
	return out;
}
