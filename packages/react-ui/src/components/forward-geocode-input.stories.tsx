import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { createDemoClient } from "../../.storybook/demo-client";
import { ForwardGeocodeInput } from "./forward-geocode-input";

const client = createDemoClient();

const meta = {
	title: "Components/ForwardGeocodeInput",
	component: ForwardGeocodeInput,
	parameters: {
		docs: {
			description: {
				// NOTE: keep identical to the Summary + guidance in docs/forward-geocode-input.md
				component:
					"Resolves a free-text address string to coordinates (forward geocoding) as the `query` prop changes. Controlled: the parent owns `query` and receives geocode results via `onResult`. Renders a read-only display input showing the resolved `latitude, longitude` pair.",
			},
		},
	},
} satisfies Meta<typeof ForwardGeocodeInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => {
		const [query, setQuery] = useState("");
		const [result, setResult] = useState<string>("");
		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: 8,
					maxWidth: 400,
				}}
			>
				<label htmlFor="query-input" style={{ fontSize: 13, fontWeight: 500 }}>
					Address query
				</label>
				<input
					id="query-input"
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Type an address to geocode…"
					style={{
						border: "1px solid #d1d5db",
						borderRadius: 4,
						fontSize: 13,
						padding: "6px 10px",
					}}
					value={query}
				/>
				<label
					htmlFor="coords-output"
					style={{ fontSize: 13, fontWeight: 500 }}
				>
					Resolved coordinates
				</label>
				<ForwardGeocodeInput
					client={client}
					id="coords-output"
					onResult={(r) => {
						if (r.latitude !== null && r.longitude !== null) {
							setResult(`${r.latitude}, ${r.longitude}`);
						} else {
							setResult("—");
						}
					}}
					placeholder="Coordinates will appear here"
					query={query}
				/>
				<p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>
					Result: {result || "—"}
				</p>
			</div>
		);
	},
};

export const Disabled: Story = {
	args: { client, disabled: true, query: "10 Downing Street" },
};
