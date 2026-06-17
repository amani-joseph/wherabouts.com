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
						className="mb-1 block font-medium text-foreground text-sm"
					>
						{streetLabel}
					</label>
					<input
						id="field-street"
						type="text"
						disabled={disabled}
						value={value.street}
						onChange={(e) => handleFieldChange("street", e.target.value)}
						className="block h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-foreground text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
						placeholder="Street address"
					/>
				</div>

				<div>
					<label
						htmlFor="field-suburb"
						className="mb-1 block font-medium text-foreground text-sm"
					>
						{suburbLabel}
					</label>
					<input
						id="field-suburb"
						type="text"
						disabled={disabled}
						value={value.suburb}
						onChange={(e) => handleFieldChange("suburb", e.target.value)}
						className="block h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-foreground text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
						placeholder="Suburb"
					/>
				</div>

				<div>
					<label
						htmlFor="field-state"
						className="mb-1 block font-medium text-foreground text-sm"
					>
						{stateLabel}
					</label>
					<input
						id="field-state"
						type="text"
						disabled={disabled}
						value={value.state}
						onChange={(e) => handleFieldChange("state", e.target.value)}
						className="block h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-foreground text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
						placeholder="State"
					/>
				</div>

				<div>
					<label
						htmlFor="field-postcode"
						className="mb-1 block font-medium text-foreground text-sm"
					>
						{postcodeLabel}
					</label>
					<input
						id="field-postcode"
						type="text"
						disabled={disabled}
						value={value.postcode}
						onChange={(e) => handleFieldChange("postcode", e.target.value)}
						className="block h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-foreground text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
						placeholder="Postcode"
					/>
				</div>
			</div>
		</div>
	);
}
