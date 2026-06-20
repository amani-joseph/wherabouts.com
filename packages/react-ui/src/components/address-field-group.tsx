import type { WheraboutsClient } from "@wherabouts/sdk";
import type { ReactNode } from "react";
import type { AddressWithParsed } from "../types";
import { cn } from "../utils/cn";
import { AddressAutocomplete } from "./address-autocomplete";

export interface AddressFieldGroupValue {
	/** Postcode field value. */
	postcode: string;
	/** State field value. */
	state: string;
	/** Street address field value. */
	street: string;
	/** Suburb field value. */
	suburb: string;
}

export interface AddressFieldGroupProps {
	/** Class applied to the root container. */
	className?: string;
	/** Required. SDK client created with `createWheraboutsClient`. */
	client: WheraboutsClient;
	/** Disable all fields. */
	disabled?: boolean;
	/** Required. Change handler, called with the updated value on any field edit. */
	onChange: (value: AddressFieldGroupValue) => void;
	/** Override the postcode field label. */
	postcodeLabel?: string;
	/** Override the state field label. */
	stateLabel?: string;
	/** Override the street address field label. */
	streetLabel?: string;
	/** Override the suburb field label. */
	suburbLabel?: string;
	/** Required. Controlled value for the field group. */
	value: AddressFieldGroupValue;
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
			className={cn("flex flex-col gap-4", className)}
			data-slot="address-field-group"
		>
			<AddressAutocomplete
				client={client}
				disabled={disabled}
				onSelect={handleAutocompleteSelect}
				placeholder="Search for an address..."
			/>

			<div
				className="grid grid-cols-2 gap-4"
				data-slot="address-field-group-inputs"
			>
				<div className="col-span-2">
					<label
						className="mb-1 block font-medium text-foreground text-sm"
						htmlFor="field-street"
					>
						{streetLabel}
					</label>
					<input
						className="block h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-foreground text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
						disabled={disabled}
						id="field-street"
						onChange={(e) => handleFieldChange("street", e.target.value)}
						placeholder="Street address"
						type="text"
						value={value.street}
					/>
				</div>

				<div>
					<label
						className="mb-1 block font-medium text-foreground text-sm"
						htmlFor="field-suburb"
					>
						{suburbLabel}
					</label>
					<input
						className="block h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-foreground text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
						disabled={disabled}
						id="field-suburb"
						onChange={(e) => handleFieldChange("suburb", e.target.value)}
						placeholder="Suburb"
						type="text"
						value={value.suburb}
					/>
				</div>

				<div>
					<label
						className="mb-1 block font-medium text-foreground text-sm"
						htmlFor="field-state"
					>
						{stateLabel}
					</label>
					<input
						className="block h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-foreground text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
						disabled={disabled}
						id="field-state"
						onChange={(e) => handleFieldChange("state", e.target.value)}
						placeholder="State"
						type="text"
						value={value.state}
					/>
				</div>

				<div>
					<label
						className="mb-1 block font-medium text-foreground text-sm"
						htmlFor="field-postcode"
					>
						{postcodeLabel}
					</label>
					<input
						className="block h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-foreground text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
						disabled={disabled}
						id="field-postcode"
						onChange={(e) => handleFieldChange("postcode", e.target.value)}
						placeholder="Postcode"
						type="text"
						value={value.postcode}
					/>
				</div>
			</div>
		</div>
	);
}
