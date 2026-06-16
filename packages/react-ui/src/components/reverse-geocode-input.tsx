import { useEffect, type ReactNode } from "react";
import type { WheraboutsClient } from "@wherabouts/sdk";
import { useReverseGeocode } from "@wherabouts/react";
import { cn } from "../utils/cn";

export interface ReverseGeocodeInputProps {
	client: WheraboutsClient;
	latitude: number | null;
	longitude: number | null;
	onResult?: (result: {
		address: string | null;
		distance: number | null;
	}) => void;
	className?: string;
	disabled?: boolean;
	placeholder?: string;
	id?: string;
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
			id={id}
			data-slot="geocode-input"
			type="text"
			readOnly
			disabled={disabled}
			value={displayText}
			placeholder={placeholder}
			className={cn(
				"block w-full rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 cursor-default",
				className
			)}
		/>
	);
}
