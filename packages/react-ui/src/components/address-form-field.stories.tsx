import type { Meta, StoryObj } from "@storybook/react-vite";
import { createDemoClient } from "../../.storybook/demo-client";
import { AddressFormField } from "./address-form-field";

const client = createDemoClient();

const meta = {
	title: "Components/AddressFormField",
	component: AddressFormField,
	args: { client, label: "Delivery address" },
	parameters: {
		docs: {
			description: {
				// NOTE: keep identical to the Summary + guidance in docs/address-form-field.md
				component:
					"`AddressAutocomplete` wrapped with a `<label>` and error styling — a drop-in form field. Accepts every `AddressAutocomplete` prop plus `label`, `labelClassName`, and `errorClassName`.",
			},
		},
	},
} satisfies Meta<typeof AddressFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Required: Story = {
	args: { required: true },
};

export const WithError: Story = {
	args: { error: "Address is required" },
};
