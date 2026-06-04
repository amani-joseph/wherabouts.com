import { Progress } from "@wherabouts.com/ui/components/progress";

export interface JobProgressProps {
	status: string;
	processedCount: number;
	inputCount: number;
	error?: string | null;
}

export function JobProgress({
	status,
	processedCount,
	inputCount,
	error,
}: JobProgressProps) {
	const pct =
		inputCount > 0 ? Math.round((processedCount / inputCount) * 100) : 0;

	return (
		<div className="space-y-1">
			<div className="flex justify-between text-sm">
				<span className="font-medium capitalize">{status}</span>
				<span className="text-muted-foreground">
					{processedCount}/{inputCount}
				</span>
			</div>
			<Progress value={status === "completed" ? 100 : pct} />
			{error ? <p className="text-destructive text-sm">{error}</p> : null}
		</div>
	);
}
