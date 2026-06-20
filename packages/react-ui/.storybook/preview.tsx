import type { Decorator, Preview } from "@storybook/react-vite";
import { isDemoConfigured } from "./demo-client";
import "../src/styles/globals.css";

const withDemoBanner: Decorator = (Story) => {
	if (isDemoConfigured) {
		return <Story />;
	}
	return (
		<div>
			<p
				role="status"
				style={{
					background: "#fff7ed",
					border: "1px solid #fdba74",
					borderRadius: 6,
					color: "#9a3412",
					fontSize: 13,
					margin: "0 0 12px",
					padding: "8px 12px",
				}}
			>
				Demo API key not configured — set <code>VITE_DEMO_API_KEY</code> (and
				optionally <code>VITE_DEMO_API_BASE_URL</code>) to enable live results.
				Components still render; network calls will not return data.
			</p>
			<Story />
		</div>
	);
};

const preview: Preview = {
	decorators: [withDemoBanner],
	tags: ["autodocs"],
	parameters: {
		controls: { expanded: true },
	},
};

export default preview;
