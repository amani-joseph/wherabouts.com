import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { createDemoClient } from "../../.storybook/demo-client";
import {
	AddressFieldGroup,
	type AddressFieldGroupValue,
} from "./address-field-group";

const client = createDemoClient();

const EMPTY: AddressFieldGroupValue = {
	street: "",
	suburb: "",
	state: "",
	postcode: "",
};

const meta = {
	title: "Components/AddressFieldGroup",
	component: AddressFieldGroup,
	parameters: {
		docs: {
			description: {
				// NOTE: keep identical to the Summary in docs/address-field-group.md
				component:
					"A controlled group of structured inputs (street, suburb, state, postcode) for editing a full address. Provide `value` and `onChange`.",
			},
		},
	},
} satisfies Meta<typeof AddressFieldGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => {
		const [value, setValue] = useState<AddressFieldGroupValue>(EMPTY);
		return (
			<AddressFieldGroup client={client} onChange={setValue} value={value} />
		);
	},
};

export const CustomLabels: Story = {
	render: () => {
		const [value, setValue] = useState<AddressFieldGroupValue>(EMPTY);
		return (
			<AddressFieldGroup
				client={client}
				onChange={setValue}
				postcodeLabel="ZIP"
				stateLabel="Region"
				streetLabel="Street address"
				suburbLabel="City"
				value={value}
			/>
		);
	},
};
