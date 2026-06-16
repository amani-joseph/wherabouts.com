import type { ReactNode } from "react";
import type { AddressAutocompleteProps } from "./address-autocomplete";
import { AddressAutocomplete } from "./address-autocomplete";
import { cn } from "../utils/cn";

export interface AddressFormFieldProps extends AddressAutocompleteProps {
	label: string;
	labelClassName?: string;
	errorClassName?: string;
}

export function AddressFormField({
	label,
	labelClassName,
	errorClassName,
	error,
	required,
	disabled,
	id: customId,
	className,
	...autocompleteProps
}: AddressFormFieldProps): ReactNode {
	const id = customId ?? "wherabouts-field";

	return (
		<div
			data-slot="address-form-field"
			className="flex flex-col gap-2"
		>
			<label
				htmlFor={id}
				className={cn(
					"block text-sm font-medium text-gray-900",
					labelClassName
				)}
			>
				{label}
				{required && (
					<span aria-hidden="true" className="ml-1 text-red-600">
						*
					</span>
				)}
			</label>

			<AddressAutocomplete
				{...autocompleteProps}
				id={id}
				required={required}
				disabled={disabled}
				error={error}
				className={className}
			/>

			{error && (
				<p
					role="alert"
					aria-live="polite"
					className={cn(
						"text-sm text-red-600",
						errorClassName
					)}
				>
					{error}
				</p>
			)}
		</div>
	);
}
