import { useEffect, type ReactNode } from "react";
import type { WheraboutsClient } from "@wherabouts/sdk";
import { useForwardGeocode } from "../hooks/use-forward-geocode";
import { cn } from "../utils/cn";

export interface ForwardGeocodeInputProps {
	client: WheraboutsClient;
	query: string | null;
	onResult?: (result: {
		latitude: number | null;
		longitude: number | null;
		formattedAddress: string | null;
	}) => void;
	className?: string;
	disabled?: boolean;
	placeholder?: string;
	id?: string;
}

export function ForwardGeocodeInput({
	client,
	query,
	onResult,
	className,
	disabled,
	placeholder = "Coordinates will appear here",
	id,
}: ForwardGeocodeInputProps): ReactNode {
	const { data } = useForwardGeocode(client, query);

	useEffect(() => {
		onResult?.({
			latitude: data?.latitude ?? null,
			longitude: data?.longitude ?? null,
			formattedAddress: data?.formattedAddress ?? null,
		});
	}, [data, onResult]);

	const displayText = data
		? `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`
		: "";

	return (
		<input
			id={id}
			data-slot="geocode-input"
			type="text"
			readOnly
			disabled={disabled}
			value={displayText}
			placeholder={placeholder}
			className={cn(
				"block h-8 w-full cursor-default rounded-none border border-input bg-muted/40 px-2.5 py-1 text-foreground text-xs",
				className
			)}
		/>
	);
}
