import { type ReactNode } from "react";
import type { WheraboutsClient } from "@wherabouts/sdk";
import type { AddressWithParsed } from "../types";
import { AddressAutocomplete } from "./address-autocomplete";
import { cn } from "../utils/cn";

export interface AddressFieldGroupValue {
	street: string;
	suburb: string;
	state: string;
	postcode: string;
}

export interface AddressFieldGroupProps {
	client: WheraboutsClient;
	value: AddressFieldGroupValue;
	onChange: (value: AddressFieldGroupValue) => void;
	className?: string;
	disabled?: boolean;
	streetLabel?: string;
	suburbLabel?: string;
	stateLabel?: string;
	postcodeLabel?: string;
}

export function AddressFieldGroup({
	client,
	value,
	onChange,
	className,
	disabled,
	streetLabel = "Street Address",
	suburbLabel = "Suburb",
	stateLabel = "State",
	postcodeLabel = "Postcode",
}: AddressFieldGroupProps): ReactNode {
	const handleAutocompleteSelect = (address: AddressWithParsed) => {
		onChange({
			street: address.streetAddress,
			suburb: address.suburb,
			state: address.state,
			postcode: address.postcode,
		});
	};

	const handleFieldChange = (
		field: keyof AddressFieldGroupValue,
		fieldValue: string
	) => {
		onChange({
			...value,
			[field]: fieldValue,
		});
	};

	return (
		<div
			data-slot="address-field-group"
			className={cn("flex flex-col gap-4", className)}
		>
			<AddressAutocomplete
				client={client}
				disabled={disabled}
				onSelect={handleAutocompleteSelect}
				placeholder="Search for an address..."
			/>

			<div
				data-slot="address-field-group-inputs"
				className="grid grid-cols-2 gap-4"
			>
				<div className="col-span-2">
					<label
						htmlFor="field-street"
						className="block text-sm font-medium text-gray-900 mb-1"
					>
						{streetLabel}
					</label>
					<input
						id="field-street"
						type="text"
						disabled={disabled}
						value={value.street}
						onChange={(e) => handleFieldChange("street", e.target.value)}
						className="block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-50"
						placeholder="Street address"
					/>
				</div>

				<div>
					<label
						htmlFor="field-suburb"
						className="block text-sm font-medium text-gray-900 mb-1"
					>
						{suburbLabel}
					</label>
					<input
						id="field-suburb"
						type="text"
						disabled={disabled}
						value={value.suburb}
						onChange={(e) => handleFieldChange("suburb", e.target.value)}
						className="block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-50"
						placeholder="Suburb"
					/>
				</div>

				<div>
					<label
						htmlFor="field-state"
						className="block text-sm font-medium text-gray-900 mb-1"
					>
						{stateLabel}
					</label>
					<input
						id="field-state"
						type="text"
						disabled={disabled}
						value={value.state}
						onChange={(e) => handleFieldChange("state", e.target.value)}
						className="block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-50"
						placeholder="State"
					/>
				</div>

				<div>
					<label
						htmlFor="field-postcode"
						className="block text-sm font-medium text-gray-900 mb-1"
					>
						{postcodeLabel}
					</label>
					<input
						id="field-postcode"
						type="text"
						disabled={disabled}
						value={value.postcode}
						onChange={(e) => handleFieldChange("postcode", e.target.value)}
						className="block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-50"
						placeholder="Postcode"
					/>
				</div>
			</div>
		</div>
	);
}
