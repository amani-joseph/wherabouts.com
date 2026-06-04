import { Button } from "@wherabouts.com/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@wherabouts.com/ui/components/card";
import { Input } from "@wherabouts.com/ui/components/input";
import { Label } from "@wherabouts.com/ui/components/label";
import { useState } from "react";

export interface PointTestResult {
	zones: { id: number; name: string }[];
}

export interface PointTestToolProps {
	testing: boolean;
	result: PointTestResult | null;
	onTest: (lat: number, lng: number) => void;
}

export function PointTestTool({ testing, result, onTest }: PointTestToolProps) {
	const [lat, setLat] = useState("-33.87");
	const [lng, setLng] = useState("151.21");

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm">Test a point</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				<div className="flex gap-2">
					<div className="flex-1 space-y-1">
						<Label htmlFor="test-lat">Lat</Label>
						<Input id="test-lat" onChange={(e) => setLat(e.target.value)} value={lat} />
					</div>
					<div className="flex-1 space-y-1">
						<Label htmlFor="test-lng">Lng</Label>
						<Input id="test-lng" onChange={(e) => setLng(e.target.value)} value={lng} />
					</div>
				</div>
				<Button
					className="w-full"
					disabled={testing}
					onClick={() => onTest(Number(lat), Number(lng))}
					size="sm"
				>
					{testing ? "Testing…" : "Check zones"}
				</Button>
				{result ? (
					<p className="text-muted-foreground text-sm">
						{result.zones.length === 0
							? "Point is in no zones."
							: `In: ${result.zones.map((z) => z.name).join(", ")}`}
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}
