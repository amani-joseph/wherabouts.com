import type { WheraboutsClient } from "@wherabouts/sdk";

/** Per-session agent props extracted from the incoming bearer token. */
export type Props = { apiKey: string };

/** The shape every tool module must return as MCP content. */
export type ToolResult = {
	content: Array<{ type: "text"; text: string }>;
};

/**
 * Contract every tool module must satisfy.
 *
 * `I` is the validated input object inferred from the tool's Zod `inputSchema`.
 * Each tool exports a single `ToolDef` which the agent registers via
 * `server.registerTool(def.name, def, def.handler)`.
 */
export type ToolDef<I = Record<string, unknown>> = {
	name: string;
	description: string;
	annotations?: {
		readOnlyHint?: boolean;
		destructiveHint?: boolean;
		idempotentHint?: boolean;
		openWorldHint?: boolean;
	};
	inputSchema: Record<string, unknown>;
	handler: (input: I, client: WheraboutsClient) => Promise<ToolResult>;
};
