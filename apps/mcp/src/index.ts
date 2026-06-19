import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { extractApiKey } from "./auth.ts";
import { buildClient } from "./client.ts";
import { registerTools } from "./register.ts";
import type { Env, Props } from "./types.ts";

export class WheraboutsMcp extends McpAgent<Env, unknown, Props> {
	server = new McpServer({ name: "wherabouts", version: "0.1.0" });

	async init() {
		registerTools(this.server, () =>
			buildClient(this.props!.apiKey, this.env.WHERABOUTS_API_BASE_URL)
		);
	}
}

const mcpHandler = WheraboutsMcp.serve("/mcp", { binding: "MCP_OBJECT" });

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const apiKey = extractApiKey(request);
		if (!apiKey) {
			return new Response(
				JSON.stringify({
					error: "Missing API key. Send Authorization: Bearer <key>.",
				}),
				{
					status: 401,
					headers: {
						"content-type": "application/json",
						"WWW-Authenticate": "Bearer",
					},
				}
			);
		}
		// agents@0.2.x reads per-session props off the ExecutionContext: serve()
		// passes ctx.props into the Durable Object, where updateProps() refreshes
		// this.props on every request so each call uses its own API key.
		(ctx as ExecutionContext & { props: Props }).props = { apiKey };
		return mcpHandler.fetch(request, env, ctx);
	},
};
