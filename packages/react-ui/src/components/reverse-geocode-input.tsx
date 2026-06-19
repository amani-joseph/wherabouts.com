import { useReverseGeocode } from "@wherabouts/react";
import type { WheraboutsClient } from "@wherabouts/sdk";
import { type ReactNode, useEffect } from "react";
import { cn } from "../utils/cn";

export interface ReverseGeocodeInputProps {
	className?: string;
	client: WheraboutsClient;
	disabled?: boolean;
	id?: string;
	latitude: number | null;
	longitude: number | null;
	onResult?: (result: {
		address: string | null;
		distance: number | null;
	}) => void;
	placeholder?: string;
}

export function ReverseGeocodeInput({
	client,
	latitude,
	longitude,
	onResult,
	className,
	disabled,
	placeholder = "Address will appear here",
	id,
}: ReverseGeocodeInputProps): ReactNode {
	const { address, distance } = useReverseGeocode(
		client,
		latitude != null && longitude != null
			? { lat: latitude, lng: longitude }
			: null
	);

	useEffect(() => {
		onResult?.({
			address: address?.formattedAddress ?? null,
			distance: distance ?? null,
		});
	}, [address, distance, onResult]);

	const displayText = address?.formattedAddress ?? "";

	return (
		<input
			className={cn(
				"block h-8 w-full cursor-default rounded-none border border-input bg-muted/40 px-2.5 py-1 text-foreground text-xs",
				className
			)}
			data-slot="geocode-input"
			disabled={disabled}
			id={id}
			placeholder={placeholder}
			readOnly
			type="text"
			value={displayText}
		/>
	);
}
