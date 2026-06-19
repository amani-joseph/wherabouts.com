import type { Meta, StoryObj } from "@storybook/react-vite";
import { createDemoClient } from "../../.storybook/demo-client";
import { ReverseGeocodeInput } from "./reverse-geocode-input";

const client = createDemoClient();

const meta = {
	title: "Components/ReverseGeocodeInput",
	component: ReverseGeocodeInput,
	args: { client },
	parameters: {
		docs: {
			description: {
				// NOTE: keep identical to the Summary in docs/reverse-geocode-input.md
				component:
					"Resolves a `latitude`/`longitude` pair to the nearest address (reverse geocoding). No request is made until both coordinates are non-null.",
			},
		},
	},
} satisfies Meta<typeof ReverseGeocodeInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { latitude: -27.4698, longitude: 153.0251 },
};

export const NoCoordinates: Story = {
	args: { latitude: null, longitude: null },
};

export const Disabled: Story = {
	args: { disabled: true, latitude: -27.4698, longitude: 153.0251 },
};
